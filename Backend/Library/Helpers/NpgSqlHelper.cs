using Microsoft.Extensions.DependencyInjection;

namespace Library.Helpers
{
    public static class NpgSqlHelper
    {
        private static string EnableLegacyTimestampBehavior { get; } = "Npgsql.EnableLegacyTimestampBehavior";

        /// <summary>
        /// Enable NpgSql Legacy timestap behavior to allow qurying with local timezone ect..,
        /// </summary>
        public static void NpgSqlEnableLegacyTimestampBehavior(this IServiceCollection _)
            => AppContext.SetSwitch(EnableLegacyTimestampBehavior, true);

        //public static string BuildPgbouncerConnectionString(string connectionString)
        //{
        //    var port = Web.IsDevelopment() ? "6433" : "4326";
        //    var host = new Uri(EMicroService.pgbouncer.GetServiceHost()).Host;
        //    var obj = TenantUtility.GetConnStringObject(connectionString);
        //    var postgresConnString = $"Server={host};Port={port};User ID={obj.UserID};Password={obj.Password};Pooling=true;Maximum Pool Size=200;Min Pool Size=10;Connection Idle Lifetime=300;";
        //    return postgresConnString;
        //}
    }
}
