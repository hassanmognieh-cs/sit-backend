using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using SmartInventory.Models;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/suppliers")]
    public class SuppliersController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public SuppliersController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        // ─────────────────────────────────────────────
        // GET ALL SUPPLIERS
        // ─────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetAllSuppliers()
        {
            var suppliers = new List<Supplier>();

            QuerySnapshot snapshot =
                await _firestore.Collection("suppliers").GetSnapshotAsync();

            foreach (DocumentSnapshot doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();

                DateTime createdAt = DateTime.UtcNow;
                DateTime updatedAt = DateTime.UtcNow;

                if (data.TryGetValue("createdAt", out var createdAtValue) && createdAtValue is Timestamp createdAtTs)
                    createdAt = createdAtTs.ToDateTime();

                if (data.TryGetValue("updatedAt", out var updatedAtValue) && updatedAtValue is Timestamp updatedAtTs)
                    updatedAt = updatedAtTs.ToDateTime();

                string name = "";
                if (data.TryGetValue("name", out var nameValue))
                    name = nameValue?.ToString() ?? "";

                string? email = null;
                if (data.TryGetValue("email", out var emailValue))
                    email = emailValue?.ToString();

                string? phone = null;
                if (data.TryGetValue("phone", out var phoneValue))
                    phone = phoneValue?.ToString();

                string? address = null;
                if (data.TryGetValue("address", out var addressValue))
                    address = addressValue?.ToString();

                string? description = null;
                if (data.TryGetValue("description", out var descriptionValue))
                    description = descriptionValue?.ToString();

                suppliers.Add(new Supplier
                {
                    Id = doc.Id,
                    Name = name,
                    Email = email,
                    Phone = phone,
                    Address = address,
                    Description = description,
                    CreatedAt = createdAt,
                    UpdatedAt = updatedAt
                });
            }

            return Ok(suppliers);
        }

        // ─────────────────────────────────────────────
        // GET SUPPLIER BY ID
        // ─────────────────────────────────────────────
        [HttpGet("{id}")]
        public async Task<IActionResult> GetSupplierById(string id)
        {
            DocumentReference docRef = _firestore.Collection("suppliers").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Supplier not found");

            var data = snapshot.ToDictionary();

            DateTime createdAt = DateTime.UtcNow;
            DateTime updatedAt = DateTime.UtcNow;

            if (data.TryGetValue("createdAt", out var createdAtValue) && createdAtValue is Timestamp createdAtTs)
                createdAt = createdAtTs.ToDateTime();

            if (data.TryGetValue("updatedAt", out var updatedAtValue) && updatedAtValue is Timestamp updatedAtTs)
                updatedAt = updatedAtTs.ToDateTime();

            string name = "";
            if (data.TryGetValue("name", out var nameValue))
                name = nameValue?.ToString() ?? "";

            string? email = null;
            if (data.TryGetValue("email", out var emailValue))
                email = emailValue?.ToString();

            string? phone = null;
            if (data.TryGetValue("phone", out var phoneValue))
                phone = phoneValue?.ToString();

            string? address = null;
            if (data.TryGetValue("address", out var addressValue))
                address = addressValue?.ToString();

            string? description = null;
            if (data.TryGetValue("description", out var descriptionValue))
                description = descriptionValue?.ToString();

            var supplier = new Supplier
            {
                Id = snapshot.Id,
                Name = name,
                Email = email,
                Phone = phone,
                Address = address,
                Description = description,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt
            };

            return Ok(supplier);
        }

        // ─────────────────────────────────────────────
        // ADD SUPPLIER (POST)
        // ─────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> AddSupplier([FromBody] AddSupplierRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Supplier name is required.");

            var timestamp = Timestamp.GetCurrentTimestamp();

            var data = new Dictionary<string, object?>
            {
                { "name", request.Name },
                { "email", request.Email },
                { "phone", request.Phone },
                { "address", request.Address },
                { "description", request.Description },
                { "createdAt", timestamp },
                { "updatedAt", timestamp }
            };

            DocumentReference newDoc = await _firestore.Collection("suppliers").AddAsync(data);

            return Ok(new Supplier
            {
                Id = newDoc.Id,
                Name = request.Name,
                Email = request.Email,
                Phone = request.Phone,
                Address = request.Address,
                Description = request.Description,
                CreatedAt = timestamp.ToDateTime(),
                UpdatedAt = timestamp.ToDateTime()
            });
        }

        // ─────────────────────────────────────────────
        // UPDATE SUPPLIER (PUT)
        // ─────────────────────────────────────────────
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSupplier(string id, [FromBody] UpdateSupplierRequest request)
        {
            DocumentReference docRef = _firestore.Collection("suppliers").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Supplier not found");

            var updates = new Dictionary<string, object?>();

            if (!string.IsNullOrWhiteSpace(request.Name))
                updates["name"] = request.Name;

            if (request.Email != null)
                updates["email"] = request.Email;

            if (request.Phone != null)
                updates["phone"] = request.Phone;

            if (request.Address != null)
                updates["address"] = request.Address;

            if (request.Description != null)
                updates["description"] = request.Description;

            updates["updatedAt"] = Timestamp.GetCurrentTimestamp();

            await docRef.UpdateAsync(updates);

            return Ok("Supplier updated successfully.");
        }

        // ─────────────────────────────────────────────
        // DELETE SUPPLIER
        // ─────────────────────────────────────────────
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupplier(string id)
        {
            DocumentReference docRef = _firestore.Collection("suppliers").Document(id);
            DocumentSnapshot snap = await docRef.GetSnapshotAsync();

            if (!snap.Exists)
                return NotFound("Supplier not found");

            await docRef.DeleteAsync();

            return Ok("Supplier deleted successfully.");
        }
    }
}

