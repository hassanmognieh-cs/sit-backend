using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using SmartInventory.Models;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/categories")]
    public class CategoriesController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public CategoriesController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        // ─────────────────────────────────────────────
        // GET ALL CATEGORIES
        // ─────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetAllCategories()
        {
            var categories = new List<Category>();

            QuerySnapshot snapshot =
                await _firestore.Collection("categories").GetSnapshotAsync();

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

                string? description = null;
                if (data.TryGetValue("description", out var descriptionValue))
                    description = descriptionValue?.ToString();

                categories.Add(new Category
                {
                    Id = doc.Id,
                    Name = name,
                    Description = description,
                    CreatedAt = createdAt,
                    UpdatedAt = updatedAt
                });
            }

            return Ok(categories);
        }

        // ─────────────────────────────────────────────
        // GET CATEGORY BY ID
        // ─────────────────────────────────────────────
        [HttpGet("{id}")]
        public async Task<IActionResult> GetCategoryById(string id)
        {
            DocumentReference docRef = _firestore.Collection("categories").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Category not found");

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

            string? description = null;
            if (data.TryGetValue("description", out var descriptionValue))
                description = descriptionValue?.ToString();

            var category = new Category
            {
                Id = snapshot.Id,
                Name = name,
                Description = description,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt
            };

            return Ok(category);
        }

        // ─────────────────────────────────────────────
        // ADD CATEGORY (POST)
        // ─────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> AddCategory([FromBody] AddCategoryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Category name is required.");

            var timestamp = Timestamp.GetCurrentTimestamp();

            var data = new Dictionary<string, object?>
            {
                { "name", request.Name },
                { "description", request.Description },
                { "createdAt", timestamp },
                { "updatedAt", timestamp }
            };

            DocumentReference newDoc = await _firestore.Collection("categories").AddAsync(data);

            return Ok(new Category
            {
                Id = newDoc.Id,
                Name = request.Name,
                Description = request.Description,
                CreatedAt = timestamp.ToDateTime(),
                UpdatedAt = timestamp.ToDateTime()
            });
        }

        // ─────────────────────────────────────────────
        // UPDATE CATEGORY (PUT)
        // ─────────────────────────────────────────────
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCategory(string id, [FromBody] UpdateCategoryRequest request)
        {
            DocumentReference docRef = _firestore.Collection("categories").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Category not found");

            var updates = new Dictionary<string, object?>();

            if (!string.IsNullOrWhiteSpace(request.Name))
                updates["name"] = request.Name;

            if (request.Description != null)
                updates["description"] = request.Description;

            updates["updatedAt"] = Timestamp.GetCurrentTimestamp();

            await docRef.UpdateAsync(updates);

            return Ok("Category updated successfully.");
        }

        // ─────────────────────────────────────────────
        // DELETE CATEGORY
        // ─────────────────────────────────────────────
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCategory(string id)
        {
            DocumentReference docRef = _firestore.Collection("categories").Document(id);
            DocumentSnapshot snap = await docRef.GetSnapshotAsync();

            if (!snap.Exists)
                return NotFound("Category not found");

            await docRef.DeleteAsync();

            return Ok("Category deleted successfully.");
        }
    }
}

