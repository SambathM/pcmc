using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Diagnostics.CodeAnalysis;

namespace Library.Models
{
    /// <summary>
    /// A physical property / condo / estate managed under PCMS.
    /// </summary>
    public class PcmcProperty
    {
        public int Id { get; set; }

        [Required, StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [AllowNull, StringLength(50)]
        public string? Code { get; set; }

        [AllowNull]
        public string? Logo { get; set; }

        /// <summary>FK to TelegramSession.Id — the session used to send reminders for this property.</summary>
        public long? AssignedTelegramSessionId { get; set; }

        [ForeignKey(nameof(AssignedTelegramSessionId))]
        public TelegramSession? AssignedTelegramSession { get; set; }

        [AllowNull]
        public string? LastReminderActivity { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// A resident or tenant living at a property.
    /// </summary>
    public class PcmcCustomer
    {
        public int Id { get; set; }

        /// <summary>
        /// Human-readable resident code, e.g. "RES-D201".
        /// </summary>
        [Required, StringLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required, StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [AllowNull, StringLength(50)]
        public string? Unit { get; set; }

        [AllowNull, StringLength(50)]
        public string? Phone { get; set; }

        [AllowNull, StringLength(100)]
        public string? TelegramHandle { get; set; }

        [AllowNull, StringLength(200)]
        public string? Email { get; set; }

        [AllowNull]
        public string? Avatar { get; set; }

        /// <summary>
        /// FK to TelegramSessionContact.Id — the mapped Telegram contact for this resident.
        /// Set during import; null for residents not yet linked to a Telegram chat.
        /// </summary>
        public long? TelegramSessionContactId { get; set; }

        public bool IsActive { get; set; } = true;

        public bool ChatImported { get; set; } = false;

        public DateTime JoinDate { get; set; } = DateTime.UtcNow;

        // Navigation
        /// <summary>The properties this customer belongs to (many-to-many via PcmcCustomerLocation).</summary>
        public ICollection<PcmcCustomerLocation> Locations { get; set; } = new List<PcmcCustomerLocation>();

        [ForeignKey(nameof(TelegramSessionContactId))]
        public TelegramSessionContact? TelegramSessionContact { get; set; }
    }

    /// <summary>
    /// Bridge table — a customer can belong to many properties, a property to many customers.
    /// </summary>
    public class PcmcCustomerLocation
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }

        public int LocationId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(CustomerId))]
        public PcmcCustomer? Customer { get; set; }

        [ForeignKey(nameof(LocationId))]
        public PcmcProperty? Location { get; set; }
    }

    /// <summary>
    /// A physical unit (apartment / room / lot) belonging to a property.
    /// </summary>
    public class PcmcUnit
    {
        public int Id { get; set; }

        /// <summary>Unit identifier, e.g. "D-201".</summary>
        [Required, StringLength(50)]
        public string Code { get; set; } = string.Empty;

        [AllowNull, StringLength(50)]
        public string? Floor { get; set; }

        [AllowNull, StringLength(50)]
        public string? Building { get; set; }

        [AllowNull, StringLength(500)]
        public string? Note { get; set; }

