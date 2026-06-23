using Library.Services;
using Localize.Helper.Extensions;
using Localize.Logger;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using RestSharp;
using System.Net;

namespace Library.Http
{
    public interface IHttpHelper
    {
        Task<string?> GlobRequest(string reqUri, Method method = Method.Get, object? body = null, Header[]? headers = null);
        Task<RestResponse> GlobRequest(string baseUrl, RequestOption requestOption);
        Task<TResult?> Request<TResult>(string baseAddress, RequestOption option);
        Task<TResult?> Request<TResult>(string baseAddress, string path, Method method, object? body, string? bearerToken = null);
        Task<RestResponse> RequestAsync(string baseAddress, RequestOption option, bool? insecure = false);
        Task<bool> IsServiceReachableAsync(string url);
    }

    public partial class HttpHelper : IHttpHelper
    {
        private readonly RestClient _restClient;
        private readonly LocalizeLogger<HttpHelper> _logger;
        private readonly HttpClient _httpClient;
        private readonly IHttpContextAccessor _accessor;
        private readonly IWebService _webService;
        private readonly IWebHostEnvironment _env;

        private readonly RestClientOptions _defaultClientOptions = new()
        {
            RemoteCertificateValidationCallback = (_, _, _, _) => true,
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
        };

        public HttpHelper(
            IWebHostEnvironment env,
            IHttpContextAccessor accessor,
            IWebService webService)
        {
            _env = env;
            _accessor = accessor;
            _webService = webService;
            _restClient = new RestClient(_defaultClientOptions);
            _logger = new LocalizeLogger<HttpHelper>();

            var handler = new HttpClientHandler
            {
                ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate | DecompressionMethods.Brotli
            };
            _httpClient = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(3) };
        }

        public async Task<string?> GlobRequest(string reqUri,
            Method method = Method.Get,
            object? body = null,
            Header[]? headers = null)
        {
            RestRequest request = new(reqUri, method);
            Worker.DoWhen(body != null, ()
                => request.AddParameter(ContentType.Json, body!.ToJson() ?? "{}", ParameterType.RequestBody));

            RestResponse response;
            try
            {
                request.HasMoreHeaders(headers);
                response = await _restClient.ExecuteAsync(request);
            }
            catch (Exception ex)
            {
                _logger.Warn(ex.ToString());
                throw;
            }

            if (AcceptStatus.Contains(response.StatusCode))
                return response.Content;

            _logger.Info("Request {0}, ErrorCode: {1}, response: {2}", reqUri, response.StatusCode, response.ErrorMessage);
            return null;
        }

        public async Task<RestResponse> GlobRequest(string baseUrl, RequestOption requestOption)
        {
            if (!string.IsNullOrWhiteSpace(requestOption.Path))
                baseUrl = $"{baseUrl.Trim().TrimEnd('/')}/{requestOption.Path.Trim().TrimStart('/')}";

            var request = new RestRequest(baseUrl, requestOption.Method);
            Worker.DoWhen(requestOption.Body != null, ()
                => request.AddParameter(ContentType.Json, requestOption.Body!.ToJson() ?? "{}", ParameterType.RequestBody));

            if (requestOption.Headers != null)
                request.HasMoreHeaders(requestOption.Headers);

            return await _restClient.ExecuteAsync(request);
        }


        public async Task<TResult?> Request<TResult>(string baseAddress, RequestOption option)
            => await CoreRequestRetryAsync<TResult>(baseAddress, option, option.Insecure);

        public async Task<TResult?> Request<TResult>(string baseAddress, string path, Method method, object? body, string? bearerToken = null)
            => await CoreRequestRetryAsync<TResult>(baseAddress, new()
            {
                Path = path,
                Body = body,
                Method = method,
                BearerToken = bearerToken
            }, false);


        public async Task<RestResponse> RequestAsync(string baseAddress, RequestOption option, bool? insecure = false)
            => await CoreRequestAsync(baseAddress, option, insecure);

        public async Task<bool> IsServiceReachableAsync(string url)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Head, url);
                using var response = await _httpClient.SendAsync(request);

                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

    }

}
