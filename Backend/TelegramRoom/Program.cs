using Library.Extensions;
using Microsoft.AspNetCore;

namespace TelegramRoom;

public class Program
{
    public static bool IsProjectInstance { get; private set; }
    public static void Main(string[] args)
    {
        IsProjectInstance = true;
        CreateWebHostBuilder(args)
            .Build()
            .Run();
    }

    public static IWebHostBuilder CreateWebHostBuilder(string[] args)
        => WebHost.CreateDefaultBuilder(args)
            .UseContentRoot(Directory.GetCurrentDirectory())
            .DecideUsingKestrel()
            .UseStartup<Startup>();
}