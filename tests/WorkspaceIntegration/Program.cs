using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using Breach.Intel.Api;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Data.SqlClient;

var root=Path.GetFullPath(args[0]);
var database="BREACH_SYNC_TEST_"+Guid.NewGuid().ToString("N");
var connection=$"Server=(localdb)\\MSSQLLocalDB;Database={database};Integrated Security=true;TrustServerCertificate=true";
var master=connection.Replace(database,"master");
async Task<object?> Sql(string sql,bool admin=false){await using var c=new SqlConnection(admin?master:connection);await c.OpenAsync();await using var command=new SqlCommand(sql,c){CommandTimeout=60};return await command.ExecuteScalarAsync();}
var checks=0;
void Assert(bool condition,string name){if(!condition)throw new Exception(name);checks++;Console.WriteLine("PASS: "+name);}
Workspace NewWorkspace(string subject){return new Workspace(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"ConnectionStrings:BreachDatabase",connection},{"Auth0:AllowedSubjects:0","synthetic-owner"}}).Build(),new Env(root));}
async Task<Workspace> Resolve(string subject){var w=NewWorkspace(subject);var h=new DefaultHttpContext();h.User=new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub",subject),new Claim("iss","https://synthetic.example/")],"test"));await w.ResolveAsync(h,true);return w;}
try{
 await Sql($"CREATE DATABASE [{database}]",true);
 await Sql(File.ReadAllText(Path.Combine(root,"../../tests/WorkspaceIntegration/gameplay.sql")));
 await Sql(File.ReadAllText(Path.Combine(root,"Sql/001_squads.sql")));
 await Sql(File.ReadAllText(Path.Combine(root,"Sql/002_review_notes.sql")));
 var a=await Resolve("synthetic-owner");var b=await Resolve("synthetic-console-player");
 Assert(a.Schema=="dbo"&&b.Schema!="dbo","new accounts provision separately from legacy owner");
 Assert(a.Scope("SELECT * FROM dbo.Players")==b.Scope("SELECT * FROM dbo.Players"),"player catalogue is shared");
 var conf=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{{"ConnectionStrings:BreachDatabase",connection}}).Build();
 var ad=new SqlStore(conf,a);var bd=new SqlStore(conf,b);
 var squads=new SquadStore(conf,a);
 await ad.ReadAsync("INSERT dbo.Squads(SquadId,Name) VALUES(N'private-squad',N'Private roster')");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.Squads")).Count==0,"console account cannot read owner's private squads");
 using var schema=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"Contracts/collector-v1.schema.json")));
 Assert(File.ReadAllText(Path.Combine(root,"Contracts/collector-v1.schema.json"))==File.ReadAllText(Path.Combine(root,"../../public/contracts/collector-v1.schema.json")),"API and collector use the same contract");
 var json=File.ReadAllText(Path.Combine(root,"../../tests/WorkspaceIntegration/envelope.json"));
 var rich=JsonNode.Parse(json)!;rich["payload"]!["match"]!["mapId"]="18446744073709551615";rich["payload"]!["appearances"]![0]!["stats"]!["scoreSnapshot"]=4294967286L;rich["payload"]!["events"]![0]!["timeRemainingSeconds"]=15.25;json=rich.ToJsonString();
 using var doc=JsonDocument.Parse(json);CollectorContract.Validate(doc.RootElement,schema.RootElement);
 var result=await UploadEndpoints.Save(doc.RootElement,a,default);
 Assert(result is IStatusCodeHttpResult {StatusCode:200},"valid upload committed");
 Assert((await ad.ReadAsync("SELECT * FROM dbo.Matches")).Count==1,"one gameplay match inserted");
 Assert((await ad.ReadAsync("SELECT MapId AS mapId FROM dbo.Matches"))[0]["mapId"]?.ToString()=="18446744073709551615","unsigned game IDs remain exact decimal strings");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.Players")).Count==1,"console account sees uploaded player data");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.WorkspaceLibrary")).Count==0,"another account starts with empty private library");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.UploadReceipts")).Count==0,"upload receipts stay private");
 await ad.ReadAsync("INSERT dbo.ReviewNotes(NoteId,MatchId,Category,Value,ReviewSource,Notes,AuthorLabel) VALUES(NEWID(),N'11111111-1111-4111-8111-111111111111',N'Other observation',N'test',N'Manual review',N'private note',N'Workspace member')");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.ReviewNotes")).Count==0,"review notes stay private");
 await UploadEndpoints.Save(doc.RootElement,a,default);
 Assert((await ad.ReadAsync("SELECT * FROM dbo.UploadReceipts")).Count==1,"same message retry returns existing receipt");
 var node=JsonNode.Parse(json)!;node["messageId"]=Guid.NewGuid().ToString();using var second=JsonDocument.Parse(node.ToJsonString());
 await Task.WhenAll(UploadEndpoints.Save(second.RootElement,a,default),UploadEndpoints.Save(second.RootElement,a,default));
 Assert((await ad.ReadAsync("SELECT * FROM dbo.Matches")).Count==1&&(await ad.ReadAsync("SELECT * FROM dbo.UploadReceipts")).Count==2,"concurrent duplicate requests insert no duplicate facts");
 await UploadEndpoints.Save(doc.RootElement,b,default);
 Assert((await bd.ReadAsync("SELECT * FROM dbo.WorkspaceLibrary")).Count==1&&(await ad.ReadAsync("SELECT * FROM dbo.Matches")).Count==1,"second uploader gets own receipt without duplicating shared match");
 node["messageId"]=Guid.NewGuid().ToString();node["payload"]!["players"]![0]!["username"]="Changed";using var changed=JsonDocument.Parse(node.ToJsonString());
 Assert(await UploadEndpoints.Save(changed.RootElement,a,default) is IStatusCodeHttpResult{StatusCode:409},"changed match content conflicts without overwriting");
 Assert((await ad.ReadAsync("SELECT Username FROM dbo.Players"))[0]["Username"]?.ToString()=="One","conflict retained original player facts");
 await ad.ReadAsync("UPDATE dbo.CollectorConnections SET RevokedAt=SYSUTCDATETIME()");
 Assert(await UploadEndpoints.Save(doc.RootElement,a,default) is IStatusCodeHttpResult{StatusCode:403},"revoked collector cannot upload even duplicate requests");
 Assert(await UploadEndpoints.Save(doc.RootElement,b,default) is IStatusCodeHttpResult{StatusCode:200},"revocation belongs only to its account");
 var invalid=JsonNode.Parse(json)!;invalid["owner"]="spoof";using var bad=JsonDocument.Parse(invalid.ToJsonString());bool rejected=false;
 try{CollectorContract.Validate(bad.RootElement,schema.RootElement);}catch(ContractException){rejected=true;}
 Assert(rejected,"body-supplied ownership rejected");
 invalid=JsonNode.Parse(json)!;invalid["payload"]!["rounds"]![0]!["teams"]![0]!["won"]=false;using var badRound=JsonDocument.Parse(invalid.ToJsonString());rejected=false;
 try{CollectorContract.Validate(badRound.RootElement,schema.RootElement);}catch(ContractException){rejected=true;}Assert(rejected,"contradictory round results rejected");
 Assert(Convert.ToInt64((await ad.ReadAsync("SELECT TOP(1) ScoreSnapshot FROM dbo.RoundPlayers ORDER BY ScoreSnapshot DESC"))[0]["ScoreSnapshot"])==4294967286L,"large score snapshots retain their original value");
 Assert(Convert.ToDouble((await ad.ReadAsync("SELECT TOP(1) TimeRemainingSeconds FROM dbo.RoundEvents ORDER BY TimeRemainingSeconds DESC"))[0]["TimeRemainingSeconds"])==15.25,"fractional event times are not truncated");
 await Sql("CREATE TRIGGER dbo.TestUploadFailure ON dbo.RoundEvents AFTER INSERT AS THROW 51000,'synthetic storage failure',1;");
 var rollback=JsonNode.Parse(json)!;rollback["messageId"]=Guid.NewGuid().ToString();rollback["payload"]!["match"]!["matchId"]=Guid.NewGuid().ToString();using var rollbackDoc=JsonDocument.Parse(rollback.ToJsonString());
 var failed=false;try{await UploadEndpoints.Save(rollbackDoc.RootElement,b,default);}catch(SqlException){failed=true;}
 Assert(failed&&(await ad.ReadAsync("SELECT * FROM dbo.Matches")).Count==1,"mid-import storage failure rolls back every match write");
 await Sql("DROP TRIGGER dbo.TestUploadFailure");
 var unresolved=NewWorkspace("unused");rejected=false;try{unresolved.Scope("SELECT * FROM dbo.Players");}catch(InvalidOperationException){rejected=true;}Assert(rejected,"unresolved workspace fails closed");
 // Manual entry remains account-owned and never changes shared replay facts.
 var manualId=Guid.NewGuid();
 var manualPlayer="manual-player:"+Guid.NewGuid();
 var blank=new ManualRound("Attack","","",null,null,null,null,null,"");
 var manual=new ManualMatch(manualPlayer,"Console player","Xbox","Clubhouse","Ranked Bomb",4,DateTimeOffset.UtcNow,"",[blank]);
 var draft=new ManualWrite(0,"draft",manual);
 Assert(await ManualEndpoints.Save(manualId,draft,a,default) is IStatusCodeHttpResult{StatusCode:200},"incomplete manual draft saves");
 Assert((await bd.ReadAsync("SELECT * FROM dbo.ManualMatches")).Count==0,"manual drafts are private across accounts");
 Assert(await ManualEndpoints.Save(manualId,draft,a,default) is IStatusCodeHttpResult{StatusCode:200},"lost save acknowledgement can be retried idempotently");
 var stale=draft with{Payload=manual with{Map="Bank"}};
 Assert(await ManualEndpoints.Save(manualId,stale,a,default) is IStatusCodeHttpResult{StatusCode:409},"stale manual edits cannot overwrite newer revisions");
 Assert(ManualEndpoints.Validate(draft with{Status="submitted"}) is not null,"incomplete match cannot submit");
 var completed=manual with{Rounds=Enumerable.Range(0,4).Select(_=>blank with{Won=true,Kills=1,Died=false}).ToArray()};
 Assert(ManualEndpoints.Validate(new(1,"submitted",completed)) is null,"complete ranked sweep validates with optional stats unknown");
 Assert(ManualEndpoints.Validate(new(1,"submitted",completed with{Rounds=[..completed.Rounds,blank with{Won=false}]})) is not null,"rounds after a terminal score rejected");
 Assert(ManualEndpoints.Validate(new(1,"draft",manual with{Rounds=[blank with{Kills=1,Headshots=2}]})) is not null,"impossible headshots rejected even in drafts");
 var ot=manual with{Rounds=new[]{true,false,true,false,true,false,true,false,true}.Select(win=>blank with{Won=win}).ToArray()};
 Assert(ManualEndpoints.Validate(new(1,"submitted",ot)) is null,"ranked 5-4 overtime validates");
 var forged=manual with{PlayerId="missing-shared-player"};
 Assert(await ManualEndpoints.Save(Guid.NewGuid(),new(0,"draft",forged),a,default) is IStatusCodeHttpResult{StatusCode:400},"unknown shared player association rejected");
 Assert(await ManualEndpoints.Save(manualId,new(1,"submitted",completed),a,default) is IStatusCodeHttpResult{StatusCode:200},"complete manual match submitted");
 Assert(await ManualEndpoints.Save(manualId,new(2,"draft",completed),a,default) is IStatusCodeHttpResult{StatusCode:409},"submitted manual records are immutable");
 Assert((await ad.ReadAsync("SELECT * FROM dbo.Matches")).Count==1,"manual submission does not pollute shared replay catalogue");
 var savedManual=JsonSerializer.Deserialize<ManualMatch>((string)(await ad.ReadAsync("SELECT Payload FROM dbo.ManualMatches"))[0]["Payload"]!,ManualEndpoints.Json)!;
 Assert(savedManual.Rounds[0].Assists is null,"unknown manual statistics remain null through SQL persistence");
 Assert(await ManualEndpoints.Save(manualId,new(2,"draft",manual),b,default) is IStatusCodeHttpResult{StatusCode:404},"another account cannot update an owner's draft ID");
 var simultaneous=Guid.NewGuid();
 var results=await Task.WhenAll(ManualEndpoints.Save(simultaneous,new(0,"draft",manual),a,default),ManualEndpoints.Save(simultaneous,new(0,"draft",manual with{Map="Bank"}),a,default));
 Assert(results.Count(x=>x is IStatusCodeHttpResult{StatusCode:200})==1&&results.Count(x=>x is IStatusCodeHttpResult{StatusCode:409})==1,"concurrent draft creation retains one version without silent overwrite");
 Console.WriteLine($"{checks} integration checks passed against isolated SQL database.");
}finally{SqlConnection.ClearAllPools();await Sql($"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]",true);}

sealed class Env(string root):IWebHostEnvironment {
 public string ApplicationName{get;set;}="Integration";public string EnvironmentName{get;set;}="Development";
 public string WebRootPath{get;set;}="";public IFileProvider WebRootFileProvider{get;set;}=new NullFileProvider();
 public string ContentRootPath{get;set;}=root;public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();
}

