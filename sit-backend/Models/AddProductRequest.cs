namespace SmartInventory.Models
{
    public class AddProductRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        // Price = cost price
        public double Price { get; set; }

        // Selling price
        public double? SellingPrice { get; set; }

        public int StockQuantity { get; set; }
        public int Threshold { get; set; }

        public string CategoryId { get; set; } = string.Empty;
        public string SupplierId { get; set; } = string.Empty;

        public DateTime? ExpiryDate { get; set; }
    }
}
