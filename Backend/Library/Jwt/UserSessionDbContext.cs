using Library.Models;
using Microsoft.EntityFrameworkCore;

namespace Library.Jwt
{
    public class UserSessionDbContext(DbContextOptions<UserSessionDbContext> options) : DbContext(options)
    {
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            base.OnConfiguring(optionsBuilder);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
        }

        public DbSet<UserSession> UserSession { get; set; }
        public DbSet<UserSessionToken> UserSessionToken { get; set; }
        //public DbSet<ClientConnect> ClientConnect { get; set; }
        //public DbSet<UserSessionTenant> UserSessionTenant { get; set; }
        //public DbSet<BusinessMember> BusinessMember { get; set; }
    }

}
