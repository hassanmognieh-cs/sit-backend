using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using FirebaseAdmin.Auth;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public UsersController(FirestoreDb firestore)
        {
            _firestore = firestore;//object firestore in controllers
        }

        // DELETE: api/users/{uid}
        [HttpDelete("{uid}")]
        
        public async Task<IActionResult> DeleteUser(string uid)
        {
            if (string.IsNullOrWhiteSpace(uid))
                return BadRequest(new { message = "Invalid user id (uid)." });

            try
            {
               
                DocumentReference userDoc = _firestore.Collection("users").Document(uid);
                await userDoc.DeleteAsync();

               
                await FirebaseAuth.DefaultInstance.DeleteUserAsync(uid);

                return Ok(new { message = "User deleted successfully." });
            }
            catch (FirebaseAuthException ex)
            {
               
                return BadRequest(new
                {
                    message = "Error deleting user from Firebase Authentication.",
                    error = ex.Message
                });
            }
            catch (Exception ex)
            {
                
                return StatusCode(500, new
                {
                    message = "Internal server error while deleting user.",
                    error = ex.Message
                });
            }
        }
    }
}
