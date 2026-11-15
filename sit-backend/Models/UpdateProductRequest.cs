namespace SmartInventory.Models
{
    public class UpdateProductRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }

        // Price = cost price
        public double? Price { get; set; }

        // Selling price
        public double? SellingPrice { get; set; }

        public int? StockQuantity { get; set; }
        public int? Threshold { get; set; }

        public string? CategoryId { get; set; }
        public string? SupplierId { get; set; }

        public DateTime? ExpiryDate { get; set; }
    }
}
