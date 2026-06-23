using Library.Models;

namespace TelegramEngine.Data;

internal static class DataSeed
{
    internal static readonly PcmcReminderConfig[] ReminderConfigs =
    [
        new()
        {
            Id = 1, Name = "Reminder 1", Offset = "-5 Days", Enabled = true, SortOrder = 1,
            CreatedOn = new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc),
            Template = "Dear [ResidentName],\n\nYour [ServiceName] bill for Unit [UnitNumber] is $[BillAmount].\nDue Date: [DueDate] (In 5 Days)\n\nPlease make payment.\n\nThank you.\n[LocationName] Management",
        },
        new()
        {
            Id = 2, Name = "Reminder 2", Offset = "Due Date", Enabled = true, SortOrder = 2,
            CreatedOn = new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc),
            Template = "Dear [ResidentName],\n\nTODAY is the Due Date for Unit [UnitNumber] [ServiceName] bill: $[BillAmount].\nDue Date: [DueDate]\n\nPlease complete your transfer today to avoid penalties.\n\nThank you.",
        },
        new()
        {
            Id = 3, Name = "Reminder 3", Offset = "+3 Days", Enabled = true, SortOrder = 3,
            CreatedOn = new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc),
            Template = "OVERDUE: Dear [ResidentName],\n\nYour bill of $[BillAmount] for [ServiceName] (Unit [UnitNumber]) is now 3 days overdue.\nOriginal due date was [DueDate].\n\nPlease submit receipt today. Thank you.",
        },
        new()
        {
            Id = 4, Name = "Final Notice", Offset = "+7 Days", Enabled = false, SortOrder = 4,
            CreatedOn = new DateTime(2026, 6, 22, 0, 0, 0, DateTimeKind.Utc),
            Template = "WARNING: Dear [ResidentName],\n\nUnit [UnitNumber] is now 7 days overdue for [ServiceName] bill of $[BillAmount].\n\nIf payment is not received, we will take subsequent administrative measures.\n\nUK 313 Legal Operations",
        },
    ];
}
