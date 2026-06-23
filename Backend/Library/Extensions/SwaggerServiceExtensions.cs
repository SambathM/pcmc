using Localize.Helper.Extensions;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.Annotations;
using Swashbuckle.AspNetCore.SwaggerGen;
using Swashbuckle.AspNetCore.SwaggerUI;
using System.Reflection;

namespace Library.Extensions;

public class SwaggerSkipPropertyFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema?.Properties == null)
        {
            return;
        }

        var skipProperties = context.Type.GetProperties().Where(t => t.GetCustomAttribute<SwaggerIgnoreAttribute>() != null);

        foreach (var skipProperty in skipProperties)
        {
            var propertyToSkip = schema.Properties.Keys.SingleOrDefault(x => string.Equals(x, skipProperty.Name, StringComparison.OrdinalIgnoreCase));

            if (propertyToSkip != null)
            {
                schema.Properties.Remove(propertyToSkip);
            }
        }
    }
}

public static class SwaggerServiceExtensions
{
    static readonly OpenApiSecurityScheme[] HeaderList =
    [
        new() {
                Name = "Authorization",
                Scheme = "Bearer",
                Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
            },
            new() {
                Name = "X-Tenant",
                Scheme = "None",
                Description = "Tenant Id for each business. Example: \"{tenantToken}\"",
            }
    ];

    public static void AddSwaggerDocumentationService(this IServiceCollection services)
    {
        services.AddSwaggerGen(options =>
        {
            options.SchemaFilter<SwaggerSkipPropertyFilter>();
            options.SwaggerDoc("v1", new() { Title = "Localize API Docs", Version = "v1" });

            HeaderList.ForEach((security) =>
            {
                options.AddSecurityDefinition(security.Name, new()
                {
                    Description = security.Description,
                    Name = security.Name,
                    In = ParameterLocation.Header,
                    Type = SecuritySchemeType.ApiKey,
                    Scheme = security.Scheme
                });

                options.AddSecurityRequirement(new(){
                        {
                            new(){
                                Reference = new (){ Type = ReferenceType.SecurityScheme, Id = security.Name },
                                Scheme = "oauth2",
                                Name = security.Name,
                                In = ParameterLocation.Header,
                            },
                            new List <string>()
                        }
                });
            });

            options.OperationFilter<AddHeaderParameterOperationFilter>();
            // custom schema ID strategy to avoid conflicts in schema generation
            options.CustomSchemaIds(type => type.FullName);
            options.SchemaFilter<LimitDepthSchemaFilter>();
        });
    }

    public static void UseSwaggerDocumentation(this IApplicationBuilder app)
    {
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "Versioned API v1");
            options.DocumentTitle = "Localize OpenApi Docs";
            options.DefaultModelExpandDepth(3);
            options.DocExpansion(DocExpansion.None);
            options.EnablePersistAuthorization();
        });
    }
}

internal class LimitDepthSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
        => LimitDepth(schema, 0, 3);


    // Logic to limit the depth of the schema
    // This is a conceptual example; actual implementation will vary based on your specific needs
    private static void LimitDepth(OpenApiSchema schema, int currentDepth, int maxDepth)
    {
        if (currentDepth >= maxDepth)
        {
            // Clear properties to limit depth
            schema.Properties.Clear();
            return;
        }

        schema.Properties.Values.ForEach((property)
            => LimitDepth(property, currentDepth + 1, maxDepth));
    }
}

public class AddHeaderParameterOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var __auth = operation.Parameters?.FirstOrDefault(x => x.Name == "Authorization");
    }
}

