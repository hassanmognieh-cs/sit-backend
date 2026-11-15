namespace sit_backend.DTOs
{
    public class ProductCreateDto
    {
        public string Name { get; set; } = "";
        public string Category { get; set; } = "";
        public int Quantity { get; set; }
        public int Threshold { get; set; }
    }

    public class ProductUpdateDto
    {
        public string? Name { get; set; }
        public string? Category { get; set; }
        public int? Quantity { get; set; }
        public int? Threshold { get; set; }
    }
}
