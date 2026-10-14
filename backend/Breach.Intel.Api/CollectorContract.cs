using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Breach.Intel.Api;

public sealed class ContractException(string message) : Exception(message);
public static class CollectorContract
{
    public static string Uid(params object[] values) => Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(string.Join("|", values))))[..24];
    // Hash the normalized payload, not device/message/timestamp metadata. Same match from
    // another installation is a duplicate; changed facts are a conflict, never overwritten.
    public static string Hash(JsonElement payload) {
        JsonNode? Normalize(JsonElement e) => e.ValueKind switch {
            JsonValueKind.Object => new JsonObject(e.EnumerateObject().OrderBy(p=>p.Name,StringComparer.Ordinal).Select(p=>KeyValuePair.Create(p.Name,Normalize(p.Value)))),
            JsonValueKind.Array => new JsonArray(e.EnumerateArray().Select(Normalize).ToArray()),
            _ => JsonNode.Parse(e.GetRawText())
        };
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(payload)!.ToJsonString())));
    }
    // Evaluates the deliberately small vocabulary used by our committed v1 schema.
    // Never accepts a schema supplied by a caller, resolves only local $defs.
    public static void Validate(JsonElement envelope, JsonElement schema)
    {
        void Check(JsonElement value, JsonElement rule) {
            if(rule.TryGetProperty("$ref",out var reference)) { Check(value,schema.GetProperty("$defs").GetProperty(reference.GetString()!.Split('/').Last()));return; }
            if(rule.TryGetProperty("anyOf",out var choices)) {
                foreach(var choice in choices.EnumerateArray()) { try{Check(value,choice);return;}catch(ContractException){} }
                throw new ContractException("Value does not match the contract.");
            }
            bool IsType(string? type) => type switch {
                "object"=>value.ValueKind==JsonValueKind.Object,"array"=>value.ValueKind==JsonValueKind.Array,
                "string"=>value.ValueKind==JsonValueKind.String,"null"=>value.ValueKind==JsonValueKind.Null,
                "boolean"=>value.ValueKind is JsonValueKind.True or JsonValueKind.False,
                "number"=>value.ValueKind==JsonValueKind.Number,
                "integer"=>value.ValueKind==JsonValueKind.Number && value.TryGetDecimal(out var n) && decimal.Truncate(n)==n,_=>false};
            if(rule.TryGetProperty("type",out var types) && !(types.ValueKind==JsonValueKind.Array?types.EnumerateArray().Any(t=>IsType(t.GetString())):IsType(types.GetString()))) throw new ContractException("Incorrect field type.");
            if(rule.TryGetProperty("const",out var constant)&&!JsonElement.DeepEquals(value,constant))throw new ContractException("Unsupported contract version or source.");
            if(rule.TryGetProperty("enum",out var options)&&!options.EnumerateArray().Any(o=>JsonElement.DeepEquals(value,o)))throw new ContractException("Unsupported field value.");
            if(value.ValueKind==JsonValueKind.Object) {
                var props=value.EnumerateObject().ToArray();
                if(props.Select(p=>p.Name).Distinct().Count()!=props.Length)throw new ContractException("Duplicate JSON property.");
                if(rule.TryGetProperty("required",out var required)&&required.EnumerateArray().Any(r=>!value.TryGetProperty(r.GetString()!,out _)))throw new ContractException("Required field missing.");
                var properties=rule.GetProperty("properties");
                foreach(var prop in props) { if(!properties.TryGetProperty(prop.Name,out var child))throw new ContractException("Unknown field in upload."); Check(prop.Value,child); }
            }
            if(value.ValueKind==JsonValueKind.Array) {
                var length=value.GetArrayLength();
                if(rule.TryGetProperty("minItems",out var min)&&length<min.GetInt32()||rule.TryGetProperty("maxItems",out var max)&&length>max.GetInt32())throw new ContractException("Array outside contract limits.");
                foreach(var item in value.EnumerateArray())Check(item,rule.GetProperty("items"));
            }
            if(value.ValueKind==JsonValueKind.String) {
                var text=value.GetString()!;
                if(rule.TryGetProperty("minLength",out var min)&&text.Length<min.GetInt32()||rule.TryGetProperty("maxLength",out var max)&&text.Length>max.GetInt32())throw new ContractException("Text outside contract limits.");
                if(rule.TryGetProperty("pattern",out var pattern)&&!Regex.IsMatch(text,pattern.GetString()!,RegexOptions.CultureInvariant,TimeSpan.FromMilliseconds(100)))throw new ContractException("Invalid identifier or date.");
                if(rule.TryGetProperty("format",out var format)) {
                    if(format.GetString()=="uuid"&&!Guid.TryParseExact(text,"D",out _))throw new ContractException("Invalid UUID.");
                    if(format.GetString()=="date-time"&&(!text.EndsWith('Z')||!DateTimeOffset.TryParse(text,CultureInfo.InvariantCulture,DateTimeStyles.None,out _)))throw new ContractException("Invalid UTC date.");
                }
            }
            if(value.ValueKind==JsonValueKind.Number) {
                if(!value.TryGetDecimal(out var n)||rule.TryGetProperty("minimum",out var min)&&n<min.GetDecimal()||rule.TryGetProperty("maximum",out var max)&&n>max.GetDecimal())throw new ContractException("Number outside contract limits.");
            }
        }
        Check(envelope,schema);
        var p=envelope.GetProperty("payload");var m=p.GetProperty("match");
        if(m.GetProperty("completion").GetString()!="complete"||m.GetProperty("matchType").GetString()!="Ranked"||m.GetProperty("gameMode").GetString()!="Bomb")throw new ContractException("Only completed Ranked Bomb matches can be uploaded.");
        var rounds=p.GetProperty("rounds").EnumerateArray().OrderBy(r=>r.GetProperty("number").GetInt32()).ToArray();
        var rids=rounds.Select(r=>r.GetProperty("roundId").GetString()!).ToHashSet();
        var players=p.GetProperty("players").EnumerateArray().ToArray();var pids=players.Select(r=>r.GetProperty("playerId").GetString()!).ToHashSet();
        if(rids.Count!=rounds.Length||pids.Count!=players.Length)throw new ContractException("Duplicate round or player identity.");
        var score=new int[2];
        for(var i=0;i<rounds.Length;i++) {
            var r=rounds[i];var teams=r.GetProperty("teams").EnumerateArray().OrderBy(t=>t.GetProperty("slot").GetInt32()).ToArray();
            if(r.GetProperty("number").GetInt32()!=i+1||teams[0].GetProperty("slot").GetInt32()!=0||teams[1].GetProperty("slot").GetInt32()!=1||teams.Any(t=>t.GetProperty("won").ValueKind==JsonValueKind.Null)||teams[0].GetProperty("won").GetBoolean()==teams[1].GetProperty("won").GetBoolean())throw new ContractException("Rounds must be contiguous with one winner each.");
            for(var k=0;k<2;k++)if(teams[k].GetProperty("won").GetBoolean())score[k]++;
            var a=score.Max();var b=score.Min();var ended=(a==4&&a-b>=2&&i<6)||(a==5&&i>=6&&i<=8);
            if(ended!=(i==rounds.Length-1))throw new ContractException("Round results do not describe a completed Ranked match.");
        }
        var pairs=new HashSet<(string,string)>();
        foreach(var a in p.GetProperty("appearances").EnumerateArray()) {
            var rid=a.GetProperty("roundId").GetString()!;var pid=a.GetProperty("playerId").GetString()!;
            if(!rids.Contains(rid)||!pids.Contains(pid)||!pairs.Add((rid,pid)))throw new ContractException("Duplicate or unresolved appearance.");
            var stats=a.GetProperty("stats");
            if(stats.GetProperty("headshots").ValueKind==JsonValueKind.Number&&stats.GetProperty("kills").ValueKind==JsonValueKind.Number&&stats.GetProperty("headshots").GetInt32()>stats.GetProperty("kills").GetInt32())throw new ContractException("Headshots exceed kills.");
        }
        var ids=new HashSet<string>();var seq=new HashSet<(string,int)>();
        foreach(var e in p.GetProperty("events").EnumerateArray()) {
            var rid=e.GetProperty("roundId").GetString()!;
            if(!rids.Contains(rid)||!ids.Add(e.GetProperty("eventId").GetString()!)||!e.GetProperty("sequence").TryGetInt32(out var n)||!seq.Add((rid,n)))throw new ContractException("Duplicate or unresolved event.");
            foreach(var key in new[]{"actorPlayerId","targetPlayerId"})if(e.GetProperty(key).GetString() is {} pid&&!pairs.Contains((rid,pid)))throw new ContractException("Event player is not in this round.");
        }
    }
}
