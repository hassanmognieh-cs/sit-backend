using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Linq;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TestController : ControllerBase
    {
        [HttpGet("secure")]
        //[Authorize]
        public IActionResult SecureEndpoint()
        {
            // Safe claim access (no CS8602 warnings)
            var claims = User?.Claims ?? [];


            // Extract UID safely
            var userId =
                claims.FirstOrDefault(c => c.Type == "user_id")?.Value ??
                claims.FirstOrDefault(c => c.Type == "sub")?.Value ??
                claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value ??
                "unknown";

            // Extract email safely
            var email =
                claims.FirstOrDefault(c => c.Type == "email")?.Value ??
                claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value ??
                claims.FirstOrDefault(c => c.Type.Contains("email"))?.Value ??
                "unknown";

            // Extract roles safely
            var roles = claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .Distinct()
                .ToArray();

            var roleLabel = roles.Contains("admin", StringComparer.OrdinalIgnoreCase)
                ? "admin"
                : (roles.Contains("manager", StringComparer.OrdinalIgnoreCase) ? "manager" : "user");

            var message = $"Hello {roleLabel}, your UID is {userId}, your email is {email}";

            return Ok(new { message, uid = userId, email, roles });
        }
    }
}
