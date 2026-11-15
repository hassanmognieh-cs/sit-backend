using Google.Cloud.Firestore;

namespace SmartInventory.Models
{
    [FirestoreData]
    public class InventoryLog
    {
        [FirestoreProperty] public string ProductId { get; set; } = string.Empty;
        [FirestoreProperty] public string ProductName { get; set; } = string.Empty;

        // IN / OUT
        [FirestoreProperty] public string Type { get; set; } = string.Empty;

        // sale / damage / return / restock / adjustment
        [FirestoreProperty] public string Reason { get; set; } = string.Empty;

        [FirestoreProperty] public int Quantity { get; set; }

        // snapshot of prices at movement time
        [FirestoreProperty] public double Price { get; set; }                // cost price
        [FirestoreProperty] public double? SellingPrice { get; set; }        // selling price

        [FirestoreProperty] public double TotalCost { get; set; }
        [FirestoreProperty] public double? TotalRevenue { get; set; }
        [FirestoreProperty] public double? Profit { get; set; }

        [FirestoreProperty] public string CreatedBy { get; set; } = string.Empty;
        [FirestoreProperty] public Timestamp CreatedAt { get; set; } = Timestamp.GetCurrentTimestamp();
    }
}
