using FirebaseAdmin.Auth;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using SmartInventory.Models;
using System.Net;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/warehouses")]
    public class WarehousesController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public WarehousesController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        public sealed class CreateWarehouseRequest
        {
            public string? Name { get; set; }
            public string? Address { get; set; }
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public string? AdminId { get; set; }
        }

        public sealed class UpdateWarehouseRequest
        {
            public string? Name { get; set; }
            public string? Address { get; set; }
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public string? AdminId { get; set; }
        }

        private async Task<(bool ok, string? uid, string? role, IActionResult? errorResult)> RequireSuperAdminAsync()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                return (false, null, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            var token = authHeader.Substring("Bearer ".Length).Trim();
            if (string.IsNullOrWhiteSpace(token))
            {
                return (false, null, null, Unauthorized(new { message = "Missing Authorization Bearer token." }));
            }

            FirebaseToken decoded;
            try
            {
                decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);
            }
            catch
            {
                return (false, null, null, Unauthorized(new { message = "Invalid or expired token." }));
            }

            var callerUid = decoded.Uid;
            if (string.IsNullOrWhiteSpace(callerUid))
            {
                return (false, null, null, Unauthorized(new { message = "Invalid token (no uid)." }));
            }

            var callerDoc = await _firestore.Collection("users").Document(callerUid).GetSnapshotAsync().ConfigureAwait(false);
            if (!callerDoc.Exists)
            {
                return (false, callerUid, null, Forbid());
            }

            var role = callerDoc.ContainsField("role") ? (callerDoc.GetValue<string>("role") ?? string.Empty) : string.Empty;
            var status = callerDoc.ContainsField("status") ? (callerDoc.GetValue<string>("status") ?? "active") : "active";

            if (!string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
            {
                return (false, callerUid, null, Forbid());
            }

            // Only superadmin can manage warehouses
            var roleLower = role?.Trim().ToLowerInvariant() ?? string.Empty;
            if (roleLower != "superadmin")
            {
                return (false, callerUid, roleLower, Forbid());
            }

            return (true, callerUid, roleLower, null);
        }

        // GET ALL WAREHOUSES
        [HttpGet]
        public async Task<IActionResult> GetAllWarehouses()
        {
            var (ok, callerUid, callerRole, errorResult) = await RequireSuperAdminAsync();
            if (!ok) return errorResult!;

            var warehouses = new List<Warehouse>();
            QuerySnapshot snapshot = await _firestore.Collection("warehouses").GetSnapshotAsync();

            foreach (DocumentSnapshot doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();

                data.TryGetValue("name", out var nameObj);
                data.TryGetValue("address", out var addressObj);
                data.TryGetValue("latitude", out var latObj);
                data.TryGetValue("longitude", out var lonObj);
                data.TryGetValue("adminId", out var adminIdObj);
                data.TryGetValue("createdBy", out var createdByObj);
                data.TryGetValue("createdAt", out var createdAtObj);

                double lat = latObj != null ? Convert.ToDouble(latObj) : 0;
                double lon = lonObj != null ? Convert.ToDouble(lonObj) : 0;

                DateTime? createdAt = null;
                if (createdAtObj is Timestamp ts)
                    createdAt = ts.ToDateTime();

                warehouses.Add(new Warehouse
                {
                    Id = doc.Id,
                    Name = nameObj?.ToString() ?? "",
                    Address = addressObj?.ToString() ?? "",
                    Latitude = lat,
                    Longitude = lon,
                    AdminId = adminIdObj?.ToString(),
                    CreatedBy = createdByObj?.ToString(),
                    CreatedAt = createdAt
                });
            }

            return Ok(warehouses);
        }

        // GET WAREHOUSE BY ID
        [HttpGet("{id}")]
        public async Task<IActionResult> GetWarehouseById(string id)
        {
            var (ok, callerUid, callerRole, errorResult) = await RequireSuperAdminAsync();
            if (!ok) return errorResult!;

            DocumentReference docRef = _firestore.Collection("warehouses").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Warehouse not found");

            var data = snapshot.ToDictionary();

            data.TryGetValue("name", out var nameObj);
            data.TryGetValue("address", out var addressObj);
            data.TryGetValue("latitude", out var latObj);
            data.TryGetValue("longitude", out var lonObj);
            data.TryGetValue("adminId", out var adminIdObj);
            data.TryGetValue("createdBy", out var createdByObj);
            data.TryGetValue("createdAt", out var createdAtObj);

            double lat = latObj != null ? Convert.ToDouble(latObj) : 0;
            double lon = lonObj != null ? Convert.ToDouble(lonObj) : 0;

            DateTime? createdAt = null;
            if (createdAtObj is Timestamp ts)
                createdAt = ts.ToDateTime();

            var warehouse = new Warehouse
            {
                Id = snapshot.Id,
                Name = nameObj?.ToString() ?? "",
                Address = addressObj?.ToString() ?? "",
                Latitude = lat,
                Longitude = lon,
                AdminId = adminIdObj?.ToString(),
                CreatedBy = createdByObj?.ToString(),
                CreatedAt = createdAt
            };

            return Ok(warehouse);
        }

        // CREATE WAREHOUSE
        [HttpPost]
        public async Task<IActionResult> CreateWarehouse([FromBody] CreateWarehouseRequest req)
        {
            var (ok, callerUid, callerRole, errorResult) = await RequireSuperAdminAsync();
            if (!ok) return errorResult!;

            var name = (req.Name ?? string.Empty).Trim();
            var address = (req.Address ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Name is required." });

            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { message = "Address is required." });

            try
            {
                var docRef = _firestore.Collection("warehouses").Document();
                await docRef.SetAsync(new Dictionary<string, object?>
                {
                    ["name"] = name,
                    ["address"] = address,
                    ["latitude"] = req.Latitude,
                    ["longitude"] = req.Longitude,
                    ["adminId"] = string.IsNullOrWhiteSpace(req.AdminId) ? null : req.AdminId.Trim(),
                    ["createdBy"] = callerUid,
                    ["createdAt"] = FieldValue.ServerTimestamp
                }).ConfigureAwait(false);

                Console.WriteLine($"[WarehouseCreate] Created warehouse {docRef.Id} by {callerUid}");

                return Ok(new { id = docRef.Id });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WarehouseCreate] Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to create warehouse." });
            }
        }

        // UPDATE WAREHOUSE
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateWarehouse(string id, [FromBody] UpdateWarehouseRequest req)
        {
            var (ok, callerUid, callerRole, errorResult) = await RequireSuperAdminAsync();
            if (!ok) return errorResult!;

            var docRef = _firestore.Collection("warehouses").Document(id);
            var snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Warehouse not found");

            var name = (req.Name ?? string.Empty).Trim();
            var address = (req.Address ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(name))
                return BadRequest(new { message = "Name is required." });

            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { message = "Address is required." });

            try
            {
                await docRef.UpdateAsync(new Dictionary<string, object?>
                {
                    ["name"] = name,
                    ["address"] = address,
                    ["latitude"] = req.Latitude,
                    ["longitude"] = req.Longitude,
                    ["adminId"] = string.IsNullOrWhiteSpace(req.AdminId) ? null : req.AdminId.Trim()
                }).ConfigureAwait(false);

                Console.WriteLine($"[WarehouseUpdate] Updated warehouse {id} by {callerUid}");

                return Ok(new { message = "Warehouse updated successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WarehouseUpdate] Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to update warehouse." });
            }
        }

        // DELETE WAREHOUSE
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteWarehouse(string id)
        {
            var (ok, callerUid, callerRole, errorResult) = await RequireSuperAdminAsync();
            if (!ok) return errorResult!;

            var docRef = _firestore.Collection("warehouses").Document(id);
            var snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Warehouse not found");

            try
            {
                await docRef.DeleteAsync().ConfigureAwait(false);

                Console.WriteLine($"[WarehouseDelete] Deleted warehouse {id} by {callerUid}");

                return Ok(new { message = "Warehouse deleted successfully." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WarehouseDelete] Error: {ex.Message}");
                return StatusCode(500, new { message = "Failed to delete warehouse." });
            }
        }
    }
}





