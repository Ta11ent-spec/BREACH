using Breach.Intel.Api;
using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SqlStore>();
// Local development only. Vite forwards /api requests, so no public CORS policy is necessary.
var app = builder.Build();

app.MapGet("/api/health", async (SqlStore db) =>
{
    try
    {
        var result = await db.ReadAsync("SELECT DB_NAME() AS databaseName, (SELECT COUNT(*) FROM dbo.Matches) AS matchCount");
        return Results.Ok(new { status = "ok", database = result[0]["databaseName"], matches = result[0]["matchCount"] });
    }
    catch (SqlException)
    {
        return Results.Problem("Local SQL Server is not available or the schema is missing.", statusCode: 503);
    }
});

const string MatchListSql = """
    SELECT m.MatchId AS matchId, m.MapId AS mapId, m.MapName AS mapName,
           m.GameVersion AS gameVersion, m.MatchType AS matchType,
           m.GameMode AS gameMode, m.FirstRecordedAt AS playedAt,
           m.IsCompleteMatch AS isCompleteMatch,
           (SELECT COUNT(*) FROM dbo.MatchRounds r WHERE r.MatchId=m.MatchId) AS roundCount,
           (SELECT COUNT(*) FROM dbo.MatchRounds r JOIN dbo.RoundTeams t ON t.RoundId=r.RoundId
               WHERE r.MatchId=m.MatchId AND t.TeamSlot=0 AND t.Won=1) AS roundsWon,
           (SELECT COUNT(*) FROM dbo.MatchRounds r JOIN dbo.RoundTeams t ON t.RoundId=r.RoundId
               WHERE r.MatchId=m.MatchId AND t.TeamSlot=0 AND t.Won=0) AS roundsLost
    FROM dbo.Matches m
    ORDER BY m.FirstRecordedAt DESC, m.MatchId
    """;
app.MapGet("/api/matches", async (SqlStore db) => Results.Ok(await db.ReadAsync(MatchListSql)));

app.MapGet("/api/matches/{id}", async (string id, SqlStore db) =>
{
    var rows = await db.ReadAsync("SELECT MatchId AS matchId, MapName AS mapName, MapId AS mapId, GameVersion AS gameVersion, GameMode AS gameMode, MatchType AS matchType, FirstRecordedAt AS playedAt, IsCompleteMatch AS isCompleteMatch FROM dbo.Matches WHERE MatchId=@id", ("@id", id));
    if (rows.Count == 0) return Results.NotFound(new { message = "Match not found" });
    var rounds = await db.ReadAsync("""
        SELECT r.RoundId AS roundId, r.RoundNumber AS roundNumber, r.Site AS site,
            r.RecordedAt AS recordedAt, t.Side AS side, t.Won AS won,
            t.ScoreBefore AS scoreBefore, t.ScoreAfter AS scoreAfter,
            enemy.ScoreAfter AS opponentScoreAfter, t.WinCondition AS winCondition
        FROM dbo.MatchRounds r
        LEFT JOIN dbo.RoundTeams t ON r.RoundId=t.RoundId AND t.TeamSlot=0
        LEFT JOIN dbo.RoundTeams enemy ON r.RoundId=enemy.RoundId AND enemy.TeamSlot=1
        WHERE r.MatchId=@id ORDER BY r.RoundNumber
        """, ("@id", id));
    var players = await db.ReadAsync("""
        SELECT p.PlayerId AS playerId, p.Username AS username,
            COUNT(*) AS roundsPlayed, SUM(COALESCE(rp.Kills,0)) AS kills,
            SUM(CASE WHEN rp.Died=1 THEN 1 ELSE 0 END) AS deaths,
            SUM(COALESCE(rp.Assists,0)) AS assists,
            SUM(COALESCE(rp.Headshots,0)) AS headshots,
            SUM(rp.DamageDealt) AS damageDealt,
            SUM(rp.DamageTaken) AS damageTaken,
            MAX(CASE WHEN rp.TeamIndex=0 THEN 1 ELSE 0 END) AS recordedTeam
        FROM dbo.RoundPlayers rp
        JOIN dbo.MatchRounds r ON r.RoundId=rp.RoundId
        JOIN dbo.Players p ON p.PlayerId=rp.PlayerId
        WHERE r.MatchId=@id GROUP BY p.PlayerId,p.Username
        ORDER BY recordedTeam DESC,kills DESC,p.Username
        """, ("@id", id));
    return Results.Ok(new { match = rows[0], rounds, players });
});

app.MapGet("/api/matches/{id}/rounds", async (string id, SqlStore db) =>
{
    var rounds = await db.ReadAsync("""
        SELECT r.RoundId AS roundId, r.RoundNumber AS roundNumber, r.Site AS site,
            t.Side AS side, t.Won AS won, t.ScoreAfter AS scoreAfter,
            enemy.ScoreAfter AS opponentScoreAfter, t.WinCondition AS winCondition
        FROM dbo.MatchRounds r
        LEFT JOIN dbo.RoundTeams t ON r.RoundId=t.RoundId AND t.TeamSlot=0
        LEFT JOIN dbo.RoundTeams enemy ON r.RoundId=enemy.RoundId AND enemy.TeamSlot=1
        WHERE r.MatchId=@id ORDER BY r.RoundNumber
        """, ("@id", id));
    return Results.Ok(rounds);
});

