using Localize.Helper.Extensions;
using Microsoft.AspNetCore.Mvc.Formatters;
using System.Text.Json;

namespace Library.Http
{
    public class TextPlainInputFormatter : InputFormatter
    {
        private const string ContentType = "text/plain";

        public TextPlainInputFormatter()
        {
            SupportedMediaTypes.Add(ContentType);
        }

        public override async Task<InputFormatterResult> ReadRequestBodyAsync(InputFormatterContext context)
        {
            var request = context.HttpContext.Request;

            // Read the plain text content from the request body
            using var reader = new StreamReader(request.Body);
            var plainTextContent = await reader.ReadToEndAsync();

            // Attempt to parse the plain text as JSON
            try
            {
                // Validate that the content is valid JSON
                var jsonDocument = plainTextContent.FromJson<object>();

                // Rewind the request body stream (so it can be read again by the framework)
                var memoryStream = new MemoryStream();
                var writer = new StreamWriter(memoryStream);
                writer.Write(jsonDocument);
                writer.Flush();
                memoryStream.Position = 0;

                // Replace the request body with the JSON content
                request.Body = memoryStream;

                // Update the Content-Type header to application/json
                request.ContentType = "application/json";
                // Let the framework handle the JSON body as usual
                return await InputFormatterResult.SuccessAsync(jsonDocument);
            }
            catch (JsonException)
            {
                // If the content is not valid JSON, return an error
                return await InputFormatterResult.FailureAsync();
            }

        }

        public override bool CanRead(InputFormatterContext context)
        {
            var contentType = context.HttpContext.Request.ContentType;
            return contentType?.StartsWith(ContentType, StringComparison.OrdinalIgnoreCase) == true;
        }
    }
}
