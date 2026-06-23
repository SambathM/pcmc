using Localize.Helper.Extensions;
using Localize.Helper.Extensions.Helpers;
using RestSharp;
using System.Web;

namespace Library.Http
{
    public static class HttpHelperExtension
    {
        internal static void HasMoreHeaders(this RestRequest request, IEnumerable<Header>? headers)
            => headers?.ForEach((h) => request.AddHeader($"{h.Key}", $"{h.Value}"));

        public static bool IsURL(this string urlString)
        {
            if (urlString.IsNullOrEmpty())
                return false;

            return (urlString.StartsWith("https://") || urlString.StartsWith("http://")) &&
                Uri.TryCreate(urlString, UriKind.RelativeOrAbsolute, out _);
        }
    }

    public static class UriExtensions
    {
        public static Uri BuildUri(this string baseUrl, object?[]? paths = null, (string Key, string Value)[]? queryParams = null)
        {
            var uri = new Uri(baseUrl);

            if (paths?.Length > 0)
                uri = uri.AppendPaths(paths);

            if (queryParams?.Length > 0)
                uri = uri.AppendParams(queryParams);

            return uri;
        }

        public static Uri AppendPaths(this Uri uri, params object?[] paths)
        {
            if (paths == null || paths.Length == 0) return uri;

            var uriBuilder = new UriBuilder(uri);
            var segments = new[] { uriBuilder.Path.TrimEnd('/') }
                .Concat(paths.Where(p => p != null).Select(p => p!.ToString()!.Trim('/')));
            uriBuilder.Path = string.Join("/", segments);
            return uriBuilder.Uri;
        }

        public static Uri AppendParams(this Uri uri, params (string Key, string Value)[] queryParams)
        {
            if (queryParams == null || queryParams.Length == 0) return uri;

            var uriBuilder = new UriBuilder(uri);
            var query = HttpUtility.ParseQueryString(uriBuilder.Query);
            foreach (var (key, value) in queryParams)
                query[key] = value;
            uriBuilder.Query = query.ToString();
            return uriBuilder.Uri;
        }

        public static Uri AppendQueryParam(this Uri uri, string key, string value)
            => uri.AppendParams((key, value));
    }
}
