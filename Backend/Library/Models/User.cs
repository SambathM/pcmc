using Localize.Helper.Extensions.Helpers;
using Newtonsoft.Json;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Diagnostics.CodeAnalysis;

namespace Library.Models
{
    public class User
    {
        public long Id { get; set; }
        public Guid SubJectId { get; set; } = Guid.NewGuid();

        [AllowNull, StringLength(maximumLength: 50)]
        public string? FirstName { get; set; }

        [AllowNull, StringLength(maximumLength: 50)]
        public string? LastName { get; set; }

        [StringLength(maximumLength: 50), AllowNull]
        public string? Phone { get; set; }
        public string PhoneCode { get; set; } = string.Empty;

        [StringLength(maximumLength: 50), DataType(DataType.EmailAddress)]
        public string Email { get; set; } = string.Empty;
        /// <summary>
        /// Get normalized email (lowercase, no spaces)
        /// </summary>
        /// <returns></returns>
        public string GetNormalizedEmail() => Email.LowerNoSpaces() ?? string.Empty;

        [StringLength(maximumLength: 50), DataType(DataType.EmailAddress)]
        public string Username { get; set; } = string.Empty;


        public DateTime? CreatedOn { get; set; } = DateTime.UtcNow;

        public bool IsActivated { get; set; } = false;

        public bool IsActive { get; set; } = true;

        [AllowNull]
        public string? Photo { get; set; }

        [AllowNull, JsonIgnore]
        public byte[]? PasswordHash { get; set; }

        [AllowNull, JsonIgnore]
        public byte[]? PasswordSalt { get; set; }

        /// <summary>
        /// define user has set password or not
        /// </summary>
        [DefaultValue(true)]
        public bool IsSetPwd { get; set; } = true;

        public int? CountryId { get; set; }
        /// flags
        //[NotMapped]
        [JsonIgnore]
        public string? Password { get; set; }


        /// <summary>
        /// Get phone number with country code, a valid to be able to send or call
        /// </summary>
        /// <returns></returns>
        public string GetValidPhone()
        {
            return PhoneCode + Phone?.TrimStart('0');
        }
    }

    public class IdentityUtility
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
    }

    public enum EUserSource
    {
        localize,
        google,
        facebook,
        twitter,
    }
}
