using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Net.Sockets;
using System.Text.RegularExpressions;

namespace Library
{
    public static partial class NpsqlUtility
    {
        //public static string ConnectionStringBuilder(TenantObject tenantObject)
        //{
        //    ArgumentNullException.ThrowIfNull(tenantObject);
        //    var connString = LocalizeConfig.Instance.IsProjectInstance
        //        ? tenantObject.ConnString
        //        : LocalizeConfig.Instance.Databases.DefaultConnectionStrings;

        //    return $"{OverrideConnString(connString)}Pooling=true;TrustServerCertificate=True;MaxPoolSize=1024;CommandTimeout=0;Include Error Detail=true;";
        //}

        //internal static string OverrideConnString(string connString)
        //{
        //    try
        //    {
        //        return RegConnPassword()
        //            .Replace(RegConnServer()
        //            .Replace(connString, $"Server={LocalizeConfig.Instance.SqlServer.Sql.Server};"),
        //                $"Password={LocalizeConfig.Instance.SqlServer.Sql.Password};");
        //    }
        //    catch
        //    {
        //        return connString;
        //    }
        //}

        public static bool IsPostgresqlConnectionException(this Exception ex, out string sqlState)
        {
            sqlState = string.Empty;
            if (ex == null) return false;
            if (ex.IsNpgOrPostgresqlException(out var state))
            {
                sqlState = state.state ?? string.Empty;
                return state.isTransient ||
                       state.state == PostgresErrorCodes.CannotConnectNow ||
                       state.state == PostgresErrorCodes.AdminShutdown ||
                       state.state == PostgresErrorCodes.ConnectionDoesNotExist
                        || ex.InnerException is SocketException se && se.SocketErrorCode == SocketError.ConnectionReset
                        || ex.InnerException is IOException
                        || ex.InnerException is TimeoutException
                        || state.state?.StartsWith("08") == true;
            }
            return false;
        }


        public static bool IsNpgOrPostgresqlException(this Exception ex, out (string? state, bool isTransient) state)
        {
            var npe = ex as NpgsqlException ?? ex.InnerException as NpgsqlException;
            if (npe != null)
            {
                state = (npe?.SqlState, npe?.IsTransient ?? false);
                return true;
            }

            var pge = ex as PostgresException ?? ex.InnerException as PostgresException;
            if (pge != null)
            {
                state = (pge?.SqlState, pge?.IsTransient ?? false);
                return true;
            }

            state = (null, false);
            return false;
        }

        public static bool IsPostgresqlConcurrentError(this string? state) => state != null && TransactionFailureList.Contains(state);

        public static bool IsPostgresqlConcurrentError(this Exception ex, out string state)
        {
            state = string.Empty;
            if (ex == null) return false;
            if (ex is PostgresException pge)
                state = pge.SqlState;
            else if (ex is NpgsqlException npe)
                state = npe.SqlState ?? string.Empty;
            else
                return false;

            return TransactionFailureList.Contains(state);
        }

        public static string FieldLengthMismatchMessage(PostgresException ex) => ex.SqlState switch
        {
            PostgresErrorCodes.NumericValueOutOfRange => "Decimal number is out of range, only 18 digits are allowed",
            PostgresErrorCodes.StringDataLengthMismatch => "Invalid text length, please check and verify",
            _ => ex.Message
        };

        public static PostgresException? FindPostgresException(Exception? ex) => ex switch
        {
            PostgresException postgresException => postgresException,
            null => null,
            _ => FindPostgresException(ex.InnerException)
        };

        public static bool IsRelationExistError(PostgresException? ex) => ex != null && DuplicateList.Contains(ex.SqlState);

        //public static TransactionScope GetNewDefaultTransactionScope() => TransactionUtility.AsyncScope();

        public static string GetDbName(string connString)
        {
            var match = RegConnDatabase().Match(connString);
            return match.Success ? match.Value.Split('=').LastOrDefault()?.TrimEnd(';') ?? string.Empty : string.Empty;
        }

        public static string MigrationLockStateQuery { get; } = @"
            SELECT state FROM pg_stat_activity 
            WHERE pid IN (
                SELECT pid FROM pg_locks l 
                JOIN pg_class t ON l.relation = t.oid 
                AND t.relkind = 'r' 
                WHERE t.relname = '""__EFMigrationsHistory""'
            ) LIMIT 1;";

        public static string GenerateReindexScipt((string table, string field)[] tableFieldPair)
        {
            var script = "";
            foreach (var (table, field) in tableFieldPair)
            {
                var indexName = $"IDX_{table}_{field}";
                script += $@"CREATE INDEX IF NOT EXISTS ""{indexName}"" ON ""{table}"" (""{field}"");
                            REINDEX TABLE ""{table}"";";
            }
            return script;
        }

        private static readonly string[] TransactionFailureList =
        [
            PostgresErrorCodes.InFailedSqlTransaction,
            PostgresErrorCodes.TransactionRollback,
            PostgresErrorCodes.TransactionIntegrityConstraintViolation,
            PostgresErrorCodes.SerializationFailure,
            PostgresErrorCodes.StatementCompletionUnknown,
            PostgresErrorCodes.DeadlockDetected,
            PostgresErrorCodes.RaiseException
        ];

        private static readonly string[] DuplicateList =
        [
            PostgresErrorCodes.DuplicateColumn,
            PostgresErrorCodes.DuplicateCursor,
            PostgresErrorCodes.DuplicateDatabase,
            PostgresErrorCodes.DuplicateFunction,
            PostgresErrorCodes.DuplicatePreparedStatement,
            PostgresErrorCodes.DuplicateSchema,
            PostgresErrorCodes.DuplicateTable,
            PostgresErrorCodes.DuplicateAlias,
            PostgresErrorCodes.DuplicateObject,
            PostgresErrorCodes.UniqueViolation
        ];


        [GeneratedRegex("Server=.*?;", RegexOptions.IgnoreCase)]
        private static partial Regex RegConnServer();

        [GeneratedRegex("Password=.*?;", RegexOptions.IgnoreCase)]
        private static partial Regex RegConnPassword();

        [GeneratedRegex("Database=.*?;", RegexOptions.IgnoreCase)]
        private static partial Regex RegConnDatabase();
    }

}
