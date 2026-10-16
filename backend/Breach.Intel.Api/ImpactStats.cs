using System.Text.Json;
using System.Text.Json.Serialization;
namespace Breach.Intel.Api;
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ImpactStats(int Version,int? OpeningKills,int? OpeningDeaths,int? OpeningTeamkills,int? OpeningTeamkillDeaths,int? OpeningOtherDeaths,int?[] Clutches) {
    public static string? Validate(ImpactStats? x,int rounds,int? kills,int? deaths,int? wins=null) {
        if(x is null)return null;
        var values=new[]{x.OpeningKills,x.OpeningDeaths,x.OpeningTeamkills,x.OpeningTeamkillDeaths,x.OpeningOtherDeaths};
        if(x.Version!=1||x.Clutches is null||x.Clutches.Length!=5||values.Concat(x.Clutches).Any(n=>n is <0||n>rounds))return "Invalid opening/clutch statistics.";
        if((x.OpeningKills??0)+(x.OpeningTeamkills??0)>kills||(x.OpeningDeaths??0)+(x.OpeningTeamkillDeaths??0)+(x.OpeningOtherDeaths??0)>deaths)return "Opening events exceed kills or deaths.";
        if(x.Clutches.Sum(n=>n??0)>rounds||wins is not null&&x.Clutches.Sum(n=>n??0)>wins)return "Clutch wins exceed won rounds.";
        return null;
    }
    public static string? Group((int Team,ImpactStats? Stats)[] rows,int rounds) {
        var fields=new Func<ImpactStats,int?>[]{x=>x.OpeningKills,x=>x.OpeningDeaths,x=>x.OpeningTeamkills,x=>x.OpeningTeamkillDeaths,x=>x.OpeningOtherDeaths};
        if(fields.Any(f=>rows.Sum(r=>r.Stats is {} s?f(s)??0:0)>rounds)||rows.Sum(r=>r.Stats?.Clutches.Sum(n=>n??0)??0)>rounds)return "Too many opening events or clutches in the match/round.";
        if(rows.Sum(r=>(r.Stats?.OpeningTeamkills??0)+(r.Stats?.OpeningOtherDeaths??0))>rounds)return "Opening teamkill and other death cannot both be the first elimination.";
        foreach(var pair in new[]{(fields[0],fields[1],false),(fields[2],fields[3],true)}) {
            if(rows.All(r=>r.Stats is {} s&&pair.Item1(s)!=null&&pair.Item2(s)!=null)&&rows.Sum(r=>pair.Item1(r.Stats!)!.Value)!=rows.Sum(r=>pair.Item2(r.Stats!)!.Value))return "Opening killers and victims must balance.";
            if(rounds==1){var killer=rows.Where(r=>r.Stats is {} s&&pair.Item1(s)==1).ToArray();var victim=rows.Where(r=>r.Stats is {} s&&pair.Item2(s)==1).ToArray();if(killer.Length==1&&victim.Length==1&&(killer[0].Team==victim[0].Team)!=pair.Item3)return "Check opening event teams.";}
        }
        return null;
    }
    public static void DecodeRows(List<Dictionary<string,object?>> rows) {
        foreach(var row in rows) { if(row.Remove("impactJson",out var json)){row["impact"]=null;if(json is string s)try{var x=JsonSerializer.Deserialize<ImpactStats>(s,ManualEndpoints.Json);if(Validate(x,1,null,null)==null)row["impact"]=x;}catch(JsonException){}} }
    }
}
