using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace sit_backend.Security;

public static class FirebaseJwtExtensions
{
    public static AuthenticationBuilder AddFirebaseJwt(this AuthenticationBuilder builder, IConfiguration configuration)
    {
        var projectId = configuration["Firebase:ProjectId"] ?? configuration["GOOGLE_FIREBASE_PROJECT_ID"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(projectId))
        {
            // Configure with minimal options so the app can build; runtime will fail without a valid project id
            return builder.AddJwtBearer();
        }

        var authority = $"https://securetoken.google.com/{projectId}";

        return builder.AddJwtBearer(options =>
        {
            options.Authority = authority;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = authority,
                ValidateAudience = true,
                ValidAudience = projectId,
                ValidateLifetime = true,
                // Firebase tokens use the project ID as the audience
                // Allow some clock skew for token validation
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            // Local development convenience
            options.RequireHttpsMetadata = false;
            
            // Add event handlers for debugging
            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    Console.WriteLine($"Authentication failed: {context.Exception.Message}");
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    Console.WriteLine($"Token validated for user: {context.Principal?.Identity?.Name}");
                    return Task.CompletedTask;
                },
                OnChallenge = context =>
                {
                    Console.WriteLine($"Challenge: {context.Error} - {context.ErrorDescription}");
                    return Task.CompletedTask;
                }
            };
        });
    }
}
