using FirebaseAdmin.Auth;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/account")]
    public class AccountController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public AccountController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        private async Task<(bool ok, string? uid, IActionResult? errorResult)> RequireUserAsync()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return (false, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            var token = authHeader.Substring("Bearer ".Length).Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return (false, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            FirebaseToken decoded;
            try
            {
                decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
            }
            catch
            {
                return (false, null, Unauthorized(new { message = "Invalid or expired token." }));
            }

            var uid = decoded.Uid;
            if (string.IsNullOrWhiteSpace(uid))
            {
                return (false, null, Unauthorized(new { message = "Invalid token (no uid)." }));
            }

            return (true, uid, null);
        }

        [HttpPost("clear-force-password-change")]
        public async Task<IActionResult> ClearForcePasswordChange()
        {
            var (ok, uid, errorResult) = await RequireUserAsync();
            if (!ok) return errorResult!;

            try
            {
                var docRef = _firestore.Collection("users").Document(uid!);
                await docRef.SetAsync(new Dictionary<string, object?>
                {
                    ["forcePasswordChange"] = false
                }, SetOptions.MergeAll).ConfigureAwait(false);

                Console.WriteLine($"[Account] forcePasswordChange cleared users/{uid}");
                return Ok(new { ok = true });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Account] Failed to clear forcePasswordChange users/{uid}. Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to clear forcePasswordChange." });
            }
        }
    }
}









