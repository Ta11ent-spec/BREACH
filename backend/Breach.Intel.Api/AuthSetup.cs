using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication;
using Microsoft.IdentityModel.Tokens;

namespace Breach.Intel.Api;

public static class AuthSetup
{
    public static bool AddBreachAuthentication(this WebApplicationBuilder builder)
    {
        var domain=builder.Configuration["Auth0:Domain"];
        var audience=builder.Configuration["Auth0:Audience"];
        var configured=!string.IsNullOrWhiteSpace(domain)&&!string.IsNullOrWhiteSpace(audience);
        if(!configured && !builder.Environment.IsDevelopment()) throw new InvalidOperationException("Configure Auth0 before running outside Development.");
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options=>
        {
            if(configured){
                if(!Uri.TryCreate("https://"+domain+"/",UriKind.Absolute,out var authority)||authority.Scheme!="https"||authority.Host!=domain)throw new InvalidOperationException("Invalid Auth0 domain.");
                options.Authority=authority.ToString(); options.Audience=audience;
            }
            options.MapInboundClaims=false;
            options.RequireHttpsMetadata=true;
            options.TokenValidationParameters=new TokenValidationParameters{ValidateIssuer=true,ValidateAudience=true,ValidateLifetime=true,ValidateIssuerSigningKey=true,ClockSkew=TimeSpan.FromSeconds(30),ValidAlgorithms=[SecurityAlgorithms.RsaSha256]};
            options.IncludeErrorDetails=false;
        });
        builder.Services.AddAuthorization();
        return configured;
    }
    public static void UseBreachAuthentication(this WebApplication app,bool configured)
    {
        app.UseAuthentication();app.UseAuthorization();
        app.Use(async(http,next)=>
        {
            if(!http.Request.Path.StartsWithSegments("/api")){await next();return;}
            if(!configured){
                if(app.Environment.IsDevelopment()&&http.Connection.RemoteIpAddress is {} ip&&System.Net.IPAddress.IsLoopback(ip)){await next();return;}
                http.Response.StatusCode=503;return;
            }
            if(http.User.Identity?.IsAuthenticated!=true){await http.ChallengeAsync();return;}
            // Existing imported data is one private workspace. Do not expose it to every new signup.
            if(http.Request.Path!="/api/account" && !(app.Configuration.GetSection("Auth0:AllowedSubjects").Get<string[]>()??[]).Contains(http.User.FindFirst("sub")?.Value,StringComparer.Ordinal)){
                http.Response.StatusCode=403;await http.Response.WriteAsJsonAsync(new{message="This account has not been granted access to this private workspace."});return;
            }
            await next();
        });
        app.MapGet("/api/account",(HttpContext http)=>Results.Ok(new{authenticated=http.User.Identity?.IsAuthenticated==true,subject=http.User.FindFirst("sub")?.Value,workspaceAccess=(app.Configuration.GetSection("Auth0:AllowedSubjects").Get<string[]>()??[]).Contains(http.User.FindFirst("sub")?.Value,StringComparer.Ordinal)}));
    }
}
