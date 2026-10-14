using System.Net;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

public static class SquadEndpoints
{
    private static string? Validate(SquadRecord? squad)
    {
        if (squad is null || string.IsNullOrWhiteSpace(squad.Id) || squad.Id.Length > 100 || squad.Id != squad.Id.Trim())
            return "Squad ID must contain 1–100 characters without surrounding spaces.";
        if (string.IsNullOrWhiteSpace(squad.Name) || squad.Name.Trim().Length > 50)
            return "Squad name must contain 1–50 characters.";
        if (squad.Members is null || squad.Members.Length > 5)
            return "A squad can contain at most five players.";
        if (squad.Members.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 100))
            return "Player IDs must contain 1–100 characters.";
        if (squad.Members.Select(id => id.Trim()).Distinct(StringComparer.Ordinal).Count() != squad.Members.Length)
            return "Each player can appear only once in a squad.";
        if (squad.Version is <= 0) return "Squad version must be positive.";
        return null;
    }

    private static SquadRecord Normalize(SquadRecord squad) => squad with
    {
        Name = squad.Name.Trim(), Members = squad.Members.Select(id => id.Trim()).ToArray()
    };

    public static void MapSquads(this WebApplication app)
    {
        var group = app.MapGroup("/api/squads");
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            // No account ownership exists yet: this API is only for the local developer.
            if (!app.Environment.IsDevelopment() || http.Connection.RemoteIpAddress is not { } address || !IPAddress.IsLoopback(address))
                return Results.NotFound();
            // A cross-origin page cannot send this custom header without a CORS preflight.
            // The API grants no CORS access. Vite's same-origin proxy passes it through.
            if (!HttpMethods.IsGet(http.Request.Method) && http.Request.Headers["X-Breach-Request"] != "squads")
                return Results.BadRequest(new { message = "Missing squad request header." });
            try { return await next(context); }
            catch (SquadConflictException)
            {
                return Results.Conflict(new { message = "This squad changed in another tab. Reload squads before editing again." });
            }
            catch (SqlException)
            {
                return Results.Json(new { message = "Squad storage is unavailable. Check SQL Server and apply the squad migration." }, statusCode: 503);
            }
        });
        group.MapGet("", async (SquadStore db) => Results.Ok(await db.ListAsync()));
        group.MapPut("/{id}", async (string id, SquadRecord squad, SquadStore db) =>
        {
            var error = Validate(squad);
            if (error is not null) return Results.BadRequest(new { message = error });
            if (id != squad.Id) return Results.BadRequest(new { message = "Squad ID does not match the URL." });
            return Results.Ok(await db.SaveAsync(Normalize(squad)));
        });
        group.MapDelete("/{id}", async (string id, int version, SquadStore db) =>
        {
            await db.DeleteAsync(id, version);
            return Results.NoContent();
        });
        group.MapPost("/import", async (SquadRecord[] squads, SquadStore db) =>
        {
            if (squads.Length > 100) return Results.BadRequest(new { message = "Import at most 100 squads at a time." });
            foreach (var squad in squads)
                if (Validate(squad) is { } error) return Results.BadRequest(new { message = error });
            if (squads.Select(s => s.Id).Distinct(StringComparer.Ordinal).Count() != squads.Length)
                return Results.BadRequest(new { message = "Duplicate squad IDs in import." });
            await db.ImportAsync(squads.Select(Normalize).ToArray());
            return Results.Ok(await db.ListAsync());
        });
    }
}
