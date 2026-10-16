using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;
namespace Breach.Intel.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record RoleWrite(string Role,int Revision);
public static class PermissionEndpoints {
    public static void MapPermissions(this WebApplication app) {
        var group=app.MapGroup("/api/permissions");
        group.AddEndpointFilter(async(c,next)=>{
            if(c.HttpContext.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            try{return await next(c);}catch(SqlException){return Results.Problem("Permissions storage is unavailable.",statusCode:503);}
        });
        group.MapGet("",async(Workspace w,CancellationToken ct)=>Results.Ok(new{accountId=w.Id,role=await w.RoleAsync(ct),canManagePermissions=w.IsOwner}));
        group.MapGet("/accounts",async(Workspace w,CancellationToken ct)=>{
            if(!w.IsOwner)return Results.StatusCode(403);
            await using var db=w.Connection();await db.OpenAsync(ct);
            await using var cmd=new SqlCommand("SELECT a.AccountKey,COALESCE(r.Role,'Player'),COALESCE(r.Revision,0),a.CreatedAt FROM dbo.WorkspaceAccounts a LEFT JOIN dbo.AccountRoles r ON r.AccountKey=a.AccountKey ORDER BY a.CreatedAt",db);
            await using var reader=await cmd.ExecuteReaderAsync(ct);var rows=new List<object>();
            while(await reader.ReadAsync(ct)){var id=reader.GetString(0);rows.Add(new{accountId=id,role=id==w.OwnerAccountKey?"Owner":reader.GetString(1),revision=reader.GetInt32(2),createdAt=reader.GetDateTime(3)});}
            return Results.Ok(rows);
        });
        group.MapGet("/history",async(Workspace w,SqlStore store)=>{
            if(!w.IsOwner)return Results.StatusCode(403);
            return Results.Ok(await store.ReadAsync("SELECT TOP(100) Id AS id,Actor AS actor,Target AS target,PreviousRole AS previousRole,NewRole AS newRole,ChangedAt AS changedAt FROM dbo.PermissionAudit ORDER BY Id DESC"));
        });
        group.MapPut("/accounts/{id}",async(string id,HttpContext h,Workspace w)=>{
            if(!w.IsOwner)return Results.StatusCode(403);
            if(h.Request.Headers["X-Breach-Request"]!="permissions"||!h.Request.HasJsonContentType())return Results.BadRequest();
            using var body=new MemoryStream();var buffer=new byte[1024];int n;
            while((n=await h.Request.Body.ReadAsync(buffer,h.RequestAborted))>0){if(body.Length+n>4096)return Results.StatusCode(413);body.Write(buffer,0,n);}
            try{var p=JsonSerializer.Deserialize<RoleWrite>(body.ToArray(),ManualEndpoints.Json);return p is null?Results.BadRequest():await Save(id,p,w,h.RequestAborted);}catch(JsonException){return Results.BadRequest();}
        });
    }
    public static async Task<IResult> Save(string id,RoleWrite p,Workspace w,CancellationToken ct) {
        if(!w.IsOwner)return Results.StatusCode(403);
        if(id==w.OwnerAccountKey)return Results.BadRequest(new{message="The sole Owner role cannot be changed here."});
        if(id.Length!=64||!id.All(c=>char.IsAsciiHexDigit(c)&&!char.IsUpper(c))||p.Role is not ("Admin" or "Player")||p.Revision<0||p.Revision==int.MaxValue)return Results.BadRequest();
        await using var db=w.Connection();await db.OpenAsync(ct);
        await using var tx=(SqlTransaction)await db.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
        await using var account=new SqlCommand("SELECT AccountKey FROM dbo.WorkspaceAccounts WHERE AccountKey=@id",db,tx);account.Parameters.AddWithValue("@id",id);
        if(await account.ExecuteScalarAsync(ct) is null)return Results.NotFound();
        await using var read=new SqlCommand("SELECT Role,Revision FROM dbo.AccountRoles WITH(UPDLOCK,HOLDLOCK) WHERE AccountKey=@id",db,tx);read.Parameters.AddWithValue("@id",id);
        string previous="Player";int revision=0;
        await using(var r=await read.ExecuteReaderAsync(ct)){if(await r.ReadAsync(ct)){previous=r.GetString(0);revision=r.GetInt32(1);}}
        if(revision!=p.Revision)return Results.Conflict(new{message="Permissions changed. Reload before saving."});
        if(previous!=p.Role){
            await using var write=new SqlCommand(revision==0?"INSERT dbo.AccountRoles(AccountKey,Role,Revision) VALUES(@id,@role,1)":"UPDATE dbo.AccountRoles SET Role=@role,Revision=Revision+1 WHERE AccountKey=@id",db,tx);write.Parameters.AddWithValue("@id",id);write.Parameters.AddWithValue("@role",p.Role);await write.ExecuteNonQueryAsync(ct);
            await using var audit=new SqlCommand("INSERT dbo.PermissionAudit(Actor,Target,PreviousRole,NewRole) VALUES(@actor,@id,@old,@new)",db,tx);audit.Parameters.AddWithValue("@actor",w.Id);audit.Parameters.AddWithValue("@id",id);audit.Parameters.AddWithValue("@old",previous);audit.Parameters.AddWithValue("@new",p.Role);await audit.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);return Results.Ok(new{role=p.Role});
    }
}
