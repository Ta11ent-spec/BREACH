param([string]$BaseUrl = 'http://127.0.0.1:5087')
$ErrorActionPreference = 'Stop'
$squadTestHeaders = @{ 'X-Breach-Request' = 'squads' }
$squadTestId = 'test-' + [guid]::NewGuid().ToString()
$squadImportId = 'test-' + [guid]::NewGuid().ToString()
$squadOtherId = 'test-' + [guid]::NewGuid().ToString()
$testIds = @($squadTestId, $squadImportId, $squadOtherId)

function Call-Api([string]$Method, [string]$Path, $Body = $null, [int]$Expected = 200, [bool]$WithHeader = $true) {
    $options = @{ Uri = "$BaseUrl/api/squads$Path"; Method = $Method; SkipHttpErrorCheck = $true }
    if ($WithHeader) { $options.Headers = $squadTestHeaders }
    if ($null -ne $Body) { $options.Body = ConvertTo-Json -InputObject $Body -Depth 8 -Compress; $options.ContentType = 'application/json' }
    $response = Invoke-WebRequest @options
    if ([int]$response.StatusCode -ne $Expected) { throw "$Method $Path expected $Expected, received $($response.StatusCode): $($response.Content)" }
    if ($response.Content) { return ConvertFrom-Json -InputObject $response.Content -NoEnumerate }
}
function Assert-True([bool]$Condition, [string]$Message) { if (!$Condition) { throw $Message } }

try {
    $before = Invoke-RestMethod "$BaseUrl/api/overview/v3"
    $record = @{ id = $squadTestId; name = 'Persistence test'; members = @('qa-one', 'qa-two') }
    $created = Call-Api PUT "/$squadTestId" $record
    Assert-True ($created.version -eq 1) 'New squad needs version 1'
    $list = Call-Api GET ''
    $reloaded = $list | Where-Object id -EQ $squadTestId
    Assert-True ($reloaded.members.Count -eq 2) 'Members must survive a new GET'
    $record.version = 1
    $record.name = 'Renamed squad'
    $record.members = @('qa-two','qa-three','qa-four','qa-five','qa-six')
    $saved = Call-Api PUT "/$squadTestId" $record
    Assert-True ($saved.version -eq 2 -and $saved.members[0] -eq 'qa-two') 'Rename and roster replacement must persist in order'
    $null = Call-Api PUT "/$squadTestId" $record 409
    $null = Call-Api DELETE "/${squadTestId}?version=1" $null 409
    $record.version = 2
    $record.members += 'qa-seven'
    $null = Call-Api PUT "/$squadTestId" $record 400
    $record.members = @('qa-two',' qa-two ')
    $null = Call-Api PUT "/$squadTestId" $record 400
    $record.members = @('qa-two')
    $record.name = ' '
    $null = Call-Api PUT "/$squadTestId" $record 400
    $record.name = 'Header rejection'
    $null = Call-Api PUT "/$squadTestId" $record 400 $false
    $list = Call-Api GET ''
    $unchanged = $list | Where-Object id -EQ $squadTestId
    Assert-True ($unchanged.version -eq 2 -and $unchanged.members.Count -eq 5 -and $unchanged.name -eq 'Renamed squad') 'Failed writes must not change a saved squad'

    $null = Call-Api PUT "/$squadOtherId" @{ id=$squadOtherId; name='Overlapping roster'; members=@('qa-two') }
    $imports = @(@{id=$squadImportId;name='Legacy roster';members=@('qa-two')}, @{id=$squadTestId;name='Must not overwrite';members=@()})
    $null = Call-Api POST '/import' $imports
    $imported = Call-Api POST '/import' $imports
    Assert-True (@($imported | Where-Object id -EQ $squadImportId).Count -eq 1) 'Retry must not duplicate imported squads'
    Assert-True (($imported | Where-Object id -EQ $squadTestId).name -eq 'Renamed squad') 'Import must preserve an existing database squad'
    $null = Call-Api DELETE "/${squadImportId}?version=1" $null 204
    $list = Call-Api GET ''
    Assert-True (@($list | Where-Object id -EQ $squadImportId).Count -eq 0) 'Deleted roster must disappear'
    $after = Invoke-RestMethod "$BaseUrl/api/overview/v3"
    Assert-True ($before.matches.Count -eq $after.matches.Count -and $before.appearances.Count -eq $after.appearances.Count -and $before.rounds.Count -eq $after.rounds.Count) 'Replay data counts must be unchanged'
    Write-Output 'PASS: persistence, rename, roster replacement, five-player validation, duplicates, stale updates/deletes, request header, overlapping squads, retry-safe import, deletion and replay preservation.'
} finally {
    # Only remove the three uniquely named records created by this test.
    $remaining = Call-Api GET ''
    foreach ($squad in $remaining) {
        if ($squad.id -in $testIds) { $null = Call-Api DELETE "/$($squad.id)?version=$($squad.version)" $null 204 }
    }
}
