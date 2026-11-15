namespace SmartInventory.Models
{
    public class InventoryMovementRequest
    {
        public string Type { get; set; } = default!;        // IN / OUT
        public string? Reason { get; set; }                // sale / restock / damage...
        public string? Note { get; set; }                  // optional note
        public string? CreatedBy { get; set; }             // admin / manager

        public List<InventoryMovementItem> Items { get; set; } = new();  
    }

    public class InventoryMovementItem
    {
        public string ProductId { get; set; } = default!;   // product doc id
        public string ProductName { get; set; } = default!; // snapshot at time of movement
        public int Quantity { get; set; }                   // always positive integer
    }
}
