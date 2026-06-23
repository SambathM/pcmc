using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;
using Library.Helpers;
using Localize.Logger;
using Microsoft.AspNetCore.Http;
using System.Web;
using static Google.Apis.Storage.v1.ObjectsResource.ListRequest;
using Object = Google.Apis.Storage.v1.Data.Object;

namespace Library.Services
{
    public interface IGoogleCloudStorage
    {
        Task DeleteFileAsync(string fileNameForStorage);
        Task<string?> UploadFormFileAsync(IFormFile formFile, string fileNameForStorage, string? contentType = null, bool isPublic = false);
        Task<string?> UploadFileAsync(string _srcFile, string dstFile, string? contentType = null, bool isPublic = false);
        Task<IEnumerable<FolderTree>> GetDirectoryTree(string dirName);
        Task BulkDeleteObject(string[] filePaths);
        Task CreateDirectory(string dirPath);
        Task<string?> UploadFileAsync(string srcFilePath, string dstFile, EContentType contentType);
        Task<string?> UploadFormFileAsync(IFormFile _file, string fileNameForStorage, EContentType contentType = EContentType.ImageJpeg);
        Task<bool> DeleteFolderAsync(string folderPath);
        void SetBucketName(string bucketName);
        Task<Stream> DownloadFileAsync(string filePathAfterBucket);
        Task<string?> DownloadFileAsTextAsync(string filePathAfterBucket);

        Task<string?> UploadTextAsync(string textContent, string fileNameForStorage, EContentType contentType = EContentType.Json);
        Task<string?> UploadTextAsync(string textContent, string fileNameForStorage);
        Task<object?> GetFileObjectAsync(string fileNameForStorage);
        Task<string> UploadFileAsync(byte[] bytes, string dstFile, string? contentType = null, bool isPublic = false);
        Task<StorageClient> GetClientAsync();
    }

    public class GoogleCloudStorage : IGoogleCloudStorage
    {
        private const string CloudPublicUrl = "https://storage.googleapis.com";
        private GoogleCredential? _cachedCredential;
        private static StorageClient? _cachedClient;


        private string BucketName;
        public string BucketUrl;
        private readonly AppSettings _appSettings;

        private static readonly SemaphoreSlim _clientLock = new(1, 1);
        private static readonly LocalizeLogger<GoogleCloudStorage> logger = new();

        public GoogleCloudStorage(AppSettings appSettings)
        {
            BucketName = appSettings.GoogleConfig.GcloudStorageBucket;
            BucketUrl = $"{CloudPublicUrl}/{BucketName}";
            _appSettings = appSettings;
        }

        public GoogleCloudStorage(AppSettings appSettings, string bucketName)
        {
            BucketName = bucketName;
            BucketUrl = $"{CloudPublicUrl}/{BucketName}";
            _appSettings = appSettings;
        }

        private async Task<GoogleCredential> GetCredentialAsync()
        {
            if (_cachedCredential != null)
                return _cachedCredential;

            var accountJson = _appSettings.GoogleConfig.GcloudStorageCredentialsJson;

            _cachedCredential = CredentialFactory
                .FromJson<ServiceAccountCredential>(accountJson)
                .ToGoogleCredential();

            return await Task.FromResult(_cachedCredential);
        }


        public async Task<StorageClient> GetClientAsync()
        {
            if (_cachedClient != null)
                return _cachedClient;

            await _clientLock.WaitAsync();
            try
            {
                if (_cachedClient == null) // Double-check locking
                {
                    var cred = await GetCredentialAsync();
                    _cachedClient = await StorageClient.CreateAsync(cred);
                }
            }
            catch (Exception ex)
            {
                logger.Error("Error initializing StorageClient: {0}, trace: {1}", ex.Message, ex.StackTrace);
                throw;
            }
            finally
            {
                _clientLock.Release();
            }

            return _cachedClient ?? throw new InvalidOperationException("Storage client initialization failed.");
        }


        public async Task<Stream> DownloadFileAsync(string filePathAfterBucket)
        {
            var stream = new MemoryStream();
            var client = await GetClientAsync();
            await client.DownloadObjectAsync(BucketName, filePathAfterBucket, stream);
            return stream;
        }

        public async Task<string?> DownloadFileAsTextAsync(string filePathAfterBucket)
        {
            try
            {
                var stream = await DownloadFileAsync(filePathAfterBucket);
                stream.Seek(0, SeekOrigin.Begin);
                using var reader = new StreamReader(stream);
                return reader.ReadToEnd();
            }
            catch { }
            return null;
        }

        public void SetBucketName(string bucketName)
        {
            BucketName = bucketName;
            BucketUrl = $"{CloudPublicUrl}/{BucketName}";
        }

        public async Task CreateDirectory(string dirPath)
        {
            try
            {
                var tmpFilePath = Path.Combine(Path.GetTempPath(), Path.GetTempFileName());
                using (var file = File.Create(tmpFilePath))
                {
                    var dstPath = $"{dirPath.TrimStart('/').TrimEnd('/')}/_.path";
                    dstPath = HttpUtility.UrlDecode(dstPath);

                    using var stream = new MemoryStream();
                    await file.CopyToAsync(stream);
                    var client = await GetClientAsync();
                    await client.UploadObjectAsync(BucketName, dstPath, StorageContent.textHtml, stream);

                }

                await FileHelper.TryRemoveFile(tmpFilePath);
            }
            catch (Exception ex)
            {
                logger.Error("Error: {0}, trace: {1}", ex.Message, ex.StackTrace);
            }
        }

