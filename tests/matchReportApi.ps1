param([string]$BaseUrl = 'http://127.0.0.1:5087')
$ErrorActionPreference = 'Stop'

function Assert-True([bool]$Condition, [string]$Message) {
    if (!$Condition) { throw $Message }
}

function Read-Api([string]$Path) {
    Invoke-RestMethod -Uri "$BaseUrl/api$Path"
}

# This test only reads data. It never creates squads, starts a server or writes SQL.
$overview = Read-Api '/overview/v3'
$matches = Read-Api '/matches'
Assert-True ($matches.Count -gt 0) 'Import at least one replay to exercise the report endpoint.'
$roundTotal = 0
$appearanceTotal = 0
$eventTotal = 0
$nullDamageTotal = 0

foreach ($match in $matches) {
    $matchId = [uri]::EscapeDataString($match.matchId)
    $report = Read-Api "/matches/$matchId/report"
    Assert-True ($report.match.matchId -ceq $match.matchId) 'The report must return the requested match.'
    Assert-True ($report.match.roundCount -eq $match.roundCount) 'Match round counts must agree with the existing list.'
    Assert-True (@($report.rounds).Count -eq $match.roundCount) 'Rounds must appear once each, even with two team rows.'
    $roundIds = @($report.rounds.roundId)
    Assert-True (@($roundIds | Sort-Object -Unique).Count -eq $roundIds.Count) 'Report round IDs must be unique.'
    $expectedTeams = @($overview.rounds | Where-Object matchId -CEQ $match.matchId)
    $expectedAppearances = @($overview.appearances | Where-Object matchId -CEQ $match.matchId)
    Assert-True (@($report.teams).Count -eq $expectedTeams.Count) 'The report must preserve both team slots from the analytics feed.'
    Assert-True (@($report.appearances).Count -eq $expectedAppearances.Count) 'All player appearances must survive in the report.'

    foreach ($round in $report.rounds) {
        $detail = Read-Api "/matches/$matchId/rounds/$($round.roundNumber)"
        $roundPlayers = @($report.appearances | Where-Object roundId -CEQ $round.roundId)
        $roundEvents = @($report.events | Where-Object roundId -CEQ $round.roundId)
        Assert-True ($detail.round.roundId -ceq $round.roundId) 'Round number must resolve to the same round ID.'
        Assert-True ($roundPlayers.Count -eq @($detail.players).Count) 'All participants from both teams must be returned.'
        Assert-True ($roundEvents.Count -eq @($detail.events).Count) 'Every recorded event must be returned.'
        foreach ($player in $roundPlayers) {
            $original = @($detail.players | Where-Object playerId -CEQ $player.playerId)
            Assert-True ($original.Count -eq 1) 'Each player must appear once per round.'
            foreach ($field in @('teamIndex','kills','died','assists','headshots','damageDealt','damageTaken','secondsAlive','entryKill','entryDeath','tradeKill','tradedDeath','untradedDeath','clutch1vX')) {
                Assert-True ($player.$field -ceq $original[0].$field) "Raw $field must agree with the existing round endpoint, including nulls."
            }
            if ($null -eq $player.damageDealt) { $nullDamageTotal++ }
        }
        foreach ($event in $roundEvents) {
            $original = @($detail.events | Where-Object eventSequence -EQ $event.eventSequence)
            Assert-True ($original.Count -eq 1) 'Event sequence must identify one source event in the round.'
            foreach ($field in @('eventType','actorUsername','targetUsername','timeRemainingSeconds','isHeadshot','weaponId')) {
                Assert-True ($event.$field -ceq $original[0].$field) "Raw event $field must be preserved."
            }
            foreach ($role in @('actor','target')) {
                $sourceName = $event.($role + 'Username')
                $resolvedId = $event.($role + 'PlayerId')
                $candidates = @($roundPlayers | Where-Object { $null -ne $sourceName -and $_.username -ceq $sourceName })
                if ($candidates.Count -eq 1) {
                    Assert-True ($resolvedId -ceq $candidates[0].playerId) 'Unique snapshot names must resolve to the same player ID.'
                } else {
                    Assert-True ($null -eq $resolvedId) 'Unknown or ambiguous event names must not be assigned a player ID.'
                }
            }
        }
    }
    $roundTotal += @($report.rounds).Count
    $appearanceTotal += @($report.appearances).Count
    $eventTotal += @($report.events).Count
}

# Unknown IDs, including SQL-looking text, must be treated as a single parameter.
foreach ($missingId in @(('missing-report-' + [guid]::NewGuid().ToString()), "' OR 1=1--")) {
    $encodedId = [uri]::EscapeDataString($missingId)
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/matches/$encodedId/report" -SkipHttpErrorCheck
    Assert-True ([int]$response.StatusCode -eq 404) 'A missing match ID must return 404 without revealing another match.'
}

$after = Read-Api '/overview/v3'
Assert-True (@($after.matches).Count -eq @($overview.matches).Count -and @($after.rounds).Count -eq @($overview.rounds).Count -and @($after.appearances).Count -eq @($overview.appearances).Count) 'Read-only reporting must leave replay counts unchanged.'
Write-Output "PASS: $($matches.Count) matches; $roundTotal rounds; $appearanceTotal player appearances; $eventTotal events; $nullDamageTotal null damage values preserved. Both teams, raw round statistics, event identities and missing-ID handling verified."
