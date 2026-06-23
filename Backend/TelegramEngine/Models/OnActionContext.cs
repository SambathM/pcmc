using TelegramEngine.Logics;

namespace TelegramEngine.Models
{
    internal class OnActionContext
    {
        public TInstance? Instance { get; set; }
        public TL.User? User { get; set; }
    }
}