app.MapGet("/api/matches/{id}/rounds/{roundNumber:int}", async (string id, int roundNumber, SqlStore db) =>
{
    var rounds = await db.ReadAsync("""
        SELECT r.RoundId AS roundId, r.RoundNumber AS roundNumber, r.Site AS site,
            t.Side AS side, t.Won AS won, t.ScoreBefore AS scoreBefore,
            t.ScoreAfter AS scoreAfter, enemy.ScoreAfter AS opponentScoreAfter,
            t.WinCondition AS winCondition
        FROM dbo.MatchRounds r
        LEFT JOIN dbo.RoundTeams t ON r.RoundId=t.RoundId AND t.TeamSlot=0
        LEFT JOIN dbo.RoundTeams enemy ON r.RoundId=enemy.RoundId AND enemy.TeamSlot=1
        WHERE r.MatchId=@id AND r.RoundNumber=@number
        """, ("@id", id), ("@number", roundNumber));
    if (rounds.Count == 0) return Results.NotFound(new { message = "Round not found" });
    var roundId = rounds[0]["roundId"];
    var players = await db.ReadAsync("""
        SELECT rp.PlayerId AS playerId, rp.UsernameSnapshot AS username,
            rp.TeamIndex AS teamIndex, rp.OperatorName AS operatorName,
            rp.Spawn AS spawn, rp.Kills AS kills, rp.Died AS died,
            rp.Assists AS assists, rp.Headshots AS headshots,
            rp.DamageDealt AS damageDealt, rp.DamageTaken AS damageTaken,
            rp.SecondsAlive AS secondsAlive, rp.EntryKill AS entryKill,
            rp.EntryDeath AS entryDeath, rp.TradeKill AS tradeKill,
            rp.TradedDeath AS tradedDeath, rp.UntradedDeath AS untradedDeath,
            rp.Clutch1vX AS clutch1vX
        FROM dbo.RoundPlayers rp WHERE rp.RoundId=@roundId
        ORDER BY rp.TeamIndex,rp.Kills DESC
        """, ("@roundId", roundId));
    var events = await db.ReadAsync("""
        SELECT EventSequence AS eventSequence,EventType AS eventType,
            ActorUsername AS actorUsername,TargetUsername AS targetUsername,
            TimeRemainingSeconds AS timeRemainingSeconds,
            IsHeadshot AS isHeadshot,WeaponId AS weaponId
        FROM dbo.RoundEvents WHERE RoundId=@roundId ORDER BY EventSequence
        """, ("@roundId", roundId));
    return Results.Ok(new { round = rounds[0], players, events });
});

app.MapGet("/api/players", async (SqlStore db) => Results.Ok(await db.ReadAsync("""
    SELECT p.PlayerId AS playerId,p.Username AS username,
        COUNT(*) AS roundsPlayed, SUM(COALESCE(rp.Kills,0)) AS kills,
        SUM(CASE WHEN rp.Died=1 THEN 1 ELSE 0 END) AS deaths,
        SUM(COALESCE(rp.Assists,0)) AS assists
    FROM dbo.Players p JOIN dbo.RoundPlayers rp ON rp.PlayerId=p.PlayerId
    GROUP BY p.PlayerId,p.Username ORDER BY kills DESC,p.Username
    """)));

app.MapGet("/api/players/{id}/stats", async (string id, SqlStore db) =>
{
    var players = await db.ReadAsync("""
        SELECT p.PlayerId AS playerId,p.Username AS username,
            COUNT(*) AS roundsPlayed, SUM(COALESCE(rp.Kills,0)) AS kills,
            SUM(CASE WHEN rp.Died=1 THEN 1 ELSE 0 END) AS deaths,
            SUM(COALESCE(rp.Assists,0)) AS assists,
            SUM(COALESCE(rp.Headshots,0)) AS headshots,
            SUM(rp.DamageDealt) AS damageDealt,
            SUM(rp.DamageTaken) AS damageTaken,
            SUM(CASE WHEN rp.EntryKill=1 THEN 1 ELSE 0 END) AS entryKills,
            SUM(CASE WHEN rp.EntryDeath=1 THEN 1 ELSE 0 END) AS entryDeaths,
            SUM(CASE WHEN rp.TradeKill=1 THEN 1 ELSE 0 END) AS tradeKills
        FROM dbo.Players p JOIN dbo.RoundPlayers rp ON rp.PlayerId=p.PlayerId
        WHERE p.PlayerId=@id GROUP BY p.PlayerId,p.Username
        """, ("@id", id));
    if (players.Count == 0) return Results.NotFound(new { message = "Player not found" });
    var operators = await db.ReadAsync("""
        SELECT rp.OperatorName AS operatorName, COUNT(*) AS roundsPlayed,
            SUM(COALESCE(rp.Kills,0)) AS kills,
            SUM(CASE WHEN rp.Died=1 THEN 1 ELSE 0 END) AS deaths
        FROM dbo.RoundPlayers rp WHERE rp.PlayerId=@id
        GROUP BY rp.OperatorName ORDER BY roundsPlayed DESC
        """, ("@id", id));
    return Results.Ok(new { player = players[0], operators });
});

app.Run();
