using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Reflection;
using System.Transactions;

namespace Library.Utils
{
    /// <summary>
    /// Provides utility methods for working with transactions.
    /// </summary>
    public static class TransactionUtility
    {
        /// <summary>
        /// Sets the value of a private field in the <see cref="TransactionManager"/> class.
        /// </summary>
        /// <param name="fieldName">The name of the field to set.</param>
        /// <param name="value">The value to set.</param>
        private static void SetTransactionManagerField(string fieldName, object value)
        {
            typeof(TransactionManager).GetField(fieldName, BindingFlags.NonPublic | BindingFlags.Static)
                ?.SetValue(null, value);
        }

        /// <summary>
        /// Sets the default values for the <see cref="TransactionManager"/>.
        /// </summary>
        internal static void DefaultTransactionManager()
        {
            SetTransactionManagerField("s_cachedMaxTimeout", true);
            SetTransactionManagerField("s_maximumTimeout", Timeout);
        }

        private static readonly TimeSpan Timeout = TimeSpan.FromMinutes(60);

        /// <summary>
        /// Creates a new <see cref="System.Transactions.TransactionScope"/> with the specified options and a default timeout.
        /// </summary>
        /// <param name="scopeOption">The transaction scope option.</param>
        /// <param name="timeout">The timeout for the transaction scope.</param>
        /// <returns>A new instance of <see cref="System.Transactions.TransactionScope"/>.</returns>
        public static TransactionScope AsyncScope(TransactionScopeOption scopeOption, TimeSpan? timeout = null)
        {
            DefaultTransactionManager();
            return new(scopeOption, timeout ?? Timeout, TransactionScopeAsyncFlowOption.Enabled);
        }

        /// <summary>
        /// Creates a new <see cref="System.Transactions.TransactionScope"/> with the default options and a default timeout.
        /// </summary>
        /// <param name="timeout">The timeout for the transaction scope.</param>
        /// <returns>A new instance of <see cref="System.Transactions.TransactionScope"/>.</returns>
        public static TransactionScope AsyncScope(TimeSpan? timeout = null)
        {
            DefaultTransactionManager();
            return new(TransactionScopeOption.Required, timeout ?? Timeout, TransactionScopeAsyncFlowOption.Enabled);
        }

        /// <summary>
        /// Creates a new <see cref="System.Transactions.TransactionScope"/> with the specified isolation level and a default timeout.
        /// </summary>
        /// <param name="isolationLevel">The isolation level for the transaction scope.</param>
        /// <returns>A new instance of <see cref="System.Transactions.TransactionScope"/>.</returns>
        public static TransactionScope AsyncScope(IsolationLevel isolationLevel)
        {
            DefaultTransactionManager();
            return new(TransactionScopeOption.Required, new TransactionOptions { IsolationLevel = isolationLevel }, TransactionScopeAsyncFlowOption.Enabled);
        }

        /// <summary>
        /// Creates a new <see cref="System.Transactions.TransactionScope"/> with the default options and a default timeout.
        /// </summary>
        /// <returns>A new instance of <see cref="System.Transactions.TransactionScope"/>.</returns>
        public static TransactionScope Scope()
        {
            DefaultTransactionManager();
            return new(TransactionScopeOption.Required, Timeout);
        }

        /// <summary>
        /// An array of deadlock error messages.
        /// </summary>
        public static readonly string[] DeadlockErrors = [
            "transient failure",
            "could not serialize access"
        ];

        /// <summary>
        /// Determines if the specified exception is a deadlock exception.
        /// </summary>
        /// <param name="ex">The exception to check.</param>
        /// <returns><c>true</c> if the exception is a deadlock exception; otherwise, <c>false</c>.</returns>
        public static bool IsDeadlock(Exception ex)
        {
            foreach (var x in DeadlockErrors)
            {
                if (ex.ToString().Contains(x, StringComparison.OrdinalIgnoreCase))
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Begins a new database transaction for the specified <see cref="DbContext"/> instance.
        /// </summary>
        /// <param name="dbContext">The <see cref="DbContext"/> instance.</param>
        /// <returns>The <see cref="IDbContextTransaction"/> representing the new transaction, or <c>null</c> if a transaction is already active.</returns>
        public static IDbContextTransaction? TransactionScope(this DbContext dbContext)
        {
            DefaultTransactionManager();
            return dbContext.Database.CurrentTransaction == null
                ? dbContext.Database.BeginTransaction()
                : null;
        }

        /// <summary>
        /// Begins a new database transaction asynchronously for the specified <see cref="DbContext"/> instance.
        /// </summary>
        /// <param name="dbContext">The <see cref="DbContext"/> instance.</param>
        /// <returns>A task that represents the asynchronous operation. The task result contains the <see cref="IDbContextTransaction"/> representing the new transaction, or <c>null</c> if a transaction is already active.</returns>
        public static async Task<IDbContextTransaction?> TransactionScopeAsync(this DbContext dbContext)
        {
            DefaultTransactionManager();
            return dbContext.Database.CurrentTransaction == null
                ? await dbContext.Database.BeginTransactionAsync()
                : null;
        }

        /// <summary>
        /// Commits the specified database transaction safely without throwing exceptions if the transaction is <c>null</c>.
        /// </summary>
        /// <param name="transaction">The <see cref="IDbContextTransaction"/> to commit.</param>
        public static void Complete(this IDbContextTransaction? transaction) => transaction?.Commit();

        /// <summary>
        /// Commits the specified database transaction safely without throwing exceptions if the transaction is <c>null</c>.
        /// </summary>
        public static async Task CompleteAsync(this IDbContextTransaction? transaction)
        {
            if (transaction != null)
                await transaction.CommitAsync();
        }

    }
}
