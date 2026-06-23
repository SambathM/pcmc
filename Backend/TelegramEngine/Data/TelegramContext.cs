using Library.Models;
using Microsoft.EntityFrameworkCore;

namespace TelegramEngine.Data
{
    public class TelegramContext(DbContextOptions<TelegramContext> options) : DbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<PcmcReminderConfig>().HasData(DataSeed.ReminderConfigs);

            modelBuilder.Entity<PcmcUtilityConfig>()
                .HasIndex(c => c.Name).IsUnique();

            modelBuilder.Entity<PcmcUtilityConfig>().HasData(new PcmcUtilityConfig
            {
                Id = 1,
                Name = "bill_rule",
                Value = "{\"preparingDays\":5,\"overdueDays\":7}",
                UpdatedOn = new DateTime(2026, 6, 23, 0, 0, 0, DateTimeKind.Utc),
            });

            modelBuilder.Entity<PcmcBillStatusLog>()
                .HasOne(l => l.Bill)
                .WithMany(b => b.StatusLogs)
                .HasForeignKey(l => l.BillId)
                .OnDelete(DeleteBehavior.Cascade);
        }

        public DbSet<User> Users { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<UserSessionToken> UserSessionTokens { get; set; }
        public DbSet<UserSessionTenant> UserSessionTenants { get; set; }
        public DbSet<TelegramSession> TelegramSessions { get; set; }
        public DbSet<TelegramSessionStore> TelegramSessionStores { get; set; }
        public DbSet<TelegramSessionContact> TelegramSessionContacts { get; set; }
        public DbSet<TelegramContact> TelegramContacts { get; set; }
        public DbSet<TelegramMessageLog> TelegramMessageLogs { get; set; }
        public DbSet<CustomerTelegramContact> CustomerTelegramContacts { get; set; }
        public DbSet<TelegramSessionBusiness> TelegramSessionBusiness { get; set; }
        public DbSet<IdentityUtility> IdentityUtilities { get; set; }

        // PCMS domain entities
        public DbSet<PcmcProperty> PcmcProperties { get; set; }
        public DbSet<PcmcUnit> PcmcUnits { get; set; }
        public DbSet<PcmcCustomer> PcmcCustomers { get; set; }
        public DbSet<PcmcCustomerLocation> PcmcCustomerLocations { get; set; }
        public DbSet<PcmcService> PcmcServices { get; set; }
        public DbSet<PcmcCustomerService> PcmcCustomerServices { get; set; }
        public DbSet<PcmcBill> PcmcBills { get; set; }
        public DbSet<PcmcReminderConfig> PcmcReminderConfigs { get; set; }
        public DbSet<PcmcUtilityConfig> PcmcUtilityConfigs { get; set; }
        public DbSet<PcmcBillStatusLog> PcmcBillStatusLogs { get; set; }

    }
}
