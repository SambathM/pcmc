namespace TelegramEngine.Models
{
    public class SessionStoreActions
    {
        public Action<Guid>? OnInserted { get; set; }
        public Func<Guid, Task>? OnInsertedAsync { get; set; }
        public Action? OnWriteUpdated { get; set; }
        public Func<Task>? OnWriteUpdatedAsync { get; set; }
        public Action<Guid>? OnDeleted { get; set; }
        public Func<Guid, Task>? OnDeletedAsync { get; set; }
    }

    public enum ETAuthorizationState
    {
        Valid = 1,
        Unauthorized,
        LostConnection,
        NotLoggedIn,
    }
}
