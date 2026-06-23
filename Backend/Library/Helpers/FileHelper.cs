///
///<helper name="FileHelper" description="control files by prefix name"></helper>
///<author name="sambath999"></author>
///<date value="07-04-2022"></date>
///

using Library.Http;
using Localize.Helper.Extensions;
using System.IO.Compression;
using System.Net;
using System.Web;

namespace Library.Helpers;

public static class FileHelper
{

    private static readonly HttpClient HttpClient = new();
    public static async Task<string?> DownloadFileAsync(string fileUrl, string? fileToSave = null, bool overwite = true)
    {
        try
        {
            var request = await HttpClient.GetAsync(new Uri(fileUrl));
            var accepts = new HttpStatusCode[] { HttpStatusCode.Created, HttpStatusCode.OK, HttpStatusCode.Accepted };
            if (!accepts.Contains(request.StatusCode) || request.Content == null)
                throw new Exception($"Content not found, status: {request.StatusCode}");

            fileToSave ??= Path.GetTempFileName();
            await Worker.DoWhenAsync(overwite, () => TryRemoveFile(fileToSave));
            using (var stream = request.Content.ReadAsStream())
            {
                using var file = File.OpenWrite(fileToSave);
                stream.CopyTo(file);
            }

            return fileToSave;
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex.ToString());
        }
        return null;
    }

    /// <summary>
    /// copy source file to new temporary file
    /// </summary>
    /// <returns>file path of temp file</returns>
    public static string? CopyToTempFile(string sourcePath)
    {
        try
        {
            var tmpFilePath = Path.GetTempFileName();
            using (var stream = File.Open(sourcePath, FileMode.Open, FileAccess.ReadWrite, FileShare.ReadWrite))
            {
                using var dstStream = File.OpenWrite(tmpFilePath);
                stream.CopyTo(dstStream);
            }
            return tmpFilePath;
        }
        catch (Exception) { }
        return null;
    }

    /// <summary>
    /// Get file name without extension from file path
    /// </summary>
    public static string GetFileNameNoExt(this string filePath)
        => string.Join(string.Empty, filePath.GetFileName().Split(".").SkipLast(1));

    public static string GetFileName(this string filePath)
    {
        string fileName;
        if (filePath.IsURL())
        {
            var decodedUrl = HttpUtility.HtmlDecode(filePath) ?? string.Empty;
            var fileNameSec = decodedUrl.Split("/").LastOrDefault();
            fileName = fileNameSec?.Split("?").FirstOrDefault() ?? string.Empty;
            return fileName;
        }

        //replace backslash to forward slash on Windows platform
        fileName = filePath?.Replace("\\", "/") ?? "";
        return fileName?.Split("/").LastOrDefault() ?? "";
    }

    public static string GetFileExtension(this string filePath)
    {
        var fileName = GetFileName(filePath);
        var ext = fileName.Split(".").LastOrDefault()?.Split("?").FirstOrDefault()?.ToLower();
        return ext ?? string.Empty;
    }


    public static void TryCreateDirectory(string dir)
    {
        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
    }
    //delete files from a directory with a given prefix
    public static void RemoveFilesWithPrefix(string prefix, string filesDir)
    {
        var files = GetFileByPrefix(prefix, filesDir);
        if (files.Count == 0) return;

        files.ForEach(f => { if (File.Exists(f)) File.Delete(f); });
    }

    //get list of full file path of matched the given prefix
    public static List<string> GetFileByPrefix(string prefix, string filesDir)
    {
        var files = Directory.GetFiles(filesDir);
        if (files.Length == 0) return [];

        //iterate through files
        var fInfo = new List<FileInfo>();
        Array.ForEach(files, x => fInfo.Add(new FileInfo(x)));

        var getFiles = fInfo
            .Where(f => f.Name.StartsWith(prefix))
            .Select(f => f.FullName)
            .ToList();

        return getFiles;
    }

    /// <summary>
    /// Try to remove file without throwing exception
    /// </summary>
    /// <param name="filePath"></param>
    public static async Task TryRemoveFile(string filePath)
    {
        if (filePath == null || !File.Exists(filePath)) return;
        var fInfo = new FileInfo(filePath);
        if (fInfo.Exists)
        {
            try { await Task.Run(fInfo.Delete); }
            catch (Exception ex)
            {
                Console.WriteLine("Unable try removing file {0}, Error: {1}", filePath, ex.ToString());
            }
        }
    }

    public static async Task TryRemoveFileUntilUnlockedAsync(
    string filePath,
    int timeoutMs = 5000,
    int retryDelayMs = 200)
    {
        if (string.IsNullOrEmpty(filePath) || !File.Exists(filePath))
            return;

        var fileInfo = new FileInfo(filePath);
        if (!fileInfo.Exists)
            return;

        var sw = System.Diagnostics.Stopwatch.StartNew();
        Exception? lastException = null;

        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            if (!IsFileLocked(fileInfo))
            {
                try
                {
                    fileInfo.Delete();
                    return; // Success
                }
                catch (IOException ioEx)
                {
                    lastException = ioEx;
                }
                catch (UnauthorizedAccessException uaEx)
                {
                    lastException = uaEx;
                }
                catch (Exception ex)
                {
                    lastException = ex;
                }
            }
            await Task.Delay(retryDelayMs);
        }

        // Optionally, log or throw after timeout
        if (lastException != null)
        {
            Console.WriteLine($"Unable to remove file '{filePath}' after {timeoutMs}ms. Last error: {lastException.Message}");
        }
        else
        {
            Console.WriteLine($"Unable to remove file '{filePath}' after {timeoutMs}ms. File may still be locked or missing.");
        }
    }

    public static bool IsFileLocked(FileInfo file)
    {
        FileStream? stream = null;
        try
        {
            // Try to open the file with exclusive access
            stream = file.Open(FileMode.Open, FileAccess.ReadWrite, FileShare.None);
            return false;
        }
        catch (IOException)
        {
            return true;
        }
        catch (UnauthorizedAccessException)
        {
            // Could be a directory, or file is read-only or locked
            return true;
        }
        finally
        {
            stream?.Close();
        }
    }

    public static bool IsFileUnlocked(string filePath)
    {
        try
        {
            var file = new FileInfo(filePath);
            using var stream = file.Open(FileMode.Open, FileAccess.Read, FileShare.Read);
            stream.Close();
            return true;
        }
        catch (IOException)
        {
            return false;
        }
    }

    /// <summary>
    /// wait for file unlocked from other process with default limitRetry of 5 times
    /// </summary>
    /// <param name="filePath"></param>
    /// <param name="__limit"></param>
    /// <returns></returns>
    /// <exception cref="Exception">Reaches limit retry times</exception>
    public static async Task WaitUntilFileUnlocked(string filePath, int limit = 5)
    {
        var retry = 0;
        var waiting = true;
        while (waiting)
        {
            FileStream? stream = null;
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(1));
                var file = new FileInfo(filePath);
                using (stream = file.Open(FileMode.Open, FileAccess.Read, FileShare.None))
                {
                    waiting = false;
                }
            }
            catch (IOException)
            {
                waiting = !(retry == limit);
            }
            finally
            {
                stream?.Close();
            }

            retry++;
        }
    }

    /// <summary>
    /// Check wether file is valid
    /// </summary>
    /// <param name="filePath"></param>
    /// <returns></returns>
    public static bool IsFileValid(string filePath)
    {
        var fileInfo = new FileInfo(filePath);
        return fileInfo.Exists && fileInfo.Length > 0;
    }


    #region ZipFile validator
    /// <summary>
    /// FileZip validator
    /// </summary>
    /// <returns></returns>
    public static bool IsValidZip(string filePath, int zipLevel = 1, bool multiEntries = false)
    {
        try
        {
            using var arc = ZipFile.OpenRead(filePath);
            var entry = arc.Entries.FirstOrDefault();
            if (entry == null) return false;
            var level = ZipLevelRecurser(entry, 1, multiEntries);
            return level == zipLevel;
        }
        catch
        {
            return false;
        }
    }

    private static int ZipLevelRecurser(ZipArchiveEntry entry, int zipLevel, bool multiEntries = false)
    {
        try
        {
            zipLevel++;
            using var arc = ZipFile.OpenRead(entry.FullName);
            return ZipLevelRecurser(entry, zipLevel, multiEntries);
        }
        catch
        {
            return zipLevel;
        }
    }
    #endregion ZipFile validator

}
