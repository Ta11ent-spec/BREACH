using System.Text.Json;
using Microsoft.Data.SqlClient;
namespace Breach.Intel.Api;

public sealed record MapLink(string CollectorId,string Map);
public sealed record SiteLink(string Map,string Alias,string Site);
public sealed record CatalogLinks(int Revision,MapLink[] Maps,SiteLink[] Sites);
public static class CatalogEndpoints
{
    static readonly HashSet<string> Maps=["Bank","Border","Chalet","Club House","Coastline","Consulate","Emerald Plains","Fortress","Kafe Dostoyevsky","Kanal","Lair","Nighthaven Labs","Oregon","Outback","Skyscraper","Theme Park","Villa","Calypso Casino","House","Hereford Base","Presidential Plane","Yacht","Tower","Favela","Stadium Bravo","Stadium 2020","Bartlett University"];
    static bool Text(string? s,int max)=>!string.IsNullOrWhiteSpace(s)&&s.Length<=max&&!s.Any(char.IsControl)&&s==s.Trim();
    public static string? Validate(CatalogLinks p){
        if(p.Revision<0||p.Revision==int.MaxValue||p.Maps is null||p.Sites is null||p.Maps.Length>500||p.Sites.Length>2000)return "Invalid catalog size or revision.";
        if(p.Maps.Any(m=>m is null||!Text(m.CollectorId,30)||!m.CollectorId.All(char.IsAsciiDigit)||!Text(m.Map,80)||!Maps.Contains(m.Map))||p.Maps.Select(m=>m.CollectorId).Distinct().Count()!=p.Maps.Length)return "Use one map link per numeric collector ID.";
        if(p.Sites.Any(s=>s is null||!Text(s.Map,80)||!Maps.Contains(s.Map)||!Text(s.Alias,150)||!Text(s.Site,150))||p.Sites.Select(s=>s.Map.ToLowerInvariant()+"\n"+s.Alias.ToLowerInvariant()).Distinct().Count()!=p.Sites.Length)return "Use one site link per map and original site label.";
        return null;
    }
    public static async Task<bool> CanEdit(Workspace w)=>await w.RoleAsync() is "Owner" or "Admin";
    public static void MapCatalogLinks(this WebApplication app){
        var group=app.MapGroup("/api/catalog-links");
        group.AddEndpointFilter(async(c,next)=>{
            if(c.HttpContext.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            try{return await next(c);}catch(SqlException){return Results.Problem("Map linking storage is unavailable.",statusCode:503);}
        });
        group.MapGet("",async(Workspace w)=>{
            await using var db=w.Connection();await db.OpenAsync();
            await using var cmd=new SqlCommand("SELECT Payload FROM dbo.CatalogLinks WHERE Id=1",db);
            var json=await cmd.ExecuteScalarAsync();
            var links=json is string s?JsonSerializer.Deserialize<CatalogLinks>(s,ManualEndpoints.Json)!:new CatalogLinks(0,[],[]);
            return Results.Ok(new{links.Revision,links.Maps,links.Sites,canEdit=await CanEdit(w)});
        });
        group.MapPut("",async(HttpContext h,Workspace w)=>{
            if(!await CanEdit(w))return Results.StatusCode(403);
            if(h.Request.Headers["X-Breach-Request"]!="catalog-links")return Results.BadRequest();
            if(!h.Request.HasJsonContentType())return Results.StatusCode(415);
            using var body=new MemoryStream();var buffer=new byte[8192];int count;
            while((count=await h.Request.Body.ReadAsync(buffer,h.RequestAborted))>0){if(body.Length+count>1000000)return Results.StatusCode(413);body.Write(buffer,0,count);}
            CatalogLinks? p;
            try{p=JsonSerializer.Deserialize<CatalogLinks>(body.ToArray(),ManualEndpoints.Json);}catch(JsonException){return Results.BadRequest();}
            if(p is null)return Results.BadRequest();
            return await Save(p,w,h.RequestAborted);
        });
        group.MapGet("/history",async(Workspace w,SqlStore store)=>{
            if(!await CanEdit(w))return Results.StatusCode(403);
            return Results.Ok(await store.ReadAsync("SELECT TOP(50) Revision AS revision,Actor AS actor,Payload AS payload,ChangedAt AS changedAt FROM dbo.CatalogAudit ORDER BY Revision DESC"));
        });
    }
    public static async Task<IResult> Save(CatalogLinks p,Workspace w,CancellationToken ct){
        if(!await CanEdit(w))return Results.StatusCode(403);
            var error=Validate(p);if(error!=null)return Results.BadRequest(new{message=error});
            await using var db=w.Connection();await db.OpenAsync(ct);
            await using var tx=(SqlTransaction)await db.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
            // Hold the role read until commit so revocation cannot race a catalog write.
            if(!w.IsOwner){
                await using var access=new SqlCommand("SELECT Role FROM dbo.AccountRoles WITH(HOLDLOCK) WHERE AccountKey=@id",db,tx);
                access.Parameters.AddWithValue("@id",w.Id);
                if(await access.ExecuteScalarAsync(ct) as string!="Admin")return Results.StatusCode(403);
            }
            await using var read=new SqlCommand("SELECT Revision FROM dbo.CatalogLinks WITH(UPDLOCK,HOLDLOCK) WHERE Id=1",db,tx);
            var revision=await read.ExecuteScalarAsync(ct);
            if((revision is int n?n:0)!=p.Revision)return Results.Conflict(new{message="Links changed in another tab. Reload before saving."});
            var next=p with{Revision=p.Revision+1};
            await using var write=new SqlCommand(revision is null?"INSERT dbo.CatalogLinks(Id,Revision,Payload,UpdatedBy) VALUES(1,@revision,@json,@by)":"UPDATE dbo.CatalogLinks SET Revision=@revision,Payload=@json,UpdatedBy=@by,UpdatedAt=SYSUTCDATETIME() WHERE Id=1",db,tx);
            write.Parameters.AddWithValue("@revision",next.Revision);write.Parameters.AddWithValue("@json",JsonSerializer.Serialize(next,ManualEndpoints.Json));write.Parameters.AddWithValue("@by",w.Id);
                        await write.ExecuteNonQueryAsync(ct);
            await using var audit=new SqlCommand("INSERT dbo.CatalogAudit(Revision,Actor,Payload) VALUES(@revision,@actor,@payload)",db,tx);
            audit.Parameters.AddWithValue("@revision",next.Revision);audit.Parameters.AddWithValue("@actor",w.Id);audit.Parameters.AddWithValue("@payload",JsonSerializer.Serialize(next,ManualEndpoints.Json));await audit.ExecuteNonQueryAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(new{next.Revision,next.Maps,next.Sites,canEdit=true});
    }

}
