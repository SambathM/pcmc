using Microsoft.AspNetCore.SignalR;

namespace TelegramRoom;

public interface ISignalRHub
{
    Task AddConnectionGroup(string groupName);
    Task SendAsync(string groupName, string methodName, object message);
}

public class SignalRHub(IHubContext<SignalRHub> context) : Hub, ISignalRHub
{
    public async Task AddConnectionGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);

        try
        {
            ClientHandler.Clients?.RemoveAll(x => x.UserIdentifier == groupName);
            ClientHandler.Clients?.Add(new(Context.ConnectionId, groupName));
        }
        catch { }
    }

    public async Task SendAsync(string groupName, string methodName, object message)
        => await context.Clients
            .Group(groupName)
            .SendAsync(
                methodName,
                message);
}

internal class ClientHandler(string connectionId, string userIdentifier)
{
    internal readonly static List<ClientHandler> Clients = [];
    public string ConnectionId { get; set; } = connectionId;
    public string UserIdentifier { get; set; } = userIdentifier;
}
