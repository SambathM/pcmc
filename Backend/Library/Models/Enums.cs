namespace Library.Models;

public enum EMessageStatus
{
    Sent = 1,
    Failed = 2
}

public enum ETelegramCheckState
{
    Normal = 0,
    PhoneNotAccupied = 1,
    NoProfilePhoto = 2,
    FloodWait = 3,
}

public enum ETelegramContactType
{
    User = 1,
    Group = 2,
    Chat = 3
}

public enum ETokenType
{
    Access = 1,
    Refresh = 2
}

public enum ESessionType
{
    WebApp = 1,
    ThirdParty = 2,
    MobileApp = 3,
    PowerBI = 4
}

public enum ELoginState
{
    UNKNOWN_ERROR = 1,

    ALREADY_LOGGED_IN = 2,

    /// <summary>
    /// Wait for the server to respond about login state
    /// </summary>
    WAIT_FOR_SERVER = 3,

    /// <summary>
    /// Phone code sent to user
    /// </summary>
    PHONE_CODE_SENT = 4,
    /// <summary>
    /// Invalid phone code entered by user or expired
    /// </summary>
    PHONE_CODE_INVALID = 5,
    /// <summary>
    /// Reached maximum attempts for phone code
    /// </summary>
    PHONE_CODE_MAX_ATTEMPS = 6,
    /// <summary>
    /// User needs to enter password
    /// </summary>
    PASSWORD_NEEDED = 7,

    PHONE_CODE_EXPIRED = 8,
    /// <summary>
    /// Telegram blocks the user for a short period of time
    /// </summary>
    FLOOD_WAIT = 9,
    /// <summary>
    /// User needs to sign up for a new account or login with an existing account
    /// </summary>
    SIGNUP_NEEDED = 10,

    AUTH_RESTART = 11,
}

public enum EInstanceType
{
    None = 0,
    QrLogin = 1,
    PhoneLogin = 2,
}

public enum ETActionMode
{
    None,
    Phone,
    Code,
    Password,
    Signup,
}
