using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using SmartInventory.Models;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductsController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public ProductsController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        // ─────────────────────────────────────────────
        // GET ALL PRODUCTS
        // ─────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetAllProducts()
        {
            var products = new List<Product>();
            QuerySnapshot snapshot = await _firestore.Collection("products").GetSnapshotAsync();

            foreach (DocumentSnapshot doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();

                // expiry date
                DateTime? expiry = null;
                if (data.TryGetValue("expiryDate", out var expiryObj) && expiryObj is Timestamp ts)
                    expiry = ts.ToDateTime();

                // safe getters
                data.TryGetValue("name", out var nameObj);
                data.TryGetValue("description", out var descObj);

                data.TryGetValue("price", out var priceObj);  // cost price
                data.TryGetValue("sellingPrice", out var sellingObj);

                data.TryGetValue("stockQuantity", out var stockObj);
                data.TryGetValue("threshold", out var thresholdObj);
                data.TryGetValue("categoryId", out var categoryObj);
                data.TryGetValue("supplierId", out var supplierObj);

                // parsing
                double price = priceObj != null ? Convert.ToDouble(priceObj) : 0;
                double? sellingPrice = sellingObj != null ? Convert.ToDouble(sellingObj) : null;

                int stock = stockObj != null ? Convert.ToInt32(stockObj) : 0;
                int threshold = thresholdObj != null ? Convert.ToInt32(thresholdObj) : 0;

                products.Add(new Product
                {
                    Id = doc.Id,
                    Name = nameObj?.ToString() ?? "",
                    Description = descObj?.ToString() ?? "",
                    Price = price,
                    SellingPrice = sellingPrice,
                    StockQuantity = stock,
                    Threshold = threshold,
                    CategoryId = categoryObj?.ToString() ?? "",
                    SupplierId = supplierObj?.ToString() ?? "",
                    ExpiryDate = expiry,
                    IsExpired = expiry.HasValue && expiry.Value < DateTime.UtcNow
                });
            }

            return Ok(products);
        }

        // ─────────────────────────────────────────────
        // GET PRODUCT BY ID
        // ─────────────────────────────────────────────
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProductById(string id)
        {
            DocumentReference docRef = _firestore.Collection("products").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Product not found");

            var data = snapshot.ToDictionary();

            // expiry
            DateTime? expiry = null;
            if (data.TryGetValue("expiryDate", out var expiryObj) && expiryObj is Timestamp ts)
                expiry = ts.ToDateTime();

            // safe getters
            data.TryGetValue("name", out var nameObj);
            data.TryGetValue("description", out var descObj);

            data.TryGetValue("price", out var priceObj);
            data.TryGetValue("sellingPrice", out var sellingObj);

            data.TryGetValue("stockQuantity", out var stockObj);
            data.TryGetValue("threshold", out var thresholdObj);
            data.TryGetValue("categoryId", out var categoryObj);
            data.TryGetValue("supplierId", out var supplierObj);

            double price = priceObj != null ? Convert.ToDouble(priceObj) : 0;
            double? sellingPrice = sellingObj != null ? Convert.ToDouble(sellingObj) : null;

            int stock = stockObj != null ? Convert.ToInt32(stockObj) : 0;
            int threshold = thresholdObj != null ? Convert.ToInt32(thresholdObj) : 0;

            var product = new Product
            {
                Id = snapshot.Id,
                Name = nameObj?.ToString() ?? "",
                Description = descObj?.ToString() ?? "",
                Price = price,
                SellingPrice = sellingPrice,
                StockQuantity = stock,
                Threshold = threshold,
                CategoryId = categoryObj?.ToString() ?? "",
                SupplierId = supplierObj?.ToString() ?? "",
                ExpiryDate = expiry,
                IsExpired = expiry.HasValue && expiry.Value < DateTime.UtcNow
            };

            return Ok(product);
        }

        // ─────────────────────────────────────────────
        // ADD PRODUCT
        // ─────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> AddProduct([FromBody] AddProductRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest("Product name is required.");

            DateTime? expiryUtc = null;
            if (request.ExpiryDate.HasValue)
                expiryUtc = DateTime.SpecifyKind(request.ExpiryDate.Value, DateTimeKind.Utc);

            var data = new Dictionary<string, object?>
            {
                { "name", request.Name },
                { "description", request.Description },

                // cost price
                { "price", request.Price },

                // selling price
                { "sellingPrice", request.SellingPrice },

                { "stockQuantity", request.StockQuantity },
                { "threshold", request.Threshold },
                { "categoryId", request.CategoryId },
                { "supplierId", request.SupplierId },
                { "expiryDate", expiryUtc },
                { "createdAt", Timestamp.GetCurrentTimestamp() },
                { "updatedAt", Timestamp.GetCurrentTimestamp() }
            };

            DocumentReference newDoc = await _firestore
                .Collection("products")
                .AddAsync(data);

            return Ok(new
            {
                Id = newDoc.Id,
                request.Name,
                request.Description,
                request.Price,
                request.SellingPrice,
                request.StockQuantity,
                request.Threshold,
                request.CategoryId,
                request.SupplierId,
                ExpiryDate = expiryUtc
            });
        }

        // ─────────────────────────────────────────────
        // UPDATE PRODUCT
        // ─────────────────────────────────────────────
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProduct(string id, [FromBody] UpdateProductRequest request)
        {
            DocumentReference docRef = _firestore.Collection("products").Document(id);
            DocumentSnapshot snapshot = await docRef.GetSnapshotAsync();

            if (!snapshot.Exists)
                return NotFound("Product not found");

            var updates = new Dictionary<string, object?>();

            if (!string.IsNullOrWhiteSpace(request.Name))
                updates["name"] = request.Name;

            if (!string.IsNullOrWhiteSpace(request.Description))
                updates["description"] = request.Description;

            if (request.Price.HasValue)
                updates["price"] = request.Price;

            if (request.SellingPrice.HasValue)
                updates["sellingPrice"] = request.SellingPrice;

            if (request.StockQuantity.HasValue)
                updates["stockQuantity"] = request.StockQuantity;

            if (request.Threshold.HasValue)
                updates["threshold"] = request.Threshold;

            if (!string.IsNullOrWhiteSpace(request.CategoryId))
                updates["categoryId"] = request.CategoryId;

            if (!string.IsNullOrWhiteSpace(request.SupplierId))
                updates["supplierId"] = request.SupplierId;

            if (request.ExpiryDate.HasValue)
                updates["expiryDate"] =
                    DateTime.SpecifyKind(request.ExpiryDate.Value, DateTimeKind.Utc);
            else
                updates["expiryDate"] = null;

            updates["updatedAt"] = Timestamp.GetCurrentTimestamp();

            await docRef.UpdateAsync(updates);

            return Ok("Product updated successfully.");
        }

        // ─────────────────────────────────────────────
        // DELETE PRODUCT
        // ─────────────────────────────────────────────
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProduct(string id)
        {
            DocumentReference docRef = _firestore.Collection("products").Document(id);

            if (!(await docRef.GetSnapshotAsync()).Exists)
                return NotFound("Product not found");

            await docRef.DeleteAsync();
            return Ok("Product deleted successfully.");
        }
    }
}
