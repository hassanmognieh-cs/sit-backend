namespace SmartInventory.Models
{
    public class Product
    {
        // ─────────────────────────────────────────────
        // Required Firestore fields
        // ─────────────────────────────────────────────
        public required string Id { get; set; }          // Firestore document ID
        public required string Name { get; set; }
        public required string Description { get; set; }

        // ─────────────────────────────────────────────
        // Pricing
        // ─────────────────────────────────────────────
        
        // Cost price = سعر شراء القطعة (نستخدمه لاحتساب totalCost & profit)
        public double? Price { get; set; } = null;

        // Selling price = سعر بيع القطعة
        public double? SellingPrice { get; set; } = null;

        

        // ─────────────────────────────────────────────
        // Stock
        // ─────────────────────────────────────────────
        public int StockQuantity { get; set; }

        // Used to trigger low stock alerts
        public int Threshold { get; set; }

        // ─────────────────────────────────────────────
        // Relations
        // ─────────────────────────────────────────────
        public required string CategoryId { get; set; }
        public required string SupplierId { get; set; }


        // ─────────────────────────────────────────────
        // Expiry
        // ─────────────────────────────────────────────
        public DateTime? ExpiryDate { get; set; }
        public bool IsExpired { get; set; }
        public bool HasExpiryDate => ExpiryDate.HasValue;


        // ─────────────────────────────────────────────
        // Constructors (optional but clean)
        // ─────────────────────────────────────────────
        public Product() { }
    }
}
