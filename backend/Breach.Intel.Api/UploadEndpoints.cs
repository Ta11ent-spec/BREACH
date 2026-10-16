using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace Breach.Intel.Api;
public static class UploadEndpoints
{
    public static async Task<bool> CanAccessWorkspace(Workspace w,CancellationToken ct=default)=>await w.RoleAsync(ct) is "Owner" or "Admin";
    public static void MapUploads(this WebApplication app)
    {
        using var document=JsonDocument.Parse(File.ReadAllText(Path.Combine(app.Environment.ContentRootPath,"Contracts","collector-v1.schema.json")));
        var schema=document.RootElement.Clone();
        var workspace=app.MapGroup("/api/workspace");
        workspace.AddEndpointFilter(async(context,next)=>{
            if(context.HttpContext.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            var w=context.HttpContext.RequestServices.GetRequiredService<Workspace>();
            if(!await CanAccessWorkspace(w,context.HttpContext.RequestAborted))return Results.StatusCode(403);
            return await next(context);
        });
        workspace.MapGet("",async(SqlStore db,Workspace w)=>Results.Ok(new {
            workspaceId=w.Id, name="My Workspace", privacy="private",
            summary=(await db.ReadAsync("SELECT (SELECT COUNT(*) FROM dbo.WorkspaceLibrary) AS matches,(SELECT COUNT(*) FROM dbo.Squads) AS squads,(SELECT COUNT(*) FROM dbo.UploadReceipts) AS receipts,(SELECT MAX(ReceivedAt) FROM dbo.UploadReceipts) AS lastUpload"))[0],
            collectors=await db.ReadAsync("SELECT InstallationId AS id,Version AS version,LastSeen AS lastSeen,RevokedAt AS revokedAt FROM dbo.CollectorConnections ORDER BY LastSeen DESC"),
            uploads=await db.ReadAsync("SELECT TOP(50) MessageId AS messageId,MatchId AS matchId,Outcome AS outcome,ReceivedAt AS receivedAt FROM dbo.UploadReceipts ORDER BY ReceivedAt DESC"),
            matches=await db.ReadAsync("SELECT TOP(30) m.MatchId AS matchId,MapName AS mapName,FirstRecordedAt AS playedAt FROM dbo.Matches m JOIN dbo.WorkspaceLibrary l ON l.MatchId=m.MatchId ORDER BY FirstRecordedAt DESC")
        }));
        workspace.MapDelete("/collectors/{id:guid}",async(Guid id,SqlStore db)=> {
            await db.ReadAsync("UPDATE dbo.CollectorConnections SET RevokedAt=SYSUTCDATETIME() WHERE InstallationId=@id",("@id",id));return Results.NoContent();
        });
        workspace.MapPost("/collectors/{id:guid}/enable",async(Guid id,SqlStore db)=> {
            await db.ReadAsync("UPDATE dbo.CollectorConnections SET RevokedAt=NULL WHERE InstallationId=@id",("@id",id));return Results.NoContent();
        });
        app.MapPost("/api/collector/matches",async(HttpContext http,Workspace w)=> {
            if(http.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            if(!http.Request.HasJsonContentType())return Results.Json(new{message="Send application/json."},statusCode:415);
            const int max=4*1024*1024;
            if(http.Request.ContentLength>max)return Results.StatusCode(413);
            try {
                using var body=new MemoryStream();var buffer=new byte[16384];int read;
                while((read=await http.Request.Body.ReadAsync(buffer,http.RequestAborted))>0){if(body.Length+read>max)return Results.StatusCode(413);body.Write(buffer,0,read);}
                using var parsed=JsonDocument.Parse(body.ToArray(),new JsonDocumentOptions{MaxDepth=32});var e=parsed.RootElement;
                CollectorContract.Validate(e,schema);
                return await Save(e,w,http.RequestAborted);
            }catch(ContractException ex){return Results.Json(new{message=ex.Message},statusCode:422);}
            catch(JsonException){return Results.BadRequest(new{message="Invalid JSON."});}
            catch(SqlException){return Results.Json(new{message="Storage is temporarily unavailable. The collector will retry."},statusCode:503);}
        });
    }
    private static object? V(JsonElement item,string key) {
        if(!item.TryGetProperty(key,out var v)||v.ValueKind==JsonValueKind.Null)return null;
        return v.ValueKind switch{JsonValueKind.String=>v.GetString(),JsonValueKind.True=>true,JsonValueKind.False=>false,JsonValueKind.Number=>v.GetDecimal(),_=>v.GetRawText()};
    }
    public static async Task<IResult> Save(JsonElement e,Workspace w,CancellationToken cancel)
    {
        var p=e.GetProperty("payload");var m=p.GetProperty("match");var mid=m.GetProperty("matchId").GetString()!;
        var message=e.GetProperty("messageId").GetGuid();var hash=CollectorContract.Hash(p);var device=e.GetProperty("collector").GetProperty("installationId").GetGuid();
        await using var db=w.Connection();await db.OpenAsync(cancel);
        await using var tx=(SqlTransaction)await db.BeginTransactionAsync(IsolationLevel.Serializable,cancel);
        async Task<object?> Run(string sql,params (string,object?)[] args) {
            await using var cmd=new SqlCommand(w.Scope(sql),db,tx){CommandTimeout=30};
            foreach(var(k,v)in args)cmd.Parameters.AddWithValue(k,v??DBNull.Value);
            return await cmd.ExecuteScalarAsync(cancel);
        }
        await Run("DECLARE @r int; EXEC @r=sp_getapplock @Resource=N'breach-gameplay-upload',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @r<0 THROW 51000,'Upload busy',1;");
        var revoked=await Run("SELECT CASE WHEN RevokedAt IS NULL THEN 0 ELSE 1 END FROM dbo.CollectorConnections WHERE InstallationId=@id",("@id",device));
        if(revoked is int r&&r==1)return Results.Json(new{message="This collector connection was revoked. Re-enable it on the website."},statusCode:403);
        await Run("IF EXISTS(SELECT 1 FROM dbo.CollectorConnections WHERE InstallationId=@id) UPDATE dbo.CollectorConnections SET LastSeen=SYSUTCDATETIME(),Version=@version WHERE InstallationId=@id; ELSE INSERT dbo.CollectorConnections VALUES(@id,@version,SYSUTCDATETIME(),NULL);",("@id",device),("@version",V(e.GetProperty("collector"),"version")));
        var old=await Run("SELECT PayloadHash FROM dbo.UploadReceipts WHERE MessageId=@id",("@id",message));
        if(old is string previous) {
            if(previous!=hash)return Results.Conflict(new{message="Message ID already used for different content."});
            await tx.CommitAsync(cancel);return Results.Ok(new{messageId=message,matchId=mid,workspaceId=w.Id,status="duplicate",acknowledged=true});
        }
        var source=await Run("SELECT PayloadHash FROM dbo.GameplaySources WHERE MatchId=@match",("@match",mid));
        string outcome;
        if(source is string saved) {
            if(saved!=hash)return Results.Conflict(new{message="This match already exists with different content. Original data was retained."});
            outcome="duplicate";
        } else if(await Run("SELECT MatchId FROM dbo.Matches WHERE MatchId=@match",("@match",mid)) is not null) {
            // Imported before source envelopes existed. Do not claim byte-for-byte equality.
            // Existing data wins; the receipt explicitly reports preservation of that record.
            outcome="existing_preserved";
        } else {
            outcome="uploaded";
            await Run("INSERT dbo.Matches(MatchId,GameVersion,MatchType,GameMode,MapId,MapName,RecordingProfileId,FirstRecordedAt,LastRecordedAt,IsCompleteMatch,ImportedAt) VALUES(@id,@version,@type,@mode,@mapid,@map,@profile,@date,@date,1,SYSUTCDATETIME())",("@id",mid),("@version",V(e.GetProperty("source"),"gameVersion")),("@type",V(m,"matchType")),("@mode",V(m,"gameMode")),("@mapid",V(m,"mapId")),("@map",V(m,"mapName")),("@profile",V(m,"recordingProfileId")),("@date",V(m,"playedAt")));
            var rounds=p.GetProperty("rounds").EnumerateArray().OrderBy(r=>r.GetProperty("number").GetInt32()).ToArray();
            var ridMap=rounds.ToDictionary(r=>r.GetProperty("roundId").GetString()!,r=>CollectorContract.Uid(mid,r.GetProperty("number").GetInt32()-1));
            var scores=new int[2];
            foreach(var round in rounds) {
                var rid=ridMap[round.GetProperty("roundId").GetString()!];var number=round.GetProperty("number").GetInt32();
                await Run("INSERT dbo.MatchRounds(RoundId,MatchId,SourceRoundIndex,RoundNumber,Site,MapId,MapName) VALUES(@rid,@mid,@index,@number,@site,@mapid,@map)",("@rid",rid),("@mid",mid),("@index",number-1),("@number",number),("@site",V(round,"site")),("@mapid",V(m,"mapId")),("@map",V(m,"mapName")));
                foreach(var t in round.GetProperty("teams").EnumerateArray()) {
                    var slot=t.GetProperty("slot").GetInt32();var before=scores[slot];if(t.GetProperty("won").GetBoolean())scores[slot]++;
                    await Run("INSERT dbo.RoundTeams(RoundId,TeamSlot,Side,Won,ScoreBefore,ScoreAfter) VALUES(@r,@s,@side,@won,@before,@after)",("@r",rid),("@s",slot),("@side",V(t,"side")),("@won",V(t,"won")),("@before",before),("@after",scores[slot]));
                }
            }
            var players=p.GetProperty("players").EnumerateArray().ToDictionary(x=>x.GetProperty("playerId").GetString()!);
            foreach(var player in players.Values)await Run("IF NOT EXISTS(SELECT 1 FROM dbo.Players WHERE PlayerId=@id) INSERT dbo.Players(PlayerId,ProfileId,Username,UpdatedAt) VALUES(@id,@profile,@name,SYSUTCDATETIME())",("@id",V(player,"playerId")),("@profile",V(player,"profileId")),("@name",V(player,"username")));
            foreach(var a in p.GetProperty("appearances").EnumerateArray()) {
                var rid=ridMap[a.GetProperty("roundId").GetString()!];var pid=a.GetProperty("playerId").GetString()!;var stats=a.GetProperty("stats");
                await Run("INSERT dbo.RoundPlayers(RoundPlayerId,RoundId,PlayerId,TeamIndex,UsernameSnapshot,OperatorId,OperatorName,ScoreSnapshot,Kills,Died,Assists,Headshots,DamageDealt,DamageTaken) VALUES(@id,@r,@p,@team,@name,@opid,@op,@score,@kills,@died,@assists,@hs,@dealt,@taken)",("@id",CollectorContract.Uid(rid,pid)),("@r",rid),("@p",pid),("@team",V(a,"teamIndex")),("@name",V(players[pid],"username")),("@opid",V(a,"operatorId")),("@op",V(a,"operatorName")),("@score",V(stats,"scoreSnapshot")),("@kills",V(stats,"kills")),("@died",V(stats,"died")),("@assists",V(stats,"assists")),("@hs",V(stats,"headshots")),("@dealt",V(stats,"damageDealt")),("@taken",V(stats,"damageTaken")));
            }
            foreach(var ev in p.GetProperty("events").EnumerateArray()) {
                var rid=ridMap[ev.GetProperty("roundId").GetString()!];var sequence=ev.GetProperty("sequence").GetInt32();
                await Run("INSERT dbo.RoundEvents(EventId,RoundId,EventSequence,EventType,ActorUsername,TargetUsername,TimeRemainingSeconds,IsHeadshot,WeaponId,RawEventJson) VALUES(@id,@r,@seq,@type,@actor,@target,@time,@hs,@weapon,@raw)",("@id",CollectorContract.Uid(rid,sequence)),("@r",rid),("@seq",sequence),("@type",V(ev,"type")),("@actor",V(ev,"actorUsername")),("@target",V(ev,"targetUsername")),("@time",V(ev,"timeRemainingSeconds")),("@hs",V(ev,"headshot")),("@weapon",V(ev,"weaponId")),("@raw",ev.GetRawText()));
            }
            await Run("INSERT dbo.GameplaySources(MatchId,PayloadHash) VALUES(@match,@hash)",("@match",mid),("@hash",hash));
            var batch=await Run("INSERT dbo.ImportBatches(StartedAt,FinishedAt,ImporterVersion,Status,Notes) OUTPUT inserted.ImportBatchId VALUES(SYSUTCDATETIME(),SYSUTCDATETIME(),N'collector-v1',N'Completed',N'Authenticated collector upload')");
            foreach(var issue in p.GetProperty("issues").EnumerateArray())await Run("INSERT dbo.ImportIssues(ImportBatchId,MatchId,Severity,IssueCode,Message,CreatedAt) VALUES(@batch,@mid,@severity,@code,@message,SYSUTCDATETIME())",("@batch",batch),("@mid",mid),("@severity",V(issue,"severity")),("@code",V(issue,"code")),("@message",V(issue,"message")));
        }
        await Run("IF NOT EXISTS(SELECT 1 FROM dbo.WorkspaceLibrary WHERE MatchId=@match) INSERT dbo.WorkspaceLibrary(MatchId) VALUES(@match); IF NOT EXISTS(SELECT 1 FROM dbo.UploadSources WHERE MatchId=@match) INSERT dbo.UploadSources(MatchId,PayloadHash,Envelope) VALUES(@match,@hash,@envelope)",("@match",mid),("@hash",hash),("@envelope",e.GetRawText()));
        await Run("INSERT dbo.UploadReceipts(MessageId,MatchId,PayloadHash,Outcome) VALUES(@id,@match,@hash,@outcome)",("@id",message),("@match",mid),("@hash",hash),("@outcome",outcome));
        await tx.CommitAsync(cancel);
        return Results.Ok(new{messageId=message,matchId=mid,workspaceId=w.Id,status=outcome,acknowledged=true});
    }
}
