namespace TelegramEngine.Helpers
{
    public class TSignalRMethod
    {
        public static string OnTlgLoggedIn { get; } = "onTlgLoggedIn";
        public static string OnTlgQrTimeout { get; } = "onTlgQrTimeout";
        public static string OnPasswordState { get; } = "onPasswordState";
        public static string OnTlgQrChange { get; } = "onTlgQrChange";
        public static string OnTlgLoginPhone { get; } = "onTlgLoginPhone";
        public static string OnAuthRestart { get; } = "onAuthRestart";
        public static string OnAuthorized { get; } = "onAuthorized";
        public static string OnDisconnected { get; } = "onDisconnected";
    }
}
