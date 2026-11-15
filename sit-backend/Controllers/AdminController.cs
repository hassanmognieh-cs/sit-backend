using FirebaseAdmin.Auth;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Security.Cryptography;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public AdminController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        public sealed class CreateUserRequest
        {
            public string? Email { get; set; }
            public string? Name { get; set; }
            public string? Role { get; set; }
        }

        private async Task<(bool ok, string? uid, IActionResult? errorResult)> RequireAdminAsync()
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

            var callerUid = decoded.Uid;
            if (string.IsNullOrWhiteSpace(callerUid))
            {
                return (false, null, Unauthorized(new { message = "Invalid token (no uid)." }));
            }

            var callerDoc = await _firestore.Collection("users").Document(callerUid).GetSnapshotAsync().ConfigureAwait(false);
            if (!callerDoc.Exists)
            {
                return (false, callerUid, Forbid());
            }

            var role = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
            var status = callerDoc.ContainsField("status") ? (callerDoc.GetValue<string>("status") ?? "active") : "active";

            if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            {
                return (false, callerUid, Forbid());
            }

            // Allow both admin and superadmin
            var roleLower = role?.Trim().ToLowerInvariant() ?? string.Empty;
            if (roleLower != "admin" && roleLower != "superadmin")
            {
                return (false, callerUid, Forbid());
            }

            return (true, callerUid, null);
        }

        private static string GenerateTemporaryPassword()
        {
            // Simple but strong password: 2 uppercase + 2 lowercase + 2 digits + 1 special = 7 characters
            // Format is shuffled but always contains required characters
            // Example: Ab12@Xy, Kp45#Mn, Qr78!St
            const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lower = "abcdefghijkmnopqrstuvwxyz";
            const string digits = "23456789";
            const string special = "@#$%&*!";

            var chars = new List<char>
            {
                // 2 uppercase letters
                upper[RandomNumberGenerator.GetInt32(upper.Length)],
                upper[RandomNumberGenerator.GetInt32(upper.Length)],
                // 2 lowercase letters
                lower[RandomNumberGenerator.GetInt32(lower.Length)],
                lower[RandomNumberGenerator.GetInt32(lower.Length)],
                // 2 digits
                digits[RandomNumberGenerator.GetInt32(digits.Length)],
                digits[RandomNumberGenerator.GetInt32(digits.Length)],
                // 1 special character
                special[RandomNumberGenerator.GetInt32(special.Length)]
            };

            // Shuffle to randomize position
            for (int i = chars.Count - 1; i > 0; i--)
            {
                int j = RandomNumberGenerator.GetInt32(i + 1);
                (chars[i], chars[j]) = (chars[j], chars[i]);
            }

            return new string(chars.ToArray());
        }

        [HttpPost("create-user")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req)
        {
            var (ok, callerUid, errorResult) = await RequireAdminAsync();
            if (!ok) return errorResult!;

            var email = (req.Email ?? string.Empty).Trim();
            var name = (req.Name ?? string.Empty).Trim();
            var role = (req.Role ?? "employee").Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Email is required." });

            if (role is not ("employee" or "manager" or "admin"))
                return BadRequest(new { message = "Role must be employee, manager, or admin." });

            var tempPassword = GenerateTemporaryPassword();

            Console.WriteLine($"[AdminCreateUser] Caller admin uid={callerUid}, creating user email={email}, role={role}");

            UserRecord created;
            try
            {
                created = await FirebaseAuth.DefaultInstance.CreateUserAsync(new UserRecordArgs
                {
                    Email = email,
                    Password = tempPassword,
                    DisplayName = string.IsNullOrWhiteSpace(name) ? email : name,
                    Disabled = false
                }).ConfigureAwait(false);

                Console.WriteLine($"[AdminCreateUser] Auth user created uid={created.Uid}");
            }
            catch (FirebaseAuthException ex) when (ex.AuthErrorCode == AuthErrorCode.EmailAlreadyExists)
            {
                return StatusCode((int)HttpStatusCode.Conflict, new
                {
                    code = "email_already_exists",
                    message = "This email is already registered."
                });
            }
            catch (FirebaseAuthException ex)
            {
                return BadRequest(new
                {
                    message = "Error creating Auth user.",
                    code = ex.AuthErrorCode.ToString(),
                    error = ex.Message
                });
            }

            var uid = created.Uid;

            try
            {
                var docRef = _firestore.Collection("users").Document(uid);
                await docRef.SetAsync(new Dictionary<string, object?>
                {
                    ["uid"] = uid,
                    ["name"] = string.IsNullOrWhiteSpace(name) ? email : name,
                    ["email"] = email,
                    ["role"] = role,
                    ["status"] = "active",
                    ["forcePasswordChange"] = true,
                    ["createdAt"] = FieldValue.ServerTimestamp
                }, SetOptions.MergeAll).ConfigureAwait(false);

                Console.WriteLine($"[AdminCreateUser] Firestore user created users/{uid}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AdminCreateUser] Firestore write failed for users/{uid}, rolling back auth user. Error: {ex.Message}");
                try
                {
                    await FirebaseAuth.DefaultInstance.DeleteUserAsync(uid).ConfigureAwait(false);
                    Console.WriteLine($"[AdminCreateUser] Rolled back auth user uid={uid}");
                }
                catch (Exception rollbackEx)
                {
                    Console.WriteLine($"[AdminCreateUser] Rollback failed uid={uid}. Error: {rollbackEx.Message}");
                }

                return StatusCode(500, new { message = "Failed to create Firestore user." });
            }

            return Ok(new
            {
                uid,
                temporaryPassword = tempPassword
            });
        }

        public sealed class UpdateUserRequest
        {
            public string? Name { get; set; }
            public string? Email { get; set; }
            public string? Role { get; set; }
        }

        [HttpPut("update-user/{uid}")]
        public async Task<IActionResult> UpdateUser(string uid, [FromBody] UpdateUserRequest req)
        {
            try
            {
                var (ok, callerUid, errorResult) = await RequireAdminAsync();
                if (!ok)
                {
                    Console.WriteLine($"[AdminUpdateUser] Authorization failed for uid={uid}");
                    return errorResult!;
                }

                Console.WriteLine($"[AdminUpdateUser] Caller admin uid={callerUid}, updating user uid={uid}");

                if (string.IsNullOrWhiteSpace(uid))
                    return BadRequest(new { message = "User ID is required." });

                if (req == null)
                    return BadRequest(new { message = "Request body is required." });

                var name = (req.Name ?? string.Empty).Trim();
                var email = (req.Email ?? string.Empty).Trim();
                var role = (req.Role ?? "employee").Trim().ToLowerInvariant();

                if (string.IsNullOrWhiteSpace(email))
                    return BadRequest(new { message = "Email is required." });

                if (role is not ("employee" or "manager" or "admin"))
                    return BadRequest(new { message = "Role must be employee, manager, or admin." });

                // Check if user exists - try document ID first, then search by UID field
                var userDoc = await _firestore.Collection("users").Document(uid).GetSnapshotAsync().ConfigureAwait(false);
                string actualUid = uid;
                
                if (!userDoc.Exists)
                {
                    // If not found by document ID, try searching by UID field
                    Console.WriteLine($"[AdminUpdateUser] User not found by document ID uid={uid}, searching by UID field...");
                    var query = _firestore.Collection("users").WhereEqualTo("uid", uid).Limit(1);
                    var snapshot = await query.GetSnapshotAsync().ConfigureAwait(false);
                    
                    if (snapshot.Count == 0)
                    {
                        Console.WriteLine($"[AdminUpdateUser] User not found by UID field either uid={uid}");
                        return NotFound(new { message = "User not found. Please verify the user exists in the system." });
                    }
                    
                    // Found by UID field, use that document
                    userDoc = snapshot.Documents[0];
                    actualUid = userDoc.Id; // Update to match document ID
                    Console.WriteLine($"[AdminUpdateUser] Found user by UID field, actual document ID={actualUid}");
                }

                var userRole = userDoc.ContainsField("role") ? (userDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
                var callerDoc = await _firestore.Collection("users").Document(callerUid).GetSnapshotAsync().ConfigureAwait(false);
                var callerRole = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;

                // Admin cannot update admin users, only superadmin can
                if (userRole.ToLowerInvariant() == "admin" && callerRole.ToLowerInvariant() != "superadmin")
                {
                    Console.WriteLine($"[AdminUpdateUser] Forbidden: Admin cannot update admin users. Caller={callerRole}, Target={userRole}");
                    return StatusCode(403, new { message = "Access denied. You do not have permission to update this user." });
                }

                // Cannot update superadmin
                if (userRole.ToLowerInvariant() == "superadmin")
                {
                    Console.WriteLine($"[AdminUpdateUser] Forbidden: Cannot update superadmin");
                    return StatusCode(403, new { message = "Cannot update superadmin user." });
                }

                // Update Firestore using the actual document ID
                await _firestore.Collection("users").Document(actualUid).UpdateAsync(new Dictionary<string, object?>
                {
                    ["name"] = string.IsNullOrWhiteSpace(name) ? email : name,
                    ["email"] = email,
                    ["role"] = role
                }).ConfigureAwait(false);

                Console.WriteLine($"[AdminUpdateUser] User updated successfully users/{actualUid}");
                return Ok(new { message = "User updated successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AdminUpdateUser] Exception updating user uid={uid}. Error: {ex.Message}");
                Console.WriteLine($"[AdminUpdateUser] Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to update user: {ex.Message}" });
            }
        }

        [HttpPut("update-user-status/{uid}")]
        public async Task<IActionResult> UpdateUserStatus(string uid, [FromBody] Dictionary<string, string> request)
        {
            try
            {
                var (ok, callerUid, errorResult) = await RequireAdminAsync();
                if (!ok)
                {
                    Console.WriteLine($"[AdminUpdateUserStatus] Authorization failed for uid={uid}");
                    return errorResult!;
                }

                Console.WriteLine($"[AdminUpdateUserStatus] Caller admin uid={callerUid}, updating status for uid={uid}");

                if (string.IsNullOrWhiteSpace(uid))
                    return BadRequest(new { message = "User ID is required." });

                if (request == null || !request.TryGetValue("status", out var status) || string.IsNullOrWhiteSpace(status))
                    return BadRequest(new { message = "Status is required." });

                var statusLower = status.Trim().ToLowerInvariant();
                if (statusLower != "active" && statusLower != "disabled")
                    return BadRequest(new { message = "Status must be 'active' or 'disabled'." });

                // Check if user exists - try document ID first, then search by UID field
                var userDoc = await _firestore.Collection("users").Document(uid).GetSnapshotAsync().ConfigureAwait(false);
                string actualUid = uid;
                
                if (!userDoc.Exists)
                {
                    // If not found by document ID, try searching by UID field
                    Console.WriteLine($"[AdminUpdateUserStatus] User not found by document ID uid={uid}, searching by UID field...");
                    var query = _firestore.Collection("users").WhereEqualTo("uid", uid).Limit(1);
                    var snapshot = await query.GetSnapshotAsync().ConfigureAwait(false);
                    
                    if (snapshot.Count == 0)
                    {
                        Console.WriteLine($"[AdminUpdateUserStatus] User not found by UID field either uid={uid}");
                        return NotFound(new { message = "User not found. Please verify the user exists in the system." });
                    }
                    
                    // Found by UID field, use that document
                    userDoc = snapshot.Documents[0];
                    actualUid = userDoc.Id; // Update to match document ID
                    Console.WriteLine($"[AdminUpdateUserStatus] Found user by UID field, actual document ID={actualUid}");
                }

                var userRole = userDoc.ContainsField("role") ? (userDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
                var callerDoc = await _firestore.Collection("users").Document(callerUid).GetSnapshotAsync().ConfigureAwait(false);
                var callerRole = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;

                // Admin cannot update admin users, only superadmin can
                if (userRole.ToLowerInvariant() == "admin" && callerRole.ToLowerInvariant() != "superadmin")
                {
                    Console.WriteLine($"[AdminUpdateUserStatus] Forbidden: Admin cannot update admin users. Caller={callerRole}, Target={userRole}");
                    return StatusCode(403, new { message = "Access denied. You do not have permission to update this user." });
                }

                // Cannot update superadmin
                if (userRole.ToLowerInvariant() == "superadmin")
                {
                    Console.WriteLine($"[AdminUpdateUserStatus] Forbidden: Cannot update superadmin");
                    return StatusCode(403, new { message = "Cannot update superadmin user." });
                }

                // Update status in Firestore using the actual document ID
                await _firestore.Collection("users").Document(actualUid).UpdateAsync(new Dictionary<string, object?>
                {
                    ["status"] = statusLower
                }).ConfigureAwait(false);

                Console.WriteLine($"[AdminUpdateUserStatus] User status updated successfully users/{actualUid} to {statusLower}");

                return Ok(new { message = "User status updated successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AdminUpdateUserStatus] Exception updating user status uid={uid}. Error: {ex.Message}");
                Console.WriteLine($"[AdminUpdateUserStatus] Stack trace: {ex.StackTrace}");
                return StatusCode(500, new { message = $"Failed to update user status: {ex.Message}" });
            }
        }

        [HttpDelete("delete-user/{uid}")]
        public async Task<IActionResult> DeleteUser(string uid)
        {
            var (ok, callerUid, errorResult) = await RequireAdminAsync();
            if (!ok) return errorResult!;

            if (string.IsNullOrWhiteSpace(uid))
                return BadRequest(new { message = "User ID is required." });

            // Prevent self-deletion
            if (uid == callerUid)
                return BadRequest(new { message = "You cannot delete your own account." });

            try
            {
                // Check if user exists in Firestore
                var userDoc = await _firestore.Collection("users").Document(uid).GetSnapshotAsync().ConfigureAwait(false);
                if (!userDoc.Exists)
                {
                    return NotFound(new { message = "User not found." });
                }

                var userRole = userDoc.ContainsField("role") ? (userDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
                var callerDoc = await _firestore.Collection("users").Document(callerUid).GetSnapshotAsync().ConfigureAwait(false);
                var callerRole = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;

                // Admin cannot delete admin users, only superadmin can
                if (userRole.ToLowerInvariant() == "admin" && callerRole.ToLowerInvariant() != "superadmin")
                {
                    return Forbid();
                }

                // Cannot delete superadmin
                if (userRole.ToLowerInvariant() == "superadmin")
                {
                    return Forbid();
                }

                // Delete from Firestore first
                await _firestore.Collection("users").Document(uid).DeleteAsync().ConfigureAwait(false);
                Console.WriteLine($"[AdminDeleteUser] Firestore user deleted users/{uid}");

                // Delete from Firebase Auth
                try
                {
                    await FirebaseAuth.DefaultInstance.DeleteUserAsync(uid).ConfigureAwait(false);
                    Console.WriteLine($"[AdminDeleteUser] Auth user deleted uid={uid}");
                }
                catch (FirebaseAuthException ex)
                {
                    Console.WriteLine($"[AdminDeleteUser] Auth deletion failed for uid={uid}. Error: {ex.Message}");
                    // Continue even if Auth deletion fails - Firestore is already deleted
                }

                return Ok(new { message = "User deleted successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[AdminDeleteUser] Error deleting user uid={uid}. Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete user." });
            }
        }
    }
}





