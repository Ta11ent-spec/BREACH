param([string]$BaseUrl='http://127.0.0.1:5088')
$ErrorActionPreference='Stop'
function Assert([bool]$ok,[string]$message){if(!$ok){throw $message}}
function Get-Api([string]$path){Invoke-RestMethod "$BaseUrl/api$path"}
function Expect-Code([string]$path,[string]$method,$body,[int]$code,$headers=@{}){
  $result=Invoke-WebRequest "$BaseUrl/api$path" -Method $method -Body $body -Headers $headers -ContentType 'application/json' -SkipHttpErrorCheck
  Assert ($result.StatusCode -eq $code) "Expected $code, got $($result.StatusCode): $($result.Content)"
  return $result
}
$before=Get-Api '/workflows/status';$overview=Get-Api '/overview/v3';$match=$overview.matches[0];$appearance=$overview.appearances | Where-Object matchId -eq $match.matchId | Select-Object -First 1
$noteId=[guid]::NewGuid().ToString();$headers=@{'X-Breach-Request'='workflows'}
$draft=@{id=$noteId;matchId=$match.matchId;roundNumber=$null;playerId=$appearance.playerId;category='Strategy note';value='Workflow integration test';source='Manual review';notes='Disposable test annotation; withdrawn after validation.'}
try {
  $null=Expect-Code '/workflows/notes' 'POST' ($draft|ConvertTo-Json) 400
  $saved=Expect-Code '/workflows/notes' 'POST' ($draft|ConvertTo-Json) 201 $headers
  $note=$saved.Content|ConvertFrom-Json
  Assert ($note.author -eq 'Local reviewer' -and $note.id -eq $noteId) 'Server attribution/id failed'
  $null=Expect-Code '/workflows/notes' 'POST' ($draft|ConvertTo-Json) 409 $headers
  $bad=@{}+$draft;$bad.id=[guid]::NewGuid().ToString();$bad.roundNumber=999
  $null=Expect-Code '/workflows/notes' 'POST' ($bad|ConvertTo-Json) 400 $headers
  $null=Expect-Code "/workflows/notes/$noteId" 'DELETE' $null 204 $headers
  $audit=Get-Api '/workflows/notes';Assert (@($audit | Where-Object {$_.id -eq $noteId -and $_.retractedAt}).Count -eq 1) 'Withdrawal audit was not preserved'
  $after=Get-Api '/workflows/status'
  foreach($key in @('matches','rounds','players','events')){Assert ($before.summary.$key -eq $after.summary.$key) "Imported $key changed"}
  Assert (!$after.collector.ingestionAvailable -and !$after.capabilities.liveTelemetry) 'Unbuilt collector must not claim a connection or live source'
  Write-Output 'PASS: status, mutation header, persistent review, validation, duplicate ID, withdrawal audit and unchanged imported counts.'
} finally { $null=Invoke-WebRequest "$BaseUrl/api/workflows/notes/$noteId" -Method DELETE -Headers $headers -SkipHttpErrorCheck }
