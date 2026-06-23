namespace TelegramEngine.Telegrams.Enums
{
    public enum ETelegramStatus
    {
        None = 0,
        Valid = 1,
        Unconfigured = 2,
        NotVerified = 3,
        InvalidCode = 4,
        UnknownError = 5,
        WaitingForCode = 6,
        ConnectionError = 7,
        NeedPassword = 8,
        NeedEmailVerification = 9,
        AuthRestart = 10,
        CodeExpired = 11,
        SignupRequired = 12,
        PhoneNotOccupied = 13,
        FloodWaitX = 14,
        Reset = 15,
        Timeout = 16,
        AlreadyLoggedIn = 17,
        Disposed = 18,
    }

    public enum EAuthorizationState
    {
        Valid = 1,
        Unauthorized = 2,
        LostConnection = 3,
        NotLoggedIn = 4,
    }
}
