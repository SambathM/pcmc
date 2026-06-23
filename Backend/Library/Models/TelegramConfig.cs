namespace Library.Models
{
    public class TelegramConfig
    {
        public int ApiId { get; set; }
        public string ApiHash { get; set; } = string.Empty;
        public TelegramHosts Hosts { get; set; } = new();
    }

    public class TelegramHosts
    {
        public string DevHost { get; set; } = string.Empty;
        public string ProdHost { get; set; } = string.Empty;
    }
}
