using System.ComponentModel.DataAnnotations.Schema;

namespace Library.Models
{
    public class UserSession
    {
        public Guid Id { get; set; }
        public long UserId { get; set; }
        [ForeignKey(nameof(UserId))]
        public virtual User User { get; set; } = null!;
        public ESessionType SessionType { get; set; } = ESessionType.WebApp;
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }
        public string? DeviceId { get; set; }
        public string? DeviceType { get; set; }
        public string? DeviceName { get; set; }
        public bool IsActive { get; set; } = true;
        public int RevokeCount { get; set; } = 0;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastAccessed { get; set; } = DateTime.UtcNow;
        public bool IsToTerminate(int maxInactiveDays = 30)
        {
            var inactiveTime = DateTime.UtcNow - LastAccessed;
            return inactiveTime.TotalDays > maxInactiveDays;
        }

        public virtual ICollection<UserSessionToken> Tokens { get; set; } = [];
        public virtual ICollection<UserSessionTenant> Tenants { get; set; } = [];
        public UserSessionToken? GetToken(ETokenType tokenType)
            => Tokens.FirstOrDefault(x => x.TokenType == tokenType);
    }

    public class UserSessionToken
    {
        public Guid Id { get; set; }
        public Guid UserSessionId { get; set; }
        [ForeignKey(nameof(UserSessionId))]
        public virtual UserSession UserSession { get; set; } = null!;
        public ETokenType TokenType { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastModified { get; set; } = DateTime.UtcNow;
        public DateTime LastAccess { get; set; } = DateTime.UtcNow;
        public DateTime ExpiredAt { get; set; }
    }

    public class UserSessionTenant
    {
        public Guid Id { get; set; }
        public Guid UserSessionId { get; set; }
        [ForeignKey(nameof(UserSessionId))]
        public virtual UserSession UserSession { get; set; } = null!;
        /// <summary>
        /// Business (Tenant) Id
        /// </summary>
        public long TenantId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string Token { get; set; } = string.Empty;
    }

    public enum EAuthGrantType
    {
        Password = 1,
        RefreshToken = 2,
    }
}
