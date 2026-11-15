namespace SmartInventory.Models
{
    public class Warehouse
    {
        public string? Id { get; set; }          // Firestore document ID
        public required string Name { get; set; }
        public string? City { get; set; }
        public required string Address { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? AdminId { get; set; }     // Assigned admin user ID
        public string? CreatedBy { get; set; }    // SuperAdmin who created it
        public DateTime? CreatedAt { get; set; }
    }
}





