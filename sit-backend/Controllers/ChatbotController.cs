using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Security.Claims;
using System.Linq;
using System;

namespace SmartInventory.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ChatbotController : ControllerBase
    {
        private readonly FirestoreDb _firestore;//connection firebase

        public ChatbotController(FirestoreDb firestore)
        {
            _firestore = firestore;//object firestore
        }

        // ─────────────────────────────────────────
        // MODELS
        // ─────────────────────────────────────────
        public class ChatRequest//data from angular
        {
            public string? Question { get; set; }//store in question
        }

        public class ChatResponse
        {
            public string Answer { get; set; } = string.Empty;//answr to angular
        }

        // ─────────────────────────────────────────
        // MAIN ENDPOINT
        // ─────────────────────────────────────────
        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] ChatRequest request)
        {
            string q = (request.Question ?? "").Trim();

            if (string.IsNullOrWhiteSpace(q))
            {
                return Ok(new ChatResponse
                {
                    Answer = "Please ask me something about your inventory 😊"
                });
            }

            string lower = q.ToLower();

            // Check if user is employee(ma lezem ykoun employee) and question is sensitive
            string userRole = GetUserRole();
            if (!string.IsNullOrEmpty(userRole) && userRole == "employee" && IsSensitiveQuestion(lower))
            {
                return Ok(new ChatResponse
                {
                    Answer = "Sorry, as an employee, you can only ask questions about products and categories. You don't have access to information about suppliers, sales reports, profits, or inventory values. Please ask about specific products, their stock levels, prices, or categories."
                });
            }

            // ──────── hello ────────
            if (IsGreeting(lower))
            {
                return Ok(new ChatResponse
                {
                    Answer = "Hello! 👋 I’m your Smart Inventory Assistant. How can I help you today?"
                });
            }

            // ───────────────────────────────
            // CATEGORY 1 — STOCK STATUS
            // ───────────────────────────────

            if (lower.Contains("how many") && (lower.Contains("in stock") || lower.Contains("do i have")))
            {
                var answer = await AnswerCurrentStockOfProduct(lower);
                return Ok(new ChatResponse { Answer = answer });
            }

            if (lower.Contains("low in stock") || (lower.Contains("low stock") && lower.Contains("which")) ||
                lower.Contains("what products are low in stock"))
            {
                var answer = await AnswerLowStockProducts();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // TOTAL INVENTORY VALUE
            // ───────────────────────────────

            if (lower.Contains("total inventory value") || lower.Contains("inventory value") ||
                lower.Contains("show me the total inventory"))
            {
                var answer = await AnswerTotalInventoryValue();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // EXPIRED PRODUCTS
            // ───────────────────────────────

            if (lower.Contains("expired") || lower.Contains("which products have expired"))
            {
                var answer = await AnswerExpiredProducts();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // PRODUCTS EXPIRING SOON
            // ───────────────────────────────

            if (lower.Contains("expiring soon") || lower.Contains("show me products expiring"))
            {
                var answer = await AnswerExpiringSoonProducts();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // TOP SELLING PRODUCTS
            // ───────────────────────────────

            if (lower.Contains("top selling") || lower.Contains("top sell") ||
                lower.Contains("what are the top selling products"))
            {
                var answer = await AnswerTopSellingProducts();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // MONTHLY PROFIT
            // ───────────────────────────────

            if (lower.Contains("profit") && (lower.Contains("month") || lower.Contains("this month")) ||
                lower.Contains("how much profit did we make"))
            {
                var answer = await AnswerMonthlyProfit();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // SUPPLIERS LIST
            // ───────────────────────────────

            if (lower.Contains("which suppliers") || lower.Contains("suppliers do we work") ||
                lower.Contains("list suppliers"))
            {
                var answer = await AnswerSuppliersList();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // CURRENT STOCK LEVEL
            // ───────────────────────────────

            if (lower.Contains("current stock level") || lower.Contains("what is the current stock"))
            {
                var answer = await AnswerCurrentStockLevel();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // CATEGORY 2 — RESTOCK ADVICE
            // ───────────────────────────────

            if (lower.Contains("what should i restock") || lower.Contains("restock first"))
            {
                var answer = await AnswerWhatToRestockFirst();
                return Ok(new ChatResponse { Answer = answer });
            }

            if (lower.Contains("enough stock") && (lower.Contains("week") || lower.Contains("next week")))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerEnoughStockNextWeek()
                });
            }

            // ───────────────────────────────
            // CATEGORY 3 — CALCULATIONS
            // ───────────────────────────────

            if (lower.Contains("if i sell") && (lower.Contains("how many") || lower.Contains("left") || lower.Contains("remain")))
            {
                var answer = await AnswerRemainingAfterSale(lower);
                return Ok(new ChatResponse { Answer = answer });
            }

            if (lower.Contains("cost of this product") || lower.Contains("how much should i sell"))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerSuggestedSellingPrice(lower)
                });
            }

            // ───────────────────────────────
            // CATEGORY 4 — BEST / SLOW SELLERS
            // ───────────────────────────────

            if (lower.Contains("best-selling") || lower.Contains("best selling"))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerBestSellingConcept()
                });
            }

            if (lower.Contains("not selling well") || lower.Contains("slow movers") || lower.Contains("slow-moving"))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerSlowMovingConcept()
                }); 
            }

            // ───────────────────────────────
            // CATEGORY 5 — SYSTEM HELP
            // ───────────────────────────────

            if (lower.Contains("what can you do") || lower.Contains("help me with"))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerWhatCanYouDo()
                });
            }

            if (lower.Contains("how do i add") && lower.Contains("product"))
            {
                return Ok(new ChatResponse
                {
                    Answer = AnswerHowToAddProduct()
                });
            }

            // ───────────────────────────────
            // CATEGORY 6 — PRODUCT PRICE
            // ───────────────────────────────

            if (lower.Contains("price of") || lower.Contains("what is the price") || lower.Contains("cost of"))
            {
                var answer = await AnswerProductPrice(lower);
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // CATEGORY 7 — SUPPLIER COUNT
            // ───────────────────────────────

            if (lower.Contains("number of supplier") || lower.Contains("how many supplier") || 
                lower.Contains("supplier count") || lower.Contains("total supplier"))
            {
                var answer = await AnswerSupplierCount();
                return Ok(new ChatResponse { Answer = answer });
            }

            // ───────────────────────────────
            // FALLBACK
            // ───────────────────────────────

            return Ok(new ChatResponse
            {
                Answer = "Sorry, I don't know how to answer this yet. Try asking me about stock levels, low-stock products, restocking advice, pricing, product prices, supplier counts, or best-sellers."
            });
        }

        // ─────────────────────────────────────────
        // GREETINGS HELPER
        // ─────────────────────────────────────────
        private bool IsGreeting(string lower)
        {
            return lower == "hi" ||
                   lower == "hello" ||
                   lower.StartsWith("hi ") ||
                   lower.StartsWith("hello ") ||
                   lower.Contains("hey") ||
                   lower.Contains("good morning") ||
                   lower.Contains("good evening");
        }

        // ─────────────────────────────────────────
        // CATEGORY 1 — STOCK STATUS
        // ─────────────────────────────────────────

        private async Task<string> AnswerCurrentStockOfProduct(string lower)
        {
            var productDoc = await FindProductByNameFromQuestion(lower);
            if (productDoc == null)
                return "I couldn’t detect which product you mean . Please include the full name.";

            var data = productDoc.ToDictionary();

            string name = data["name"]?.ToString() ?? "this product";
            long quantity = GetLongValue(data, "stockQuantity");

            return $"You currently have {quantity} pieces of \"{name}\" in stock.";
        }

        private async Task<string> AnswerLowStockProducts()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            var list = new List<string>();

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                string name = data["name"]?.ToString() ?? "Unnamed";

                long qty = GetLongValue(data, "stockQuantity");
                long threshold = GetLongValue(data, "threshold", 10);

                if (qty <= threshold)
                    list.Add($"{name} (qty: {qty}, threshold: {threshold})");
            }

            if (list.Count == 0)
                return "Great! 🎉 No products are below their threshold.";

            var sb = new StringBuilder("These products are low in stock:\n");
            foreach (var item in list)
                sb.AppendLine($"• {item}");

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 2 — RESTOCK ADVICE
        // ─────────────────────────────────────────

        private async Task<string> AnswerWhatToRestockFirst()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            var list = new List<(string Name, long Qty, long Threshold)>();

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();

                string name = data["name"]?.ToString() ?? "Unnamed";
                long qty = GetLongValue(data, "stockQuantity");
                long threshold = GetLongValue(data, "threshold", 10);

                if (qty <= threshold)
                    list.Add((name, qty, threshold));
            }

            if (list.Count == 0)
                return "Nothing is critically low 🎉.";

            list.Sort((a, b) => a.Qty.CompareTo(b.Qty));

            var sb = new StringBuilder("You should restock these products first:\n");
            foreach (var p in list)
                sb.AppendLine($"• {p.Name} — qty: {p.Qty}, threshold: {p.Threshold}");

            return sb.ToString();
        }

        private string AnswerEnoughStockNextWeek()
        {
            return "To know if you have enough stock for next week, compare your average daily sales with your stock quantities. In this simple version, any product below its threshold may not be enough for next week.";
        }

        // ─────────────────────────────────────────
        // CATEGORY 3 — CALCULATIONS
        // ─────────────────────────────────────────

        private async Task<string> AnswerRemainingAfterSale(string lower)
        {
            var match = Regex.Match(lower, @"\d+");
            if (!match.Success)
                return "Please specify how many units you plan to sell.";

            int sellCount = int.Parse(match.Value);

            var productDoc = await FindProductByNameFromQuestion(lower);
            if (productDoc == null)
                return "I couldn’t detect which product you mean .";

            var data = productDoc.ToDictionary();

            string name = data["name"]?.ToString() ?? "this product";
            long qty = GetLongValue(data, "stockQuantity");

            long remaining = qty - sellCount;
            if (remaining < 0) remaining = 0;

            return $"You currently have {qty} pieces of \"{name}\". After selling {sellCount}, you'll have {remaining} left.";
        }

        private string AnswerSuggestedSellingPrice(string lower)
        {
            var match = Regex.Match(lower, @"\d+(\.\d+)?");
            if (!match.Success)
                return "Please include the cost price.";

            decimal cost = decimal.Parse(match.Value);
            decimal suggested = cost * 1.30m;
            decimal max = cost * 1.50m;

            return $"If the cost is {cost:0.00}$, a good selling price is between {suggested:0.00}$ and {max:0.00}$.";
        }

        // ─────────────────────────────────────────
        // CATEGORY 4 — BEST & SLOW SELLERS
        // ─────────────────────────────────────────

        private string AnswerBestSellingConcept()
        {
            return "Your best-selling products are usually the ones with the highest sales in the last month. In this simple version, you can track this by adding a 'soldCount' field later.";
        }

        private string AnswerSlowMovingConcept()
        {
            return "Slow-moving products are those with very low sales during the last month while still having stock. These may need discounts or reduced ordering.";
        }

        // ─────────────────────────────────────────
        // CATEGORY 5 — HELP / SYSTEM GUIDE
        // ─────────────────────────────────────────

        private string AnswerWhatCanYouDo()
        {
            return "I can help you with:\n" +
                   "• Checking product stock\n" +
                   "• Listing low-stock items\n" +
                   "• Suggesting what to restock\n" +
                   "• Doing stock calculations\n" +
                   "• Advising about pricing\n" +
                   "• Explaining how to use the system";
        }

        private string AnswerHowToAddProduct()
        {
            return "To add a new product:\n" +
                   "1️⃣ Go to the Products page\n" +
                   "2️⃣ Click 'Add Product'\n" +
                   "3️⃣ Fill in the name, cost price, selling price, quantity, and threshold\n" +
                   "4️⃣ Save the product\n" +
                   "5️⃣ It will appear in your inventory";
        }

        // ─────────────────────────────────────────
        // CATEGORY 6 — PRODUCT PRICE
        // ─────────────────────────────────────────

        private async Task<string> AnswerProductPrice(string lower)
        {
            var productDoc = await FindProductByNameFromQuestion(lower);
            if (productDoc == null)
                return "I couldn't detect which product you mean . Please include the full product name.";

            var data = productDoc.ToDictionary();

            string name = data["name"]?.ToString() ?? "this product";
            decimal costPrice = GetDecimalValue(data, "price");
            decimal? sellingPrice = null;

            if (data.ContainsKey("sellingPrice") && data["sellingPrice"] != null)
            {
                if (data["sellingPrice"] is long l) 
                {
                    sellingPrice = (decimal)l;
                }
                else if (data["sellingPrice"] is double d) 
                {
                    sellingPrice = (decimal)d;
                }
                else 
                {
                    if (decimal.TryParse(data["sellingPrice"].ToString(), out decimal parsed) && parsed > 0)
                    {
                        sellingPrice = parsed;
                    }
                }
            }

            var sb = new StringBuilder();
            sb.AppendLine($"Price information for \"{name}\":");
            sb.AppendLine($"💰 Cost Price: ${costPrice:F2}");

            if (sellingPrice.HasValue && sellingPrice.Value > 0)
            {
                sb.AppendLine($"💵 Selling Price: ${sellingPrice.Value:F2}");
                decimal profit = sellingPrice.Value - costPrice;
                sb.AppendLine($"📈 Profit per unit: ${profit:F2}");
            }
            else
            {
                sb.AppendLine("💵 Selling Price: Not set");
            }

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 7 — SUPPLIER COUNT
        // ─────────────────────────────────────────

        private async Task<string> AnswerSupplierCount()
        {
            var snapshot = await _firestore.Collection("suppliers").GetSnapshotAsync();
            int count = snapshot.Documents.Count;

            if (count == 0)
                return "You currently have 0 suppliers in your system.";

            var sb = new StringBuilder();
            sb.AppendLine($"You have {count} supplier{(count == 1 ? "" : "s")} in your system:");

            int index = 1;
            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                string name = data.ContainsKey("name") ? data["name"]?.ToString() ?? "Unnamed" : "Unnamed";
                sb.AppendLine($"{index}. {name}");
                index++;
            }

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 8 — TOTAL INVENTORY VALUE
        // ─────────────────────────────────────────

        private async Task<string> AnswerTotalInventoryValue()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            decimal totalValue = 0;
            int productCount = 0;

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                decimal price = GetDecimalValue(data, "price");
                long quantity = GetLongValue(data, "stockQuantity");
                totalValue += price * quantity;
                productCount++;
            }

            return $"Your total inventory value is ${totalValue:F2}.\n" +
                   $"This is calculated from {productCount} product{(productCount == 1 ? "" : "s")} in your system.";
        }

        // ─────────────────────────────────────────
        // CATEGORY 9 — EXPIRED PRODUCTS
        // ─────────────────────────────────────────

        private async Task<string> AnswerExpiredProducts()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            var expiredList = new List<string>();
            DateTime now = DateTime.UtcNow;

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                if (!data.ContainsKey("expiryDate")) continue;

                if (data["expiryDate"] is Timestamp ts)
                {
                    DateTime expiry = ts.ToDateTime();
                    if (expiry < now)
                    {
                        string name = data.ContainsKey("name") ? data["name"]?.ToString() ?? "Unnamed" : "Unnamed";
                        expiredList.Add($"{name} (expired on {expiry:dd/MM/yyyy})");
                    }
                }
            }

            if (expiredList.Count == 0)
                return "Great! 🎉 No products have expired.";

            var sb = new StringBuilder();
            sb.AppendLine($"You have {expiredList.Count} expired product{(expiredList.Count == 1 ? "" : "s")}:");
            foreach (var item in expiredList)
                sb.AppendLine($"• {item}");

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 10 — EXPIRING SOON PRODUCTS
        // ─────────────────────────────────────────

        private async Task<string> AnswerExpiringSoonProducts()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            var expiringList = new List<string>();
            DateTime now = DateTime.UtcNow;
            DateTime sevenDaysFromNow = now.AddDays(7);

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                if (!data.ContainsKey("expiryDate")) continue;

                if (data["expiryDate"] is Timestamp ts)
                {
                    DateTime expiry = ts.ToDateTime();
                    if (expiry >= now && expiry <= sevenDaysFromNow)
                    {
                        string name = data.ContainsKey("name") ? data["name"]?.ToString() ?? "Unnamed" : "Unnamed";
                        int daysLeft = (int)(expiry - now).TotalDays;
                        expiringList.Add($"{name} (expires in {daysLeft} day{(daysLeft == 1 ? "" : "s")} - {expiry:dd/MM/yyyy})");
                    }
                }
            }

            if (expiringList.Count == 0)
                return "Great! 🎉 No products are expiring within the next 7 days.";

            var sb = new StringBuilder();
            sb.AppendLine($"You have {expiringList.Count} product{(expiringList.Count == 1 ? "" : "s")} expiring soon:");
            foreach (var item in expiringList)
                sb.AppendLine($"• {item}");

            return sb.ToString();
        }

            // ─────────────────────────────────────────
            // CATEGORY 11 — TOP SELLING PRODUCTS
            // ─────────────────────────────────────────

            private async Task<string> AnswerTopSellingProducts()
            {
                var logsSnapshot = await _firestore.Collection("inventoryLogs").GetSnapshotAsync();

                var productSales = new Dictionary<string, long>();

                foreach (var doc in logsSnapshot.Documents)
                {
                    var data = doc.ToDictionary();
                    string type = data.ContainsKey("type") ? data["type"]?.ToString() ?? "" : "";
                    string reason = data.ContainsKey("reason") ? data["reason"]?.ToString() ?? "" : "";
                    
                    // Filter for OUT type and sale reason
                    if (type != "OUT" || reason != "sale") continue;

                    string productName = data.ContainsKey("productName") ? data["productName"]?.ToString() ?? "" : "";
                    long quantity = GetLongValue(data, "quantity");

                    if (!string.IsNullOrEmpty(productName))
                    {
                        if (productSales.ContainsKey(productName))
                            productSales[productName] += quantity;
                        else
                            productSales[productName] = quantity;
                    }
                }

                if (productSales.Count == 0)
                    return "No sales data available yet. Start making sales to see top selling products!";

                var topProducts = productSales.OrderByDescending(x => x.Value).Take(5).ToList();

                var sb = new StringBuilder();
                sb.AppendLine("Top 5 selling products:");
                int rank = 1;
                foreach (var product in topProducts)
                {
                    sb.AppendLine($"{rank}. {product.Key} - {product.Value} unit{(product.Value == 1 ? "" : "s")} sold");
                    rank++;
                }

                return sb.ToString();
            }

        // ─────────────────────────────────────────
        // CATEGORY 12 — MONTHLY PROFIT
        // ─────────────────────────────────────────

        private async Task<string> AnswerMonthlyProfit()
        {
            DateTime now = DateTime.UtcNow;
            DateTime startOfMonth = new DateTime(now.Year, now.Month, 1);

            var logsSnapshot = await _firestore.Collection("inventoryLogs").GetSnapshotAsync();

            decimal totalProfit = 0;
            int saleCount = 0;

            foreach (var doc in logsSnapshot.Documents)
            {
                var data = doc.ToDictionary();
                
                // Check if log is from this month
                if (data.ContainsKey("createdAt") && data["createdAt"] is Timestamp ts)
                {
                    DateTime logDate = ts.ToDateTime();
                    if (logDate < startOfMonth) continue;
                }

                if (data.ContainsKey("profit") && data["profit"] != null)
                {
                    decimal profit = GetDecimalValue(data, "profit");
                    totalProfit += profit;
                    if (profit > 0) saleCount++;
                }
            }

            var sb = new StringBuilder();
            sb.AppendLine($"Profit for {now:MMMM yyyy}:");
            sb.AppendLine($"💰 Total Profit: ${totalProfit:F2}");
            if (saleCount > 0)
                sb.AppendLine($"📊 Based on {saleCount} sale{(saleCount == 1 ? "" : "s")} this month");

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 13 — SUPPLIERS LIST
        // ─────────────────────────────────────────

        private async Task<string> AnswerSuppliersList()
        {
            var snapshot = await _firestore.Collection("suppliers").GetSnapshotAsync();
            int count = snapshot.Documents.Count;

            if (count == 0)
                return "You currently have no suppliers in your system.";

            var sb = new StringBuilder();
            sb.AppendLine($"You work with {count} supplier{(count == 1 ? "" : "s")}:");

            int index = 1;
            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                string name = data.ContainsKey("name") ? data["name"]?.ToString() ?? "Unnamed" : "Unnamed";
                string email = data.ContainsKey("email") ? data["email"]?.ToString() ?? "" : "";
                
                sb.Append($"{index}. {name}");
                if (!string.IsNullOrEmpty(email))
                    sb.Append($" ({email})");
                sb.AppendLine();
                index++;
            }

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // CATEGORY 14 — CURRENT STOCK LEVEL
        // ─────────────────────────────────────────

        private async Task<string> AnswerCurrentStockLevel()
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();
            long totalStock = 0;
            int productCount = 0;
            int outOfStockCount = 0;

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                long quantity = GetLongValue(data, "stockQuantity");
                totalStock += quantity;
                productCount++;
                if (quantity == 0) outOfStockCount++;
            }

            var sb = new StringBuilder();
            sb.AppendLine("Current Stock Overview:");
            sb.AppendLine($"📦 Total Units: {totalStock}");
            sb.AppendLine($"📋 Total Products: {productCount}");
            if (outOfStockCount > 0)
                sb.AppendLine($"⚠️ Out of Stock: {outOfStockCount} product{(outOfStockCount == 1 ? "" : "s")}");
            else
                sb.AppendLine("✅ All products have stock");

            return sb.ToString();
        }

        // ─────────────────────────────────────────
        // ROLE & PERMISSION HELPERS
        // ─────────────────────────────────────────

        private string GetUserRole()
        {
            // If User is null or not authenticated, return empty string
            if (User == null || User.Identity?.IsAuthenticated != true)
                return string.Empty;

            var claims = User.Claims ?? [];
            var roles = claims
                .Where(c => c.Type == ClaimTypes.Role)
                .Select(c => c.Value)
                .Distinct()
                .ToArray();

            if (roles.Contains("admin", StringComparer.OrdinalIgnoreCase))
                return "admin";
            if (roles.Contains("superadmin", StringComparer.OrdinalIgnoreCase))
                return "superadmin";
            if (roles.Contains("manager", StringComparer.OrdinalIgnoreCase))
                return "manager";
            if (roles.Contains("employee", StringComparer.OrdinalIgnoreCase))
                return "employee";
            
            return string.Empty;
        }

        private bool IsSensitiveQuestion(string lower)
        {
            // Suppliers related questions
            if (lower.Contains("supplier") || lower.Contains("which suppliers") || 
                lower.Contains("suppliers do we work") || lower.Contains("list suppliers") ||
                lower.Contains("number of supplier") || lower.Contains("how many supplier") || 
                lower.Contains("supplier count") || lower.Contains("total supplier"))
                return true;

            // Top selling products
            if (lower.Contains("top selling") || lower.Contains("top sell") ||
                lower.Contains("what are the top selling products") || lower.Contains("best-selling") || 
                lower.Contains("best selling"))
                return true;

            // Profit related
            if (lower.Contains("profit") && (lower.Contains("month") || lower.Contains("this month") ||
                lower.Contains("how much profit did we make")))
                return true;

            // Total inventory value
            if (lower.Contains("total inventory value") || lower.Contains("inventory value") ||
                lower.Contains("show me the total inventory"))
                return true;

            // Current stock level (overall summary)
            if (lower.Contains("current stock level") || lower.Contains("what is the current stock"))
                return true;

            // Reports related
            if (lower.Contains("report") || lower.Contains("sales report") || lower.Contains("inventory report"))
                return true;

            return false;
        }

        // ─────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────

        private long GetLongValue(Dictionary<string, object> data, string key, long defaultVal = 0)
        {
            if (!data.ContainsKey(key)) return defaultVal;

            if (data[key] is long l) return l;
            if (data[key] is double d) return (long)d;
            long.TryParse(data[key].ToString(), out long parsed);
            return parsed;
        }

        private decimal GetDecimalValue(Dictionary<string, object> data, string key, decimal defaultVal = 0)
        {
            if (!data.ContainsKey(key)) return defaultVal;

            if (data[key] is long l) return (decimal)l;
            if (data[key] is double d) return (decimal)d;
            decimal.TryParse(data[key].ToString(), out decimal parsed);
            return parsed;
        }

        private async Task<DocumentSnapshot?> FindProductByNameFromQuestion(string lower)
        {
            var snapshot = await _firestore.Collection("products").GetSnapshotAsync();

            DocumentSnapshot? best = null;
            int length = 0;

            foreach (var doc in snapshot.Documents)
            {
                var data = doc.ToDictionary();
                if (!data.ContainsKey("name")) continue;

                string name = data["name"]?.ToString()?.ToLower() ?? "";
                if (name == "") continue;

                if (lower.Contains(name) && name.Length > length)
                {
                    best = doc;
                    length = name.Length;
                }
            }

            return best;
        }
    }
}
