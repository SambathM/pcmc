namespace TelegramEngine.Services;

internal interface ISignalRHubService
{
    Task SendMessageAsync(string groupName, string methodName, object message);
    Task SendMessageAsync(string groupName, string methodName, object message, bool toCamelcase);
}

internal class SignalRHubService(
    IServiceProvider svp,
    TelegramOptions options) : ISignalRHubService
{
    private readonly TelegramOptions _options = options;
    public async Task SendMessageAsync(
        string groupName,
        string methodName,
        object message)
    {
        if (_options.SendMessageAsync == null)
            throw new InvalidOperationException("SendMessageAsync delegate is not set in TelegramOptions.");

        await _options.SendMessageAsync(groupName, methodName, message, svp);
    }

    public async Task SendMessageAsync(
        string groupName,
        string methodName,
        object message,
        bool toCamelcase)
    {
        if (_options.SendMessageAsync == null)
            throw new InvalidOperationException("SendMessageAsync delegate is not set in TelegramOptions.");

        if (toCamelcase)
            await _options.SendMessageAsync(groupName, methodName, message, svp);

    }
}
