using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

/// <summary>
/// Read-only, round-level match data. Team identity and aggregate metrics are
/// resolved by the client from the selected player or squad, never from slot 0.
/// </summary>
public static class MatchReportEndpoints
{
    public static void MapMatchReports(this WebApplication app)
    {
        app.MapGet("/api/matches/{id}/report", async (string id, SqlStore db) =>
        {
            try
            {
                var matches = await db.ReadAsync("""
                    SELECT m.MatchId AS matchId, m.MapId AS mapId, m.MapName AS mapName,
                           m.GameVersion AS gameVersion, m.CodeVersion AS codeVersion,
                           m.MatchType AS matchType, m.GameMode AS gameMode,
                           m.RecordingProfileId AS recordingProfileId,
                           m.FirstRecordedAt AS playedAt, m.LastRecordedAt AS lastRecordedAt,
                           m.IsCompleteMatch AS isCompleteMatch,
                           (SELECT COUNT(*) FROM dbo.MatchRounds r WHERE r.MatchId=m.MatchId) AS roundCount
                    FROM dbo.Matches m WHERE m.MatchId=@id
                    """, ("@id", id));
                if (matches.Count == 0)
                    return Results.NotFound(new { message = "Match not found" });

                // One row per round, independent of the availability of team or player data.
                var rounds = await db.ReadAsync("""
                    SELECT r.RoundId AS roundId, r.MatchId AS matchId,
                           r.RoundNumber AS roundNumber, r.Site AS site,
                           r.RecordedAt AS recordedAt
                    FROM dbo.MatchRounds r WHERE r.MatchId=@id
                    ORDER BY r.RoundNumber,r.RoundId
                    """, ("@id", id));

                var teams = await db.ReadAsync("""
                    SELECT t.RoundId AS roundId, t.TeamSlot AS teamSlot,
                           t.SourceLabel AS sourceLabel, t.Side AS side, t.Won AS won,
                           t.ScoreBefore AS scoreBefore, t.ScoreAfter AS scoreAfter,
                           t.WinCondition AS winCondition
                    FROM dbo.RoundTeams t
                    JOIN dbo.MatchRounds r ON r.RoundId=t.RoundId
                    WHERE r.MatchId=@id ORDER BY r.RoundNumber,t.TeamSlot
                    """, ("@id", id));

                // These are raw per-round fields. Do not sum ScoreSnapshot; it may be
                // cumulative or contain an unsigned int32 wrap from the replay parser.
                // SQL NULL stays JSON null, including unknown deaths and damage.
                var appearances = await db.ReadAsync("""
                    SELECT rp.RoundId AS roundId, r.MatchId AS matchId,
                           r.RoundNumber AS roundNumber, rp.PlayerId AS playerId,
                           rp.UsernameSnapshot AS username, rp.TeamIndex AS teamIndex,
                           rp.OperatorId AS operatorId, rp.OperatorName AS operatorName,
                           rp.Spawn AS spawn, rp.ScoreSnapshot AS scoreSnapshot,
                           rp.Kills AS kills, rp.Died AS died, rp.Assists AS assists,
                           rp.Headshots AS headshots, rp.HeadshotPercentage AS headshotPercentage,
                           rp.DamageDealt AS damageDealt, rp.DamageTaken AS damageTaken,
                           rp.SecondsAlive AS secondsAlive, rp.DeathTime AS deathTime,
                           rp.EntryKill AS entryKill, rp.EntryDeath AS entryDeath,
                           rp.TradeKill AS tradeKill, rp.TradedDeath AS tradedDeath,
                           rp.UntradedDeath AS untradedDeath, rp.Clutch1vX AS clutch1vX,
                           rp.ExtraStatsJson AS extraStatsJson,
                           JSON_QUERY(CASE WHEN ISJSON(rp.ExtraStatsJson)=1 THEN rp.ExtraStatsJson ELSE '{}' END,'$.impact') AS impactJson
                    FROM dbo.RoundPlayers rp
                    JOIN dbo.MatchRounds r ON r.RoundId=rp.RoundId
                    WHERE r.MatchId=@id
                    ORDER BY r.RoundNumber,rp.TeamIndex,rp.PlayerId
                    """, ("@id", id));

                // Source events identify participants by username. Resolve an ID only
                // when exactly one player has the same snapshot name in that round.
                // Binary comparison avoids assigning a differently cased name.
                ImpactStats.DecodeRows(appearances);
                var events = await db.ReadAsync("""
                    SELECT e.EventId AS eventId, e.RoundId AS roundId,
                           r.RoundNumber AS roundNumber, e.EventSequence AS eventSequence,
                           e.EventType AS eventType, e.ActorUsername AS actorUsername,
                           e.TargetUsername AS targetUsername,
                           actor.PlayerId AS actorPlayerId, target.PlayerId AS targetPlayerId,
                           e.TimeRemainingSeconds AS timeRemainingSeconds,
                           e.IsHeadshot AS isHeadshot, e.WeaponId AS weaponId
                    FROM dbo.RoundEvents e
                    JOIN dbo.MatchRounds r ON r.RoundId=e.RoundId
                    OUTER APPLY (
                        SELECT CASE WHEN COUNT(DISTINCT rp.PlayerId)=1 THEN MAX(rp.PlayerId) END AS PlayerId
                        FROM dbo.RoundPlayers rp
                        WHERE rp.RoundId=e.RoundId AND rp.UsernameSnapshot COLLATE Latin1_General_100_BIN2
                            = e.ActorUsername COLLATE Latin1_General_100_BIN2
                    ) actor
                    OUTER APPLY (
                        SELECT CASE WHEN COUNT(DISTINCT rp.PlayerId)=1 THEN MAX(rp.PlayerId) END AS PlayerId
                        FROM dbo.RoundPlayers rp
                        WHERE rp.RoundId=e.RoundId AND rp.UsernameSnapshot COLLATE Latin1_General_100_BIN2
                            = e.TargetUsername COLLATE Latin1_General_100_BIN2
                    ) target
                    WHERE r.MatchId=@id
                    ORDER BY r.RoundNumber,e.EventSequence,e.EventId
                    """, ("@id", id));

                return Results.Ok(new { match = matches[0], rounds, teams, appearances, events });
            }
            catch (SqlException)
            {
                return Results.Json(new { message = "Match report is unavailable. Check local SQL Server and the replay schema." }, statusCode: 503);
            }
        });
    }
}