        public async Task<string?> UploadFormFileAsync(IFormFile file, string fileNameForStorage, EContentType contentType = EContentType.ImageJpeg)
            => await UploadFormFileAsync(file, fileNameForStorage, ContentTypePair.Get(contentType));

        public async Task<string?> UploadTextAsync(string textContent, string fileNameForStorage)
        {
            var contentType = ContentTypePair.Get(StorageContent.Get(fileNameForStorage));
            return await UploadTextAsync(textContent, fileNameForStorage, contentType);
        }

        public async Task<string?> UploadTextAsync(string textContent, string fileNameForStorage, EContentType contentType = EContentType.Json)
        {
            var tmpFile = Path.GetTempFileName();
            File.WriteAllText(tmpFile, textContent);
            var result = await UploadFileAsync(tmpFile, fileNameForStorage, contentType);
            await FileHelper.TryRemoveFile(tmpFile);
            return result;
        }

        public async Task<string?> UploadFormFileAsync(IFormFile file, string fileNameForStorage, string? contentType = null, bool isPublic = false)
        {
            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                var client = await GetClientAsync();
                var dataObject = await client.UploadObjectAsync(BucketName, fileNameForStorage, contentType, stream);
                return isPublic ? $"{BucketUrl}/{fileNameForStorage}" : dataObject.MediaLink;
            }
            catch (Exception e)
            {
                Console.WriteLine(e.ToString());
                return null;
            }
        }

        public async Task<string?> UploadFileAsync(string srcFilePath, string dstFile, EContentType contentType)
            => await UploadFileAsync(srcFilePath, dstFile, ContentTypePair.Get(contentType));

        public async Task<string> UploadFileAsync(byte[] bytes, string dstFile, string? contentType = null, bool isPublic = false)
        {
            using var fStream = new MemoryStream(bytes);
            contentType ??= StorageContent.Get(dstFile);
            var client = await GetClientAsync();
            var dataObject = await client.UploadObjectAsync(BucketName, dstFile, contentType, fStream);
            return isPublic ? $"{BucketUrl}/{dstFile}" : dataObject.MediaLink;
        }

        public async Task<string?> UploadFileAsync(string srcFilePath, string dstFile, string? contentType = null, bool isPublic = false)
        {
            if (!File.Exists(srcFilePath)) return null;
            try
            {
                using var fStream = File.Open(srcFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                contentType ??= StorageContent.Get(dstFile);
                var client = await GetClientAsync();
                var dataObject = await client.UploadObjectAsync(BucketName, dstFile, contentType, fStream);
                return isPublic ? $"{BucketUrl}/{dstFile}" : dataObject.MediaLink;
            }
            catch (Exception)
            {
                return null;
            }
        }

        public async Task BulkDeleteObject(string[] filePaths)
        {
            foreach (var filePath in filePaths)
                await DeleteFileAsync(filePath);
        }

        public async Task DeleteFileAsync(string fileNameForStorage)
        {
            try
            {
                var client = await GetClientAsync();
                await client.DeleteObjectAsync(BucketName, fileNameForStorage, new() { });
            }
            catch (Exception) { }
        }

        public async Task<IEnumerable<FolderTree>> GetDirectoryTree(string dirName)
        {
            try
            {
                var client = await GetClientAsync();
                var request = client.Service.Objects.List(BucketName);
                request.Prefix = dirName;
                request.Projection = ProjectionEnum.Full;
                var response = await request.ExecuteAsync();
                return GCloudHelper.TreeGenerator(response?.Items, dirName);
            }
            catch
            {
                return [];
            }
        }

        public async Task<bool> DeleteFolderAsync(string folderPath)
        {
            try
            {
                var directoryTree = await GetDirectoryTree(folderPath);
                await RecurseDeleteFilesAsync(directoryTree);
                return true;
            }
            catch { }
            return false;
        }


        private async Task RecurseDeleteFilesAsync(IEnumerable<FolderTree> folderTrees)
        {
            if (folderTrees == null || !folderTrees.Any()) return;

            var client = await GetClientAsync();
            foreach (var tr in folderTrees)
            {
                foreach (var f in tr.Files)
                {
                    try
                    {
                        await client.DeleteObjectAsync(new Object
                        {
                            Bucket = BucketName,
                            MediaLink = f.Link,
                            SelfLink = f.SelfLink,
                            ContentType = f.Type,
                            Generation = f.Generation,
                            Id = f.Id,
                            Name = $"{tr.Path}/{f.Name}",
                        });
                    }
                    catch { }
                }
                //if contains sub folders
                await RecurseDeleteFilesAsync(tr.Subs);
            }
        }

        public async Task<object?> GetFileObjectAsync(string fileNameForStorage)
        {
            try
            {
                var client = await GetClientAsync();
                var request = client.Service.Objects.Get(BucketName, fileNameForStorage);
                return await request.ExecuteAsync();
            }
            catch (Exception)
            {
                return null;
            }
        }

    }

}