        /// <summary>FK to PcmcProperty.Id — the property this unit belongs to.</summary>
        public int LocationId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(LocationId))]
        public PcmcProperty? Location { get; set; }
    }

    /// <summary>
    /// A billable service type available at a property.
    /// </summary>
    public class PcmcService
    {
        public int Id { get; set; }

        [Required, StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [AllowNull]
        public string? Description { get; set; }

        [AllowNull]
        public string? ReminderTemplate { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Bridge table — which customers are subscribed to which services.
    /// </summary>
    public class PcmcCustomerService
    {
        public int Id { get; set; }

        public int CustomerId { get; set; }

        public int ServiceId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime AssignedOn { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(CustomerId))]
        public PcmcCustomer? Customer { get; set; }

        [ForeignKey(nameof(ServiceId))]
        public PcmcService? Service { get; set; }
    }

    /// <summary>
    /// An AR invoice (bill) issued to a resident.
    /// Status values: "Due" | "Overdue" | "Paid"
    /// </summary>
    /// <summary>
    /// A scheduled reminder config — controls when and how AR reminders are sent.
    /// Offset examples: "-5 Days", "Due Date", "+3 Days", "+7 Days".
    /// </summary>
    public class PcmcReminderConfig
    {
        public int Id { get; set; }

        [Required, StringLength(100)]
        public string Name { get; set; } = string.Empty;

        /// <summary>Human-readable offset label, e.g. "-5 Days" or "Due Date".</summary>
        [Required, StringLength(50)]
        public string Offset { get; set; } = string.Empty;

        public bool Enabled { get; set; } = true;

        [AllowNull]
        public string? Template { get; set; }

        public int SortOrder { get; set; } = 0;

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Global configuration for how bill statuses are computed.
    /// Only one row should exist; use the default (PreparingDays=5, OverdueDays=7) when absent.
    /// </summary>
    public class PcmcBillRule
    {
        public int Id { get; set; }

        /// <summary>Days before due date when the system begins the alerting phase.
        /// Used by the automated sender to decide when to fire pre-due reminders.</summary>
        public int PreparingDays { get; set; } = 5;

        /// <summary>Days after due date before status transitions to Overdue.</summary>
        public int OverdueDays { get; set; } = 7;

        public DateTime UpdatedOn { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// One row per status transition on a bill.  Populated by the status interceptor and
    /// (future) automated sender whenever a bill enters a new phase or a send is attempted.
    /// </summary>
    public class PcmcBillStatusLog
    {
        public int Id { get; set; }

        public int BillId { get; set; }

        [Required, StringLength(20)]
        public string StatusName { get; set; } = string.Empty;

        public DateTime OperationDate { get; set; } = DateTime.UtcNow;

        /// <summary>"Success" | "Failed" | "Pending"</summary>
        [Required, StringLength(20)]
        public string Outcome { get; set; } = "Success";

        public string? Reason { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        [ForeignKey(nameof(BillId))]
        public PcmcBill? Bill { get; set; }
    }

    /// <summary>
    /// An AR invoice (bill) issued to a resident.
    /// Status values: "Preparing" | "Due" | "Overdue" | "Paid"
    /// Status is computed by the system; only "Paid" may be set by the admin.
    /// </summary>
    public class PcmcBill
    {
        public int Id { get; set; }

        [Column(TypeName = "numeric(18,2)")]
        public decimal Amount { get; set; }

        public DateTime DueDate { get; set; }

        /// <summary>
        /// "Due" | "Overdue" | "Paid"
        /// </summary>
        [Required, StringLength(20)]
        public string Status { get; set; } = "Due";

        public bool AutoSend { get; set; } = false;

        /// <summary>
        /// FK to PcmcUnit.Id — the unit this bill belongs to. The property/location
        /// is reached through the unit (PcmcUnit.LocationId). The unit code is read
        /// through this relation rather than stored on the bill.
        /// </summary>
        public int? UnitId { get; set; }

        /// <summary>
        /// FK to PcmcCustomer.Id — the resident this bill is issued to. The resident
        /// code and name are read through this relation rather than stored on the bill.
        /// </summary>
        public int? CustomerId { get; set; }

        /// <summary>
        /// FK to PcmcService.Id — the billed service. The service name is read through
        /// this relation rather than stored on the bill.
        /// </summary>
        public int? ServiceId { get; set; }

        public DateTime? PaidDate { get; set; }

        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey(nameof(UnitId))]
        public PcmcUnit? UnitRef { get; set; }

        [ForeignKey(nameof(CustomerId))]
        public PcmcCustomer? Customer { get; set; }

        [ForeignKey(nameof(ServiceId))]
        public PcmcService? ServiceRef { get; set; }

        public ICollection<PcmcBillStatusLog> StatusLogs { get; set; } = [];
    }
}
