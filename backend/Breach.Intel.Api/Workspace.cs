using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

// Only server-derived schema names enter SQL. No request body/header chooses an owner.
public sealed class Workspace(IConfiguration config, IWebHostEnvironment env)
{
    public string Id { get; private set; } = "";
    public string Schema { get; private set; } = "";
    public string Scope(string sql)
    {
        if (Schema.Length == 0) throw new InvalidOperationException("Workspace has not been resolved.");
        // Gameplay tables are the shared authenticated player catalogue. Account material
        // stays in the caller's schema. Keep this allowlist explicit and fail closed above.
        foreach(var table in new[]{"Squads","SquadMembers","ReviewNotes","ImportBatches","ImportIssues","UploadReceipts","UploadSources","CollectorConnections","WorkspaceLibrary","ManualMatches","AccountProfile"})
            sql=System.Text.RegularExpressions.Regex.Replace(sql,@"\bdbo\."+table+@"\b",$"[{Schema}].[{table}]");
        return sql;
    }
    public SqlConnection Connection() => new(config.GetConnectionString("BreachDatabase"));
    public async Task ResolveAsync(HttpContext http, bool configured)
    {
        var subject = http.User.FindFirst("sub")?.Value;
        var issuer = http.User.FindFirst("iss")?.Value;
        if (configured && (string.IsNullOrEmpty(subject) || string.IsNullOrEmpty(issuer))) throw new UnauthorizedAccessException();
        Id = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(configured ? issuer + "\n" + subject : "local-development")));
        var approved = config.GetSection("Auth0:AllowedSubjects").Get<string[]>() ?? [];
        // The previous private workspace can have exactly one owner, never all signups.
        if (approved.Length > 1) throw new InvalidOperationException("Configure one legacy workspace owner.");
        var legacy = !configured || approved.Contains(subject, StringComparer.Ordinal);
        await using var db = Connection(); await db.OpenAsync(http.RequestAborted);
        await using var tx = (SqlTransaction)await db.BeginTransactionAsync(http.RequestAborted);
        async Task<object?> Run(string sql, params (string, object)[] args) {
            await using var cmd = new SqlCommand(sql, db, tx) { CommandTimeout = 60 };
            foreach (var (k,v) in args) cmd.Parameters.AddWithValue(k,v);
            return await cmd.ExecuteScalarAsync(http.RequestAborted);
        }
        await Run("DECLARE @r int; EXEC @r=sp_getapplock @Resource=N'breach-workspace-provision',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 51000,'Workspace provisioning busy',1;");
        await Run("IF OBJECT_ID('dbo.WorkspaceAccounts','U') IS NULL CREATE TABLE dbo.WorkspaceAccounts(AccountKey char(64) NOT NULL PRIMARY KEY, SchemaName varchar(70) NOT NULL UNIQUE, CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());");
        await Run(File.ReadAllText(Path.Combine(env.ContentRootPath,"Sql","005_numeric_storage.sql")));
        var existing = await Run("SELECT SchemaName FROM dbo.WorkspaceAccounts WHERE AccountKey=@id", ("@id",Id));
        if (existing is string saved) Schema = saved;
        else {
            Schema = legacy ? "dbo" : "w_" + Id;
            if (legacy && await Run("SELECT SchemaName FROM dbo.WorkspaceAccounts WHERE SchemaName='dbo'") is not null)
                throw new InvalidOperationException("The legacy workspace already has an owner.");
            if (!legacy) {
                await Run($"CREATE SCHEMA [{Schema}]");
                await Run(Scope(File.ReadAllText(Path.Combine(env.ContentRootPath,"Sql","003_workspace_template.sql"))));
            }
            await Run(Scope(File.ReadAllText(Path.Combine(env.ContentRootPath,"Sql","004_uploads.sql"))));
            if(legacy)await Run("INSERT dbo.WorkspaceLibrary(MatchId) SELECT MatchId FROM dbo.Matches;");
            await Run("INSERT dbo.WorkspaceAccounts(AccountKey,SchemaName) VALUES(@id,@schema)",("@id",Id),("@schema",Schema));
        }
        await Run(Scope(File.ReadAllText(Path.Combine(env.ContentRootPath,"Sql","006_manual_matches.sql"))));
        await Run(Scope(File.ReadAllText(Path.Combine(env.ContentRootPath,"Sql","007_account_profile.sql"))));
        await Run("IF OBJECT_ID('dbo.CatalogLinks','U') IS NULL CREATE TABLE dbo.CatalogLinks(Id int NOT NULL PRIMARY KEY CHECK(Id=1),Revision int NOT NULL,Payload nvarchar(max) NOT NULL,UpdatedBy char(64) NOT NULL,UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());");
        await tx.CommitAsync(http.RequestAborted);
    }
}
