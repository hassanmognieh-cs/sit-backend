using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        [HttpDelete("delete-auth-user/{uid}")]
        public async Task<IActionResult> DeleteAuthUser(string uid)
        {
            try
            {
                await FirebaseAuth.DefaultInstance.DeleteUserAsync(uid);
                return Ok(new { message = "User deleted from Authentication" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}