using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using SmartInventory.Models;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class InventoryLogsController : ControllerBase
    {
        private readonly FirestoreDb _firestore;

        public InventoryLogsController(FirestoreDb firestore)
        {
            _firestore = firestore;
        }

        // ─────────────────────────────────────────────
        // MULTI MOVEMENT (IN / OUT)
        // ─────────────────────────────────────────────
        [HttpPost("multi")]
        public async Task<IActionResult> RecordMultiMovement([FromBody] InventoryMovementRequest request)
        {
            if (request == null || request.Items == null || request.Items.Count == 0)
                return BadRequest(new { message = "Invalid request data." });

            if (string.IsNullOrWhiteSpace(request.Type))
                return BadRequest(new { message = "Movement type is required." });

            if (string.IsNullOrWhiteSpace(request.Reason))
                return BadRequest(new { message = "Reason is required." });

            WriteBatch batch = _firestore.StartBatch();
            CollectionReference logsCol = _firestore.Collection("inventoryLogs");

            foreach (var item in request.Items)
            {
                if (item.Quantity <= 0)
                    continue;

                // 1) Fetch product
                DocumentReference productRef = _firestore.Collection("products").Document(item.ProductId);
                DocumentSnapshot productSnap = await productRef.GetSnapshotAsync();

                if (!productSnap.Exists)
                    return NotFound(new { message = $"Product {item.ProductId} not found." });

                var p = productSnap.ToDictionary();

                double price = p.ContainsKey("price") ? Convert.ToDouble(p["price"]) : 0;
                double sellingPrice = p.ContainsKey("sellingPrice") ? Convert.ToDouble(p["sellingPrice"]) : 0;
                double stock = p.ContainsKey("stockQuantity") ? Convert.ToDouble(p["stockQuantity"]) : 0;
                

                // 2) Stock change
                int qty = item.Quantity;
                double delta = request.Type == "IN" ? qty :
                               request.Type == "OUT" ? -qty : 0;

                double newStock = stock + delta;

                if (newStock < 0)
                    return BadRequest(new { message = $"Not enough stock for product {item.ProductName}." });

                // 3) Calculate Costs & Profits
                double totalCost = 0;
                double? totalRevenue = null;
                double? profit = null;

                switch (request.Type)
                {
                    case "IN":
                        // Restock OR Return OR Adjustment(+)
                        totalCost = price * qty;
                        break;

                    case "OUT":
                        if (request.Reason == "sale")
                        {
                            totalCost = price * qty;
                            totalRevenue = sellingPrice * qty;
                            profit = totalRevenue - totalCost;
                        }
                        else if (request.Reason == "damage")
                        {
                            totalCost = price * qty;
                            profit = -totalCost; // full loss
                        }
                        else if (request.Reason == "return")
                        {
                            // OUT + return = treated as IN? No, OUT-return not logical
                            // but if OUT-return, consider return to stock:
                            delta = qty; // treat as IN
                            newStock = stock + qty;
                        }
                        else
                        {
                            // adjustment(-) or unknown
                            totalCost = price * qty;
                        }
                        break;
                }

                // 4) Save stock update
                batch.Update(productRef, new Dictionary<string, object>
                {
                    { "stockQuantity", newStock },
                    { "updatedAt", FieldValue.ServerTimestamp }
                });

                // 5) Save log entry
                var logData = new Dictionary<string, object>
                {
                    ["productId"] = item.ProductId,
                    ["productName"] = item.ProductName,
                    ["quantity"] = item.Quantity,
                    ["type"] = request.Type,
                    ["reason"] = request.Reason,
                    ["price"] = price,
                    ["sellingPrice"] = sellingPrice,
                    ["totalCost"] = totalCost,
                    ["totalRevenue"] = totalRevenue,
                    ["profit"] = profit,
                    ["note"] = request.Note ?? "",
                    ["createdBy"] = request.CreatedBy ?? "system",
                    ["createdAt"] = FieldValue.ServerTimestamp
                };

                batch.Create(logsCol.Document(), logData);
            }

            await batch.CommitAsync();

            return Ok(new { message = "Inventory movement recorded successfully." });
        }

        // ─────────────────────────────────────────────
        // GET ALL LOGS
        // ─────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetAllLogs()
        {
            QuerySnapshot snap = await _firestore.Collection("inventoryLogs")
                .OrderByDescending("createdAt")
                .GetSnapshotAsync();

            var logs = new List<Dictionary<string, object>>();
            
            foreach (DocumentSnapshot doc in snap.Documents)
            {
                var data = doc.ToDictionary();
                var logDict = new Dictionary<string, object>();
                
                // Copy all fields
                foreach (var kvp in data)
                {
                    
                    if (kvp.Value is Timestamp timestamp)
             {
    
                 logDict[kvp.Key] = timestamp.ToDateTime();
             }
                   else
             { 
                 logDict[kvp.Key] = kvp.Value;
             }

                }
                
                logs.Add(logDict);
            }
            
            return Ok(logs);
        }
    }
}
