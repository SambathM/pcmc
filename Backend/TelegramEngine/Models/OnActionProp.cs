using Library.Models;
using TelegramEngine.Telegrams.Enums;

namespace TelegramEngine.Models
{
    internal class OnActionProp(string loginState, ETActionMode actionMode, ETelegramStatus status, string message)
    {
        public string LoginState { get; set; } = loginState;
        public ETActionMode ActionMode { get; set; } = actionMode;
        public ETelegramStatus Status { get; set; } = status;
        public string Message { get; set; } = message;

        internal static readonly List<OnActionProp> PropList =
        [
            new ("verification_code", ETActionMode.Code, ETelegramStatus.WaitingForCode, "Invalid phone code!"),
            new ("password", ETActionMode.Password, ETelegramStatus.NeedPassword, "Wrong password!"),
            new ("name", ETActionMode.Signup, ETelegramStatus.SignupRequired, "Invalid signup info!")
        ];
    }
}
