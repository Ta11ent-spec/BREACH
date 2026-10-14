using System.Data;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

public sealed record SquadRecord(string Id, string Name, string[] Members, int? Version);
public sealed class SquadConflictException : Exception;

/// <summary>Single local workspace rosters. Each write is atomic and version checked.</summary>
public sealed class SquadStore(IConfiguration config)
{
    private async Task<SqlConnection> OpenAsync()
    {
        var connection = new SqlConnection(config.GetConnectionString("BreachDatabase"));
        try { await connection.OpenAsync(); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }

    private static SqlCommand Command(SqlConnection connection, SqlTransaction? transaction,
        string sql, params (string Name, object? Value)[] parameters)
    {
        var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = 15 };
        foreach (var (name, value) in parameters)
        {
            var parameter = command.Parameters.AddWithValue(name, value ?? DBNull.Value);
            if (value is string) parameter.SqlDbType = SqlDbType.NVarChar;
        }
        return command;
    }

    public async Task<List<SquadRecord>> ListAsync()
    {
        await using var connection = await OpenAsync();
        await using var command = Command(connection, null, """
            SELECT s.SquadId, s.Name, s.Version, m.PlayerId
            FROM dbo.Squads s LEFT JOIN dbo.SquadMembers m ON m.SquadId=s.SquadId
            ORDER BY s.CreatedAt,s.SquadId,m.Slot
            """);
        var result = new List<SquadRecord>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var id = reader.GetString(0);
            if (result.Count == 0 || result[^1].Id != id)
                result.Add(new(id, reader.GetString(1), [], reader.GetInt32(2)));
            if (!reader.IsDBNull(3)) result[^1] = result[^1] with { Members = [..result[^1].Members, reader.GetString(3)] };
        }
        return result;
    }

    private static async Task<int?> VersionAsync(SqlConnection connection, SqlTransaction transaction, string id)
    {
        await using var command = Command(connection, transaction,
            "SELECT Version FROM dbo.Squads WITH (UPDLOCK,HOLDLOCK) WHERE SquadId=@id", ("@id", id));
        return (int?)await command.ExecuteScalarAsync();
    }

    private static async Task WriteAsync(SqlConnection connection, SqlTransaction transaction, SquadRecord squad, int? current)
    {
        await using var command = Command(connection, transaction, current is null
            ? "INSERT dbo.Squads (SquadId,Name) VALUES (@id,@name)"
            : "UPDATE dbo.Squads SET Name=@name,Version=Version+1,UpdatedAt=SYSUTCDATETIME() WHERE SquadId=@id; DELETE dbo.SquadMembers WHERE SquadId=@id;",
            ("@id", squad.Id), ("@name", squad.Name));
        await command.ExecuteNonQueryAsync();
        for (var index = 0; index < squad.Members.Length; index++)
        {
            await using var member = Command(connection, transaction,
                "INSERT dbo.SquadMembers (SquadId,Slot,PlayerId) VALUES (@id,@slot,@player)",
                ("@id", squad.Id), ("@slot", index + 1), ("@player", squad.Members[index]));
            await member.ExecuteNonQueryAsync();
        }
    }

    public async Task<SquadRecord> SaveAsync(SquadRecord squad)
    {
        await using var connection = await OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        var current = await VersionAsync(connection, transaction, squad.Id);
        if (current != squad.Version) throw new SquadConflictException();
        await WriteAsync(connection, transaction, squad, current);
        await transaction.CommitAsync();
        return squad with { Version = (current ?? 0) + 1 };
    }

    public async Task DeleteAsync(string id, int version)
    {
        await using var connection = await OpenAsync();
        await using var command = Command(connection, null,
            "DELETE dbo.Squads WHERE SquadId=@id AND Version=@version", ("@id", id), ("@version", version));
        if (await command.ExecuteNonQueryAsync() != 1) throw new SquadConflictException();
    }

    // Retry-safe: existing IDs are preserved, including server-side roster edits.
    public async Task ImportAsync(SquadRecord[] squads)
    {
        await using var connection = await OpenAsync();
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();
        foreach (var squad in squads.OrderBy(s => s.Id, StringComparer.Ordinal))
        {
            if (await VersionAsync(connection, transaction, squad.Id) is null)
                await WriteAsync(connection, transaction, squad, null);
        }
        await transaction.CommitAsync();
    }
}
