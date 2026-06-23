using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Library.Models
{
    public class TelegramSession
    {
        public long Id { get; set; }
        public virtual ICollection<TelegramSessionContact> SessionContacts { get; set; } = [];
        public virtual ICollection<TelegramSessionBusiness> SessionBusinesses { get; set; } = [];
        public string? Code { get; set; }
        [JsonIgnore]
        public string? AccessHash { get; set; }
        public string? PhoneNumber { get; set; }
        public string? UserName { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? CountryCode { get; set; }
        public bool IsAuthorized { get; set; } = false;
        public string? ProfilePhoto { get; set; }
        public bool AuthRestart { get; set; } = false;
        public DateTime LastUpdatedOn { get; set; } = DateTime.Now;
        public DateTime? LastLoadContacts { get; set; }
    }

    public class TelegramSessionStore
    {
        public Guid Id { get; set; }
        public long? TSessionId { get; set; }
        [ForeignKey(nameof(TSessionId))]
        public virtual TelegramSession? TelegramSession { get; set; }
        [JsonIgnore]
        public byte[] Session { get; set; } = [];
        public string? PhoneNumber { get; set; }
        /// <summary>
        /// indicate that this session is for an instance
        /// </summary>
        public string? InstanceId { get; set; }
        /// <summary>
        /// indicate that this session is for a user
        /// </summary>
        public long? UserId { get; set; }
        public DateTime LastModifiedOn { get; set; } = DateTime.UtcNow;
    }

    public class TelegramSessionContact
    {
        public long Id { get; set; }
        public long TSessionId { get; set; }
        [ForeignKey(nameof(TSessionId))]
        public virtual TelegramSession TelegramSession { get; set; } = null!;
        /// <summary>
        /// TelegramContactId ForeignKey from Table TelegramContact
        /// </summary>
        public long TContactId { get; set; }
        [ForeignKey(nameof(TContactId))]
        public virtual TelegramContact TelegramContact { get; set; } = null!;
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
    }

    public class TelegramContact
    {
        public long Id { get; set; }
        /// <summary>
        /// Indicates Telegram Contact ID (User, Group or Channel) or Chat ID
        /// </summary>
        public long TContactId { get; set; }
        /// <summary>
        /// Indicates the name of Group or Channel
        /// </summary>
        public string? Title { get; set; }
        public bool? IsGroup { get; set; }
        //public bool? IsChannel { get; set; }
        /// <summary>
        /// Indicates the contact is a chat
        /// </summary>
        public bool IsChat { get; set; } = false;
        public ETelegramContactType ContactType { get; set; } = ETelegramContactType.User;
        public string? Phone { get; set; }
        public virtual ICollection<TelegramSessionContact> SessionContacts { get; set; } = [];
        [JsonIgnore]
        public int Flags { get; set; }
        [JsonIgnore]
        public bool Self { get; set; }
        public bool Contact { get; set; }
        [JsonIgnore]
        public bool MutualContact { get; set; }
        public bool Deleted { get; set; }
        public bool Bot { get; set; }
        public bool BotChatHistory { get; set; }
        public bool BotNoChats { get; set; }
        public bool Verified { get; set; }
        public bool Restricted { get; set; }
        public bool Min { get; set; }
        public bool BotInlineGeo { get; set; }
        [JsonIgnore]
        public long? AccessHash { get; set; }
        public string? Username { get; set; }
        [JsonIgnore]
        public int? BotInfoVersion { get; set; }
        public string? RestrictionReason { get; set; }
        [JsonIgnore]
        public string? BotInlinePlaceholder { get; set; }
        public string? LangCode { get; set; }
        public string? ProfilePhoto { get; set; }
        public ETelegramCheckState CheckState { get; set; } = ETelegramCheckState.Normal;
        public DateTime? LastCheckStateOn { get; set; }
        public DateTime? LastUpdateOn { get; set; }
    }

    public class TelegramMessageLog
    {
        public long Id { get; set; }
        //public EAccTranType AccountTranType { get; set; }
        public int TranId { get; set; }
        public string Message { get; set; } = string.Empty;
        public EMessageStatus MessageStatus { get; set; }
        public string? PdfFilePath { get; set; }
        public string? Reason { get; set; }
    }

    public class CustomerTelegramContact
    {
        public int Id { get; set; }
        public long? TelegramContactId { get; set; }
        [NotMapped]
        public TelegramSessionContact? SessionContact { get; set; }
        public int CustomerId { get; set; }
    }

    public class TelegramSessionBusiness
    {
        public long Id { get; set; }
        public long BusinessId { get; set; }
        public long TSessionId { get; set; }
        [ForeignKey(nameof(TSessionId))]
        public virtual TelegramSession TelegramSession { get; set; } = null!;
        public bool IsActive { get; set; } = true;
        public string? CloudDir { get; set; }
        public long? CreatedBy { get; set; }
        public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    }

}
