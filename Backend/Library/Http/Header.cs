namespace Library.Http
{
    public class Header(string key, string value)
    {
        public string Key { get; private set; } = key;
        public string Value { get; private set; } = value;
        //static members
        public static string Authorization { get; } = "Authorization";
        public static string XTenant { get; } = "X-Tenant";
        public static string XCross { get; } = "X-Cross";
        public static string Origin { get; } = "Origin";
    }
}
