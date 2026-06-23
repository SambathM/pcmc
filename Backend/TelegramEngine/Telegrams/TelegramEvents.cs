using Library.Models;

namespace TelegramEngine.Telegrams
{
    /// <summary>
    /// Teleram events handler
    /// </summary>
    public class TelegramEvents
    {
        /// <summary>
        /// On Telegram sending message failed event handler
        /// </summary>
        public Action<TelegramMessage>? OnFailedHandler { get; set; }
        /// <summary>
        /// On Telegram sending message success event handler
        /// </summary>
        public Action<TelegramMessage>? OnSentHandler { get; set; }
        public Action<TelegramContact, TelegramMessage>? OnInitContact { get; set; }
    }
}
