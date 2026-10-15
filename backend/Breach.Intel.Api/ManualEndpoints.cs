using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualRound(string Side, string Operator, string Site, bool? Won, int? Kills, bool? Died, int? Assists, int? Headshots, string Notes);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualMatch(string PlayerId, string Username, string Platform, string Map, string Mode, int Target, DateTimeOffset PlayedAt, string Notes, ManualRound[] Rounds);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualWrite(int Revision, string Status, ManualMatch Payload);

public static class ManualEndpoints
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string? Validate(ManualWrite input)
    {
        var p=input.Payload;
        if(input.Revision<0 || input.Revision==int.MaxValue || input.Status is not ("draft" or "submitted") || p is null) return "Invalid draft revision or status.";
        bool Text(string? s,int max)=>s is not null && s.Length<=max && !s.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r'&&c!='\t');
        if(!Text(p.PlayerId,100)||!Text(p.Username,100)||!Text(p.Map,100)||!Text(p.Notes,4000)||p.Platform is not ("PC" or "PlayStation" or "Xbox") || p.Mode is not ("Ranked Bomb" or "Custom Bomb") || p.Target is <1 or >12 || p.PlayedAt.Year<2000 || p.PlayedAt>DateTimeOffset.UtcNow.AddMinutes(5) || p.Rounds is null || p.Rounds.Length>23) return "Check player, platform, map, date and match format.";
        int wins=0,losses=0;bool ended=false;
        foreach(var r in p.Rounds){
            if(r is null || !Text(r.Operator,100)||!Text(r.Site,100)||!Text(r.Notes,2000)||r.Side is not ("Attack" or "Defense") || r.Kills is <0 or >5 || r.Assists is <0 or >5 || r.Headshots is <0 or >5 || r.Headshots is not null && (r.Kills is null || r.Headshots>r.Kills)) return "Round stats must be 0–5. Headshots require kills and cannot exceed them.";
            if(input.Status=="submitted" && (ended||r.Won is null)) return "Each round needs a result, and no rounds may follow a match-ending score.";
            if(r.Won==true)wins++;else if(r.Won==false)losses++;
            ended=p.Mode=="Ranked Bomb" ? Math.Max(wins,losses)>=5 || Math.Max(wins,losses)>=4&&Math.Abs(wins-losses)>=2 : Math.Max(wins,losses)>=p.Target;
        }
        if(input.Status=="submitted" && (string.IsNullOrWhiteSpace(p.PlayerId)||string.IsNullOrWhiteSpace(p.Username)||string.IsNullOrWhiteSpace(p.Map)||!ended))return "Select a player and map, then record a complete match score before submitting.";
        return null;
    }
    public static void MapManualMatches(this WebApplication app)
    {
        var group=app.MapGroup("/api/manual-matches");
        group.AddEndpointFilter(async(context,next)=>{
            if(context.HttpContext.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            if(!HttpMethods.IsGet(context.HttpContext.Request.Method) && context.HttpContext.Request.Headers["X-Breach-Request"]!="manual")return Results.BadRequest(new{message="Missing manual request header."});
            try{return await next(context);}catch(SqlException){return Results.Problem("Manual match storage is unavailable. Your unsaved draft can be retried.",statusCode:503);}
        });
        group.MapGet("",async(SqlStore db)=>Results.Ok(await db.ReadAsync("SELECT Id AS id,Revision AS revision,Status AS status,Payload AS payload,UpdatedAt AS updatedAt FROM dbo.ManualMatches ORDER BY UpdatedAt DESC")));
        group.MapDelete("/{id:guid}",async(Guid id,int revision,Workspace w,HttpContext h)=>await Delete(id,revision,w,h.RequestAborted));
        group.MapPut("/{id:guid}",async(Guid id,Workspace w,HttpContext h)=>{
            if(!h.Request.HasJsonContentType())return Results.StatusCode(415);
            using var body=new MemoryStream();var buffer=new byte[8192];int count;
            while((count=await h.Request.Body.ReadAsync(buffer,h.RequestAborted))>0){
                if(body.Length+count>131072)return Results.StatusCode(413);
                body.Write(buffer,0,count);
            }
            try{
                var input=JsonSerializer.Deserialize<ManualWrite>(body.ToArray(),Json);
                if(input is null||id==Guid.Empty)return Results.BadRequest(new{message="Invalid manual match request."});
                return await Save(id,input,w,h.RequestAborted);
            }catch(JsonException){return Results.BadRequest(new{message="Invalid manual match JSON. Use the match form and numeric whole-number stats."});}
        });
    }
    public static async Task<IResult> Delete(Guid id,int revision,Workspace w,CancellationToken ct)
    {
        if(revision<1)return Results.BadRequest();
        await using var db=w.Connection();await db.OpenAsync(ct);
        await using var command=new SqlCommand(w.Scope("DELETE FROM dbo.ManualMatches WHERE Id=@id AND Revision=@revision AND Status='draft'"),db);
        command.Parameters.AddWithValue("@id",id);command.Parameters.AddWithValue("@revision",revision);
        if(await command.ExecuteNonQueryAsync(ct)==1)return Results.NoContent();
        await using var exists=new SqlCommand(w.Scope("SELECT COUNT(*) FROM dbo.ManualMatches WHERE Id=@id"),db);exists.Parameters.AddWithValue("@id",id);
        return (int)(await exists.ExecuteScalarAsync(ct))! ==0?Results.NotFound():Results.Conflict(new{message="The draft changed or was submitted. Reload saved matches before deleting."});
    }
    public static async Task<IResult> Save(Guid id,ManualWrite input,Workspace w,CancellationToken ct)
    {
        var error=Validate(input);if(error is not null)return Results.BadRequest(new{message=error});
        await using var db=w.Connection();await db.OpenAsync(ct);
        await using var tx=(SqlTransaction)await db.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
        async Task<object?> Run(string sql,params(string,object?)[] args){await using var c=new SqlCommand(w.Scope(sql),db,tx);foreach(var(k,v)in args)c.Parameters.AddWithValue(k,v??DBNull.Value);return await c.ExecuteScalarAsync(ct);}
        var revision=await Run("SELECT Revision FROM dbo.ManualMatches WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id",("@id",id));
        var status=revision is null?null:await Run("SELECT Status FROM dbo.ManualMatches WHERE Id=@id",("@id",id));
        var payload=JsonSerializer.Serialize(input.Payload,Json);
        if(revision is not null && (int)revision!=input.Revision){
            // An identical retry after a lost acknowledgement is safe; different edits conflict.
            var old=await Run("SELECT Payload FROM dbo.ManualMatches WHERE Id=@id",("@id",id));
            if((int)revision==input.Revision+1 && (string?)status==input.Status && (string?)old==payload){await tx.CommitAsync(ct);return Results.Ok(new{id,revision,status=input.Status,payload});}
            return Results.Conflict(new{message="This draft changed in another tab. Reload it before editing; your recovery copy is retained."});
        }
        if(revision is null&&input.Revision!=0)return Results.NotFound();
        if((string?)status=="submitted")return Results.Conflict(new{message="Submitted matches are read-only. Create a new draft for another match."});
        var p=input.Payload;
        if(!string.IsNullOrEmpty(p.PlayerId)){
            if(p.PlayerId.StartsWith("manual-player:",StringComparison.Ordinal)){
                if(!Guid.TryParse(p.PlayerId[14..],out _))return Results.BadRequest(new{message="Invalid manual player identifier."});
            }else{
                var name=await Run("SELECT Username FROM dbo.Players WHERE PlayerId=@player",("@player",p.PlayerId));
                if(name is null)return Results.BadRequest(new{message="Choose an existing recorded player or create a manual profile."});
                // Preserve the canonical display name, never rename a shared player through a manual form.
                p=p with{Username=(string)name};payload=JsonSerializer.Serialize(p,Json);
            }
        }
        if(revision is null)await Run("INSERT dbo.ManualMatches(Id,Revision,Status,Payload) VALUES(@id,1,@status,@payload)",("@id",id),("@status",input.Status),("@payload",payload));
        else await Run("UPDATE dbo.ManualMatches SET Revision=Revision+1,Status=@status,Payload=@payload,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id",("@id",id),("@status",input.Status),("@payload",payload));
        await tx.CommitAsync(ct);
        return Results.Ok(new{id,revision=input.Revision+1,status=input.Status,payload});
    }
}
