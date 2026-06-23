using Localize.Helper.Extensions.Helpers;

namespace Library.Extensions;

public static class StringExtensions
{
    internal static bool TryFromBase64String(this string? base64, out string? result)
    {
        result = null;
        try
        {
            result = Convert.FromBase64String(base64 ?? string.Empty).StringFromBytes();
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
