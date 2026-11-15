namespace SmartInventory.Models
{
    public class AddCategoryRequest
    {
        public required string Name { get; set; }
        public string? Description { get; set; }
    }
}

