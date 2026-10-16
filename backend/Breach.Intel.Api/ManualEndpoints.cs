using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualPlayer(string PlayerId,string Username,int TeamIndex);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualPlayerStats(string PlayerId,string Operator,int? Kills,bool? Died,int? Assists,int? Headshots,ImpactStats? Impact=null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualRound(string Side, string Operator, string Site, bool? Won, int? Kills, bool? Died, int? Assists, int? Headshots, string Notes, ManualPlayerStats[]? Players=null,ImpactStats? Impact=null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualSummaryPlayer(string PlayerId,int? Kills,int? Deaths,int? Assists,int? Headshots,ImpactStats? Impact=null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualSummary(int Wins,int Losses,ManualSummaryPlayer[] Players);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualMatch(string PlayerId, string Username, string Platform, string Map, string Mode, int Target, DateTimeOffset PlayedAt, string Notes, ManualRound[] Rounds, ManualPlayer[]? Roster=null,ManualSummary? Summary=null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ManualWrite(int Revision, string Status, ManualMatch Payload);
public sealed record SharedManualRecord(string Id, int Revision, string Status, string Payload, DateTime UpdatedAt);

public static class ManualEndpoints
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static string? Validate(ManualWrite input)
    {
        var p=input.Payload;
        if(input.Revision<0 || input.Revision==int.MaxValue || input.Status is not ("draft" or "submitted") || p is null) return "Invalid draft revision or status.";
        bool Text(string? s,int max)=>s is not null && s.Length<=max && !s.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r'&&c!='\t');
        if(!Text(p.PlayerId,100)||!Text(p.Username,100)||!Text(p.Map,100)||!Text(p.Notes,4000)||p.Platform is not ("PC" or "PlayStation" or "Xbox") || p.Mode is not ("Ranked Bomb" or "Unranked Bomb" or "Standard Bomb" or "Casual Bomb" or "Custom Bomb") || p.Target is <1 or >12 || p.PlayedAt.Year<2000 || p.PlayedAt>DateTimeOffset.UtcNow.AddMinutes(5) || p.Rounds is null || p.Rounds.Length>23) return "Check player, platform, map, date and match format.";
        if(p.Roster is not null){
            if(p.Roster.Length!=10 || p.Roster.Any(x=>x is null || !Text(x.PlayerId,100)||!Text(x.Username,100)||x.TeamIndex is <0 or >1) || p.Roster.Count(x=>x.TeamIndex==0)!=5 || p.Roster.Count(x=>x.TeamIndex==1)!=5 || p.Roster.Select(x=>x.PlayerId).Distinct(StringComparer.Ordinal).Count()!=10)return "Choose ten distinct players, five on each team.";
            if(input.Status=="submitted" && p.Roster.Any(x=>string.IsNullOrWhiteSpace(x.PlayerId)||string.IsNullOrWhiteSpace(x.Username)))return "Name or select all ten players before submitting.";
        }
        if(p.Summary is {} summary){
            var n=summary.Wins+summary.Losses;var high=Math.Max(summary.Wins,summary.Losses);var low=Math.Min(summary.Wins,summary.Losses);
            if(p.Roster is null || p.Rounds.Length!=0 || summary.Wins<0||summary.Losses<0||high>12||summary.Players is null||summary.Players.Length!=10||summary.Players.Any(x=>x is null)||summary.Players.Select(x=>x.PlayerId).Distinct(StringComparer.Ordinal).Count()!=10||summary.Players.Any(x=>!p.Roster.Any(r=>r.PlayerId==x.PlayerId)))return "Check scoreboard players and final score.";
            foreach(var x in summary.Players){
                var team=p.Roster.First(r=>r.PlayerId==x.PlayerId).TeamIndex;
                if(ImpactStats.Validate(x.Impact,n,x.Kills,x.Deaths,team==0?summary.Wins:summary.Losses) is {} impactError)return impactError;
                if(x.Kills is <0||x.Deaths is <0||x.Assists is <0||x.Headshots is <0||x.Kills>5*n||x.Assists>5*n||x.Headshots>5*n||x.Deaths>n||x.Headshots is not null&&(x.Kills is null||x.Headshots>x.Kills))return "Scoreboard statistics exceed the match limits.";
            }
            if(ImpactStats.Group(summary.Players.Select(x=>(p.Roster.First(r=>r.PlayerId==x.PlayerId).TeamIndex,x.Impact)).ToArray(),n) is {} groupError)return groupError;
            foreach(var team in new[]{0,1})if(summary.Players.Where(x=>p.Roster.First(r=>r.PlayerId==x.PlayerId).TeamIndex==team).Sum(x=>x.Impact?.Clutches.Sum(n=>n??0)??0)>(team==0?summary.Wins:summary.Losses))return "Team clutch wins exceed won rounds.";
            var endedScore=(p.Mode is "Ranked Bomb" or "Unranked Bomb")?high==4&&low<=2||high==5&&low>=3&&low<=4:high==(p.Mode=="Casual Bomb"?3:p.Mode=="Standard Bomb"?4:p.Target)&&low<(p.Mode=="Casual Bomb"?3:p.Mode=="Standard Bomb"?4:p.Target);
            if(input.Status=="submitted"&&(!endedScore||string.IsNullOrWhiteSpace(p.Map)))return "Enter a complete final score and map.";
            return null;
        }
        int wins=0,losses=0;bool ended=false;
        foreach(var r in p.Rounds){
            if(r is null || !Text(r.Operator,100)||!Text(r.Site,100)||!Text(r.Notes,2000)||r.Side is not ("Attack" or "Defense") || r.Kills is <0 or >5 || r.Assists is <0 or >5 || r.Headshots is <0 or >5 || r.Headshots is not null && (r.Kills is null || r.Headshots>r.Kills)) return "Round stats must be 0–5. Headshots require kills and cannot exceed them.";
            if(p.Roster is not null){
                if(r.Players is null || r.Players.Length!=10 || r.Players.Any(x=>x is null) || r.Players.Select(x=>x.PlayerId).Distinct(StringComparer.Ordinal).Count()!=10 || r.Players.Any(x=>!p.Roster.Any(p=>p.PlayerId==x.PlayerId)))return "Every round must contain the same ten roster players.";
                if(r.Players.Any(x=>!Text(x.Operator,100)||x.Kills is <0 or >5||x.Assists is <0 or >5||x.Headshots is <0 or >5||x.Headshots is not null&&(x.Kills is null||x.Headshots>x.Kills)))return "Check round statistics for all players. Headshots cannot exceed kills.";
            }else if(r.Players is not null)return "Round players require a match roster.";
            if(r.Players is not null&&p.Roster is not null){
                foreach(var x in r.Players){var team=p.Roster.First(p=>p.PlayerId==x.PlayerId).TeamIndex;var won=r.Won is null?(int?)null:(r.Won==(team==0)?1:0);if(ImpactStats.Validate(x.Impact,1,x.Kills,x.Died is null?null:x.Died==true?1:0,won) is {} error)return error;}
                if(ImpactStats.Group(r.Players.Select(x=>(p.Roster.First(p=>p.PlayerId==x.PlayerId).TeamIndex,x.Impact)).ToArray(),1) is {} error2)return error2;
            }else if(ImpactStats.Validate(r.Impact,1,r.Kills,r.Died is null?null:r.Died==true?1:0,r.Won is null?null:r.Won==true?1:0) is {} error3)return error3;
            if(input.Status=="submitted" && (ended||r.Won is null)) return "Each round needs a result, and no rounds may follow a match-ending score.";
            if(r.Won==true)wins++;else if(r.Won==false)losses++;
            ended=(p.Mode is "Ranked Bomb" or "Unranked Bomb") ? Math.Max(wins,losses)>=5 || Math.Max(wins,losses)>=4&&Math.Abs(wins-losses)>=2 : Math.Max(wins,losses)>=(p.Mode=="Casual Bomb"?3:p.Mode=="Standard Bomb"?4:p.Target);
        }
        if(input.Status=="submitted" && ((p.Roster is null&&(string.IsNullOrWhiteSpace(p.PlayerId)||string.IsNullOrWhiteSpace(p.Username)))||string.IsNullOrWhiteSpace(p.Map)||!ended))return "Select a player and map, then record a complete match score before submitting.";
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
        group.MapGet("/shared",async(Workspace w,HttpContext h)=>Results.Ok(await ReadShared(w,h.RequestAborted)));
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
    // Read the registered workspaces only. The editing API remains owner-scoped.
    // Existing submissions are included without copying records or changing ownership.
    public static async Task<List<SharedManualRecord>> ReadShared(Workspace w,CancellationToken ct)
    {
        if(string.IsNullOrEmpty(w.Id))throw new UnauthorizedAccessException();
        await using var db=w.Connection();await db.OpenAsync(ct);
        var sources=new List<(string Key,string Schema)>();
        await using(var registry=new SqlCommand("SELECT AccountKey,SchemaName FROM dbo.WorkspaceAccounts WHERE OBJECT_ID(QUOTENAME(SchemaName)+'.ManualMatches','U') IS NOT NULL",db))
        await using(var reader=await registry.ExecuteReaderAsync(ct))
            while(await reader.ReadAsync(ct)){
                var key=reader.GetString(0);var schema=reader.GetString(1);
                if(!System.Text.RegularExpressions.Regex.IsMatch(key,"\\A[a-f0-9]{64}\\z") ||
                   (schema!="dbo" && schema!="w_"+key))throw new InvalidOperationException("Invalid workspace registry.");
                sources.Add((key,schema));
            }
        var rows=new List<SharedManualRecord>();
        if(sources.Count==0)return rows;
        await using var query=new SqlCommand(){Connection=db,CommandTimeout=60};
        query.CommandText=string.Join(" UNION ALL ",sources.Select((source,i)=>{
            query.Parameters.AddWithValue("@owner"+i,source.Key);
            return $"SELECT @owner{i}+':'+CONVERT(varchar(36),Id) AS Id,Revision,Payload,UpdatedAt FROM [{source.Schema}].ManualMatches WHERE Status='submitted'";
        }))+" ORDER BY UpdatedAt DESC,Id";
        await using var data=await query.ExecuteReaderAsync(ct);
        while(await data.ReadAsync(ct)){
            var payload=JsonSerializer.Deserialize<ManualMatch>(data.GetString(2),Json) ?? throw new InvalidOperationException("Invalid manual record.");
            // Match and round notes are private even after the stats are submitted.
            payload=payload with{Notes="",Rounds=payload.Rounds.Select(r=>r with{Notes=""}).ToArray()};
            rows.Add(new(data.GetString(0),data.GetInt32(1),"submitted",JsonSerializer.Serialize(payload,Json),data.GetDateTime(3)));
        }
        return rows;
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
        var canonical=new List<ManualPlayer>();
        foreach(var player in p.Roster??[new(p.PlayerId,p.Username,0)]){
            if(string.IsNullOrEmpty(player.PlayerId)){canonical.Add(player);continue;}
            if(player.PlayerId.StartsWith("manual-player:",StringComparison.Ordinal)){
                if(!Guid.TryParse(player.PlayerId[14..],out _))return Results.BadRequest(new{message="Invalid manual player identifier."});
                canonical.Add(player);
            }else{
                var name=await Run("SELECT Username FROM dbo.Players WHERE PlayerId=@player",("@player",player.PlayerId));
                if(name is null)return Results.BadRequest(new{message="Choose an existing recorded player or create a manual profile."});
                canonical.Add(player with{Username=(string)name});
            }
        }
        p=p with{PlayerId=canonical[0].PlayerId,Username=canonical[0].Username,Roster=p.Roster is null?null:canonical.ToArray()};
        payload=JsonSerializer.Serialize(p,Json);
        if(revision is null)await Run("INSERT dbo.ManualMatches(Id,Revision,Status,Payload) VALUES(@id,1,@status,@payload)",("@id",id),("@status",input.Status),("@payload",payload));
        else await Run("UPDATE dbo.ManualMatches SET Revision=Revision+1,Status=@status,Payload=@payload,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id",("@id",id),("@status",input.Status),("@payload",payload));
        await tx.CommitAsync(ct);
        return Results.Ok(new{id,revision=input.Revision+1,status=input.Status,payload});
    }
}
