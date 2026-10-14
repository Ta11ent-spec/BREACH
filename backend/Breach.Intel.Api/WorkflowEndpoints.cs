using System.Net;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

public sealed record ReviewInput(string Id, string MatchId, int? RoundNumber, string? PlayerId,
    string Category, string Value, string Source, string Notes);

public static class WorkflowEndpoints
{
    private const string NoteColumns = "NoteId AS id, MatchId AS matchId, RoundNumber AS roundNumber, PlayerId AS playerId, Category AS category, Value AS value, ReviewSource AS source, Notes AS notes, AuthorLabel AS author, CreatedAt AS createdAt, RetractedAt AS retractedAt";
    public static void MapWorkflows(this WebApplication app)
    {
        var group = app.MapGroup("/api/workflows");
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            if (http.User.Identity?.IsAuthenticated!=true && (!app.Environment.IsDevelopment() || http.Connection.RemoteIpAddress is not { } address || !IPAddress.IsLoopback(address))) return Results.NotFound();
            if (!HttpMethods.IsGet(http.Request.Method) && http.Request.Headers["X-Breach-Request"] != "workflows") return Results.BadRequest(new { message = "Missing workflow request header." });
            try { return await next(context); }
            catch (SqlException) { return Results.Problem("Workflow storage is unavailable. Check LocalDB and apply review migration 002.", statusCode: 503); }
        });
        group.MapGet("/status", async (SqlStore db) =>
        {
            var summary = await db.ReadAsync("""
                SELECT DB_NAME() AS databaseName,
                (SELECT COUNT(*) FROM dbo.Matches) AS matches,
                (SELECT COUNT(*) FROM dbo.MatchRounds) AS rounds,
                (SELECT COUNT(*) FROM dbo.Players) AS players,
                (SELECT COUNT(*) FROM dbo.RoundEvents) AS events,
                (SELECT COUNT(*) FROM dbo.ImportIssues) AS issues,
                (SELECT MAX(FinishedAt) FROM dbo.ImportBatches WHERE Status=N'Completed') AS lastSuccessfulImport
                """);
            var batches = await db.ReadAsync("""
                SELECT TOP(30) ImportBatchId AS id, ImporterVersion AS importerVersion,
                Status AS status, FinishedAt AS finishedAt, Notes AS notes
                FROM dbo.ImportBatches ORDER BY ImportBatchId DESC
                """);
            var issues = await db.ReadAsync("""
                SELECT TOP(100) ImportBatchId AS batchId, MatchId AS matchId,
                Severity AS severity, IssueCode AS code, Message AS message
                FROM dbo.ImportIssues ORDER BY ImportBatchId DESC,MatchId,IssueCode
                """);
            var devices=await db.ReadAsync("SELECT TOP(1) LastSeen AS lastSeen,Version AS version FROM dbo.CollectorConnections WHERE RevokedAt IS NULL ORDER BY LastSeen DESC");
            return Results.Ok(new { summary=summary[0], batches, issues,
                collector=new { state=devices.Count>0?"connected":"not_connected", lastSeen=devices.FirstOrDefault()?.GetValueOrDefault("lastSeen"), version=devices.FirstOrDefault()?.GetValueOrDefault("version"),
                    ingestionAvailable=true, contractVersion="1.0.0" },
                checkedAt=DateTimeOffset.UtcNow,
                capabilities=new { postMatchReplay=true, liveTelemetry=false, authenticatedSync=true,
                    heldJobsVisible=false, noteStorage="sql-server" } });
        });
        group.MapGet("/notes", async (SqlStore db) => Results.Ok(await db.ReadAsync($"SELECT TOP(500) {NoteColumns} FROM dbo.ReviewNotes ORDER BY CreatedAt DESC,NoteId")));
        group.MapPost("/notes", async (ReviewInput input, SqlStore db) =>
        {
            if (!Guid.TryParse(input.Id,out var id) || string.IsNullOrWhiteSpace(input.MatchId) || input.MatchId.Length>100 || input.MatchId!=input.MatchId.Trim()
                || input.PlayerId is not null && (string.IsNullOrWhiteSpace(input.PlayerId)||input.PlayerId.Length>100||input.PlayerId!=input.PlayerId.Trim())
                || input.RoundNumber is <=0 || input.Category is null || input.Value is null || input.Source is null || input.Notes is null
                || !new[]{"Strategy note","Positioning review","Communication review","Objective review","Correction proposal","Other observation"}.Contains(input.Category)
                || !new[]{"Manual review","VOD review","Coach annotation","Player report"}.Contains(input.Source)
                || string.IsNullOrWhiteSpace(input.Value) || input.Value.Length>200 || input.Notes.Length>4000)
                return Results.BadRequest(new {message="Invalid review record. Select a valid category/source and provide 1–200 characters of value and up to 4000 characters of notes."});
            var matchId=input.MatchId;
            var match = await db.ReadAsync("SELECT MatchId FROM dbo.Matches WHERE MatchId=@match",("@match",matchId));
            if(match.Count==0) return Results.NotFound(new {message="Match not found."});
            if(input.RoundNumber is not null && (await db.ReadAsync("SELECT RoundId FROM dbo.MatchRounds WHERE MatchId=@match AND RoundNumber=@round",("@match",matchId),("@round",input.RoundNumber))).Count==0)
                return Results.BadRequest(new {message="Round not recorded in this match."});
            if(input.PlayerId is not null && (await db.ReadAsync("""
                SELECT TOP(1) rp.PlayerId FROM dbo.RoundPlayers rp JOIN dbo.MatchRounds r ON r.RoundId=rp.RoundId
                WHERE r.MatchId=@match AND rp.PlayerId=@player AND (@round IS NULL OR r.RoundNumber=@round)
                """,("@match",matchId),("@player",input.PlayerId),("@round",input.RoundNumber))).Count==0)
                return Results.BadRequest(new {message="Player did not participate in this match/round."});
            var existing = await db.ReadAsync($"SELECT {NoteColumns} FROM dbo.ReviewNotes WHERE NoteId=@id",("@id",id));
            if(existing.Count>0) return Results.Conflict(new {message="This note ID already exists. Reload the review log before retrying."});
            var saved = await db.ReadAsync($"""
                INSERT dbo.ReviewNotes(NoteId,MatchId,RoundNumber,PlayerId,Category,Value,ReviewSource,Notes,AuthorLabel)
                OUTPUT inserted.NoteId AS id,inserted.MatchId AS matchId,inserted.RoundNumber AS roundNumber,
                  inserted.PlayerId AS playerId,inserted.Category AS category,inserted.Value AS value,
                  inserted.ReviewSource AS source,inserted.Notes AS notes,inserted.AuthorLabel AS author,
                  inserted.CreatedAt AS createdAt,inserted.RetractedAt AS retractedAt
                VALUES(@id,@match,@round,@player,@category,@value,@source,@notes,N'Workspace member')
                """,("@id",id),("@match",matchId),("@round",input.RoundNumber),("@player",input.PlayerId),
                ("@category",input.Category),("@value",input.Value.Trim()),("@source",input.Source),("@notes",input.Notes.Trim()));
            return Results.Created($"/api/workflows/notes/{id}",saved[0]);
        });
        group.MapDelete("/notes/{id:guid}", async (Guid id, SqlStore db) =>
        {
            var row = await db.ReadAsync("UPDATE dbo.ReviewNotes SET RetractedAt=COALESCE(RetractedAt,SYSUTCDATETIME()) OUTPUT inserted.NoteId AS id WHERE NoteId=@id",("@id",id));
            return row.Count==0 ? Results.NotFound() : Results.NoContent();
        });
    }
}
