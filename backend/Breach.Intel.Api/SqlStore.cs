using Microsoft.Data.SqlClient;
using System.Data;

namespace Breach.Intel.Api;

/// <summary>
/// Small parameterized read-only SQL adapter for the existing v0.1 schema.
/// The SQL queries are fixed at compile time; user values are SQL parameters.
/// </summary>
public sealed class SqlStore(IConfiguration config, Workspace workspace)
{
    private string ConnectionString => config.GetConnectionString("BreachDatabase")
        ?? throw new InvalidOperationException("BreachDatabase connection string missing");

    public async Task<List<Dictionary<string, object?>>> ReadAsync(
        string sql, params (string Name, object? Value)[] parameters)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(workspace.Scope(sql), connection) { CommandTimeout = 15 };
        foreach (var (name, value) in parameters)
        {
            var parameter = command.Parameters.AddWithValue(name, value ?? DBNull.Value);
            // Explicit type ensures IDs compare consistently and avoids SQL string coercion surprises.
            if (value is string) parameter.SqlDbType = SqlDbType.NVarChar;
        }
        var rows = new List<Dictionary<string, object?>>();
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < reader.FieldCount; i++)
                {
                var name=reader.GetName(i);
                var value=await reader.IsDBNullAsync(i)?null:reader.GetValue(i);
                // Game IDs are decimal strings on the wire: JavaScript numbers lose
                // precision above 2^53. Measurements retain their numeric types.
                row[name]=value is decimal id && new[]{"mapId","operatorId","weaponId"}.Contains(name,StringComparer.OrdinalIgnoreCase)
                    ? id.ToString(System.Globalization.CultureInfo.InvariantCulture):value;
            }
            rows.Add(row);
        }
        return rows;
    }
}
