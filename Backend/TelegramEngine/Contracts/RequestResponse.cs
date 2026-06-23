namespace TelegramEngine.Contracts
{
    public class RequestResponse
    {
        public bool Status { get; set; }
        public string Message { get; set; } = string.Empty;

        public RequestResponse() { }

        public RequestResponse(bool status, string message)
        {
            Status = status;
            Message = message;
        }
    }
}
