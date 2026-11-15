using System.Security.Claims;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Authentication;

namespace sit_backend.Security;

public class RoleClaimsTransformation : IClaimsTransformation
{
    private readonly FirestoreDb _firestoreDb;

    public RoleClaimsTransformation(FirestoreDb firestoreDb)
    {
        _firestoreDb = firestoreDb;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        if (identity == null || !identity.IsAuthenticated)
        {
            return principal;
        }

        // Avoid duplicating role claims if already present
        if (identity.Claims.Any(c => c.Type == ClaimTypes.Role))
        {
            return principal;
        }

        // Firebase places the UID in the "user_id" claim (or "sub" as subject)
        var userId = identity.FindFirst("user_id")?.Value
                     ?? identity.FindFirst("sub")?.Value
                     ?? identity.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrWhiteSpace(userId))
        {
            Console.WriteLine("RoleClaimsTransformation: No user ID found in claims");
            return principal;
        }

        Console.WriteLine($"RoleClaimsTransformation: Fetching roles for user {userId}");

        // Try "roles" array first, then fall back to "role" string
        var docRef = _firestoreDb.Collection("users").Document(userId);
        var snapshot = await docRef.GetSnapshotAsync().ConfigureAwait(false);
        
        if (snapshot.Exists)
        {
            // Check for "roles" array
            if (snapshot.TryGetValue("roles", out IEnumerable<string> roles))
            {
                foreach (var role in roles)
                {
                    if (!string.IsNullOrWhiteSpace(role))
                    {
                        identity.AddClaim(new Claim(ClaimTypes.Role, role));
                        Console.WriteLine($"RoleClaimsTransformation: Added role {role}");
                    }
                }
            }
            // Fall back to "role" string (singular)
            else if (snapshot.TryGetValue("role", out string role))
            {
                if (!string.IsNullOrWhiteSpace(role))
                {
                    identity.AddClaim(new Claim(ClaimTypes.Role, role));
                    Console.WriteLine($"RoleClaimsTransformation: Added role {role}");
                }
            }
            else
            {
                Console.WriteLine($"RoleClaimsTransformation: No role found in Firestore for user {userId}");
            }
        }
        else
        {
            Console.WriteLine($"RoleClaimsTransformation: User document not found in Firestore for {userId}");
        }

        return principal;
    }
}
