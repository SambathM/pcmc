using Library.Models;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Telegrams
{
    public class TelegramStatus
    {
        public TelegramStatus() { }
        public TelegramStatus(ETelegramStatus status, string? message = null)
        {
            Status = status;
            Message = message;
        }

        public string? Message { get; set; }
        public ETelegramStatus Status { get; set; } = ETelegramStatus.Unconfigured;
        public ETelegramCheckState CheckState { get; set; }
        public string? InstanceId { get; set; }
        public object? Data { get; set; }
    }
}
