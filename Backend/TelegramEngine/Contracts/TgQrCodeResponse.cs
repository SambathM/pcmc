using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Contracts
{
    public sealed class TgQrCodeResponse
    {
        public ETelegramStatus Status { get; set; }

        public string InstanceId { get; set; } = string.Empty;
        public string QrCode { get; set; } = string.Empty;
    }
}
