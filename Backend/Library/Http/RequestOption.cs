using RestSharp;

namespace Library.Http
{
    public class RequestOption
    {
        /// <summary>
        /// default value = <see cref="string.Empty"/>
        /// </summary>
        public string Path { get; set; } = string.Empty;
        /// <summary>
        /// default value = <see cref="Method.Get"/>
        /// </summary>
        public Method Method { get; set; } = Method.Get;
        /// <summary>
        /// default value = <see cref="null"/>
        /// </summary>
        public object? Body { get; set; }
        /// <summary>
        /// default value = <see cref="null"/>
        /// </summary>
        public string? BearerToken { get; set; }
        /// <summary>
        /// default value = <see cref="null"/>
        /// </summary>
        public List<Header>? Headers { get; set; }
        /// <summary>
        /// defines the request is ssl check or not
        /// </summary>
        public bool Insecure { get; set; } = false;
    }
}
