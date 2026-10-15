using System.Text.Json;
using System.Text.Json.Serialization;
using System.Buffers.Binary;
using Microsoft.Data.SqlClient;
namespace Breach.Intel.Api;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record AccountProfile(int Revision, string DisplayName, string Bio, string Avatar);
public static class ProfileEndpoints
{
    public static string? Validate(AccountProfile p) {
        if(p.Revision<0 || p.Revision==int.MaxValue || string.IsNullOrWhiteSpace(p.DisplayName) || p.DisplayName.Length>80 || p.DisplayName.Any(char.IsControl) || p.Bio is null || p.Bio.Length>500 || p.Bio.Any(c=>char.IsControl(c)&&c!='\n'&&c!='\r') || p.Avatar is null) return "Enter a display name (1–80 characters) and a bio of up to 500 characters.";
        if(p.Avatar.Length==0)return null;
        const string prefix="data:image/png;base64,";
        if(!p.Avatar.StartsWith(prefix,StringComparison.Ordinal)||p.Avatar.Length>140000)return "Choose a PNG, JPEG or WebP photo using the picture button.";
        try {
            var bytes=Convert.FromBase64String(p.Avatar[prefix.Length..]);
            if(bytes.Length<33 || !bytes.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) || !bytes.AsSpan(12,4).SequenceEqual("IHDR"u8))return "Invalid profile picture.";
            var width=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(16,4));var height=BinaryPrimitives.ReadUInt32BigEndian(bytes.AsSpan(20,4));
            if(width is <1 or >256 || height is <1 or >256)return "Profile pictures must be at most 256 pixels.";
        }catch(FormatException){return "Invalid profile picture.";}
        return null;
    }
    public static void MapAccountProfile(this WebApplication app) {
        var group=app.MapGroup("/api/account/profile");
        group.AddEndpointFilter(async(context,next)=>{
            if(context.HttpContext.User.Identity?.IsAuthenticated!=true)return Results.Unauthorized();
            try{return await next(context);}catch(SqlException){return Results.Problem("Profile storage is unavailable. Please retry.",statusCode:503);}
        });
        group.MapGet("",async(SqlStore db)=>{
            var rows=await db.ReadAsync("SELECT Revision AS revision,DisplayName AS displayName,Bio AS bio,Avatar AS avatar FROM dbo.AccountProfile WHERE Id=1");
            return rows.Count==0?Results.Ok(new AccountProfile(0,"","","")):Results.Ok(rows[0]);
        });
        group.MapPut("",async(HttpContext h,Workspace w)=>{
            if(h.Request.Headers["X-Breach-Request"]!="profile")return Results.BadRequest();
            if(!h.Request.HasJsonContentType())return Results.StatusCode(415);
            using var body=new MemoryStream();var buffer=new byte[8192];int count;
            while((count=await h.Request.Body.ReadAsync(buffer,h.RequestAborted))>0){if(body.Length+count>160000)return Results.StatusCode(413);body.Write(buffer,0,count);}
            try{var p=JsonSerializer.Deserialize<AccountProfile>(body.ToArray(),ManualEndpoints.Json);return p is null?Results.BadRequest():await Save(p,w,h.RequestAborted);}
            catch(JsonException){return Results.BadRequest(new{message="Invalid profile request."});}
        });
    }
    public static async Task<IResult> Save(AccountProfile p,Workspace w,CancellationToken ct) {
        var error=Validate(p);if(error is not null)return Results.BadRequest(new{message=error});
        await using var db=w.Connection();await db.OpenAsync(ct);
        await using var tx=(SqlTransaction)await db.BeginTransactionAsync(System.Data.IsolationLevel.Serializable,ct);
        await using var read=new SqlCommand(w.Scope("SELECT Revision FROM dbo.AccountProfile WITH(UPDLOCK,HOLDLOCK) WHERE Id=1"),db,tx);
        var old=await read.ExecuteScalarAsync(ct);
        if((old is null?0:(int)old)!=p.Revision)return Results.Conflict(new{message="Your profile changed in another tab. Reload the saved profile before editing."});
        await using var write=new SqlCommand(w.Scope(old is null?"INSERT dbo.AccountProfile(Id,Revision,DisplayName,Bio,Avatar) VALUES(1,@revision,@name,@bio,@avatar)":"UPDATE dbo.AccountProfile SET Revision=@revision,DisplayName=@name,Bio=@bio,Avatar=@avatar,UpdatedAt=SYSUTCDATETIME() WHERE Id=1"),db,tx);
        write.Parameters.AddWithValue("@revision",p.Revision+1);write.Parameters.AddWithValue("@name",p.DisplayName.Trim());write.Parameters.AddWithValue("@bio",p.Bio.Trim());write.Parameters.AddWithValue("@avatar",p.Avatar);
        await write.ExecuteNonQueryAsync(ct);await tx.CommitAsync(ct);
        return Results.Ok(p with{Revision=p.Revision+1,DisplayName=p.DisplayName.Trim(),Bio=p.Bio.Trim()});
    }
}
