using Localize.Helper.Extensions;
using Localize.Helper.Helpers;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using RestSharp;
using System.Net;

namespace Library.Http
{
    public partial class HttpHelper
    {
        internal sealed record RequestRetryOptions(int Max = 3,
            int DelayMs = 2000,
            Func<RestResponse, bool>? ShouldRetry = null
        );

        private async Task<RestResponse> CoreRequestRetryAsync(string baseAddress,
            RequestOption option,
            bool? insecure = false,
            RequestRetryOptions? retryOptions = null)
        {
            var maxRetry = retryOptions?.Max ?? 0;
            for (int attempt = 0; ; attempt++)
            {
                var response = await CoreRequestAsync(baseAddress, option, insecure);
                var shouldRetry = retryOptions?.ShouldRetry;
                if (attempt >= maxRetry || (shouldRetry != null && !shouldRetry(response)))
                {
                    return response;
                }

                var delayMs = retryOptions?.DelayMs ?? 0;
                if (delayMs > 0)
                {
                    await Task.Delay(delayMs);
                }
            }
        }

        private async Task<TResult?> CoreRequestRetryAsync<TResult>(string baseAddress,
            RequestOption option,
            bool? insecure,
            RequestRetryOptions? retryOptions = null)
        {
            var response = await CoreRequestRetryAsync(baseAddress, option, insecure, retryOptions);
            if (AcceptStatus.Contains(response.StatusCode))
                return response.Content == null ? default : response.Content.FromJson<TResult>();

            var errorMsg = string.Format("Request {0}/{1}, ErrorCode: {2}, response: {3}", baseAddress, option.Path, response.StatusCode, response.ErrorMessage);

            if (ToThrowStatus.Contains(response.StatusCode))
            {
                _logger.Info(errorMsg);
                throw new Exception(response.ErrorMessage ?? "HTTP request failed.");
            }
            return default;
        }

        private async Task<RestResponse> CoreRequestAsync(string baseAddress, RequestOption option, bool? insecure = false)
        {
            option.Headers ??= [];
            try
            {
                var restOptions = new RestClientOptions(baseAddress)
                {
                    RemoteCertificateValidationCallback = insecure == true ? (_, _, _, _) => true : default
                };

                var client = new RestClient(restOptions);
                var request = new RestRequest(option.Path, option.Method) { Timeout = TimeSpan.FromMinutes(_env.IsDevelopment() ? 1 : 10) };

                if (!option.Headers.Any(x => x.Key == Header.XTenant))
                {
                    var tenant = _webService.GetRequestHeader(Header.XTenant);
                    option.Headers.AddWhen(tenant != null, new(Header.XTenant, tenant ?? string.Empty));
                }

                // Intercept Bearer Token and fallback handling
                if (string.IsNullOrEmpty(option.BearerToken))
                {
                    var fallbackToken = _webService.GetBearerTokenFromHeader();
                    if (string.IsNullOrEmpty(fallbackToken))
                    {
                        fallbackToken = _webService.GetRefreshToken();
                    }

                    option.BearerToken = fallbackToken;
                }

                // Normalize Bearer Token Header
                if (!string.IsNullOrEmpty(option.BearerToken))
                {
                    var normalizedBearer = NormalizeBearerToken(option.BearerToken);
                    var scheme = _accessor.HttpContext?.Request.Scheme ?? Scheme.Https;

                    request.AddHeader(Header.Authorization, $"{Scheme.Bearer} {normalizedBearer}");
                    request.AddHeader(Header.Origin, $"{scheme}://{_webService.GetHost()}");
                    request.AddHeader(Header.XCross, "true");
                }

                Worker.DoWhen(option.Body != null, ()
                    => request.AddParameter(ContentType.Json, option.Body!.ToJson() ?? "{}", ParameterType.RequestBody));

                request.HasMoreHeaders(option.Headers);
                var response = await client.ExecuteAsync(request);
                return response;
            }
            catch (Exception ex)
            {
                _logger.Warn(ex.ToString());
                throw;
            }
        }


        public static HttpStatusCode[] ToThrowStatus { get; } =
        [
            0,
            HttpStatusCode.NotFound,
            HttpStatusCode.Unauthorized,
            HttpStatusCode.GatewayTimeout,
            HttpStatusCode.RequestTimeout,
            HttpStatusCode.InternalServerError
        ];

        public static HttpStatusCode[] AcceptStatus { get; } = [
            HttpStatusCode.OK,
            HttpStatusCode.NoContent,
            HttpStatusCode.Created
        ];

        public static QueryString GenerateQueryString(IEnumerable<KeyValuePair<string, string?>>? queryParams)
        {
            if (queryParams == null || !queryParams.Any())
                return QueryString.Empty;

            return QueryString.Create(queryParams);
        }

        public static string? NormalizeBearerToken(string? bearerToken)
        {
            if (string.IsNullOrEmpty(bearerToken))
                return null;
            return bearerToken.Trim().Split(' ').Last();
        }
    }
}
