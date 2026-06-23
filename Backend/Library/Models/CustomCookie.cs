using Microsoft.AspNetCore.Http;

namespace Library.Models
{
    public class CustomCookie
    {
        public string CookieName { get; set; } = string.Empty;
        public string CookieValue { get; set; } = string.Empty;
        public CookieOptions Options { get; set; } = new()
        {
            //Expires     = DateTime.Today.AddDays(15),
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            //Domain = LocalizeConfig.Instance.Systems.Authors.MainDomain
        };
    }
}
