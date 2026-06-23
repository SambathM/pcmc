///
///sambath999 05-05-22
///
using Localize.Helper.Helpers;
using Newtonsoft.Json;
using System.ComponentModel.DataAnnotations.Schema;
using JsonIgnoreAttribute = System.Text.Json.Serialization.JsonIgnoreAttribute;
using Object = Google.Apis.Storage.v1.Data.Object;

namespace Library.Helpers;

internal static class GCloudHelper
{
    public static IEnumerable<FolderTree> TreeGenerator(IEnumerable<Object>? objects, string rootDir)
    {
        if (objects == null || !objects.Any()) return [];

        var tree = new List<FolderTree> {
                new() {
                    Name = rootDir,
                    Path = rootDir,
                    Level = 0,
                    Subs = GetSubs(objects, rootDir, 0)
                }
            };

        return InitializeFiles(tree, objects);
    }


    private static List<FolderTree> GetSubs(IEnumerable<Object> childList, string parantDir, int level)
    {
        level++;//level increament
        var tree = new List<FolderTree>();
        //prevent data changes in children, so we store them to json string
        var json = JsonConvert.SerializeObject(childList);
        var newList = JsonConvert.DeserializeObject<List<Object>>(json) ?? [];

        var tmpStore = new List<TmpStore>();
        newList.ForEach(itx =>
        {
            var name = (itx.Name ?? string.Empty).Replace($"{parantDir}/", "");
            name = name.Split('/').FirstOrDefault() ?? string.Empty;
            tmpStore.AddWhen(!IsFile(name), new()
            {
                Name = name,
                Item = childList.FirstOrDefault(fx => fx.Generation == itx.Generation)
            });
        });

        var grouped = tmpStore.GroupBy(x => x.Name);
        foreach (var gpx in grouped)
        {
            var item = gpx.FirstOrDefault();
            var currentPath = $"{parantDir}/{gpx.Key}";

            //find children
            var children = childList.Where(cx => cx.Name?.Contains($"{currentPath}/") == true).ToList();
            var fChildren = new List<Object>();
            children?.ForEach(cx =>
            {
                var arrCx = (cx.Name ?? string.Empty).Split('/');
                var arrCp = currentPath.Split('/');
                var conds = arrCx.Length - arrCp.Length > 1;
                fChildren.AddWhen(conds, cx);
            });

            tree.Add(new()
            {
                Name = item?.Name ?? gpx.Key,
                Path = currentPath,
                Level = level,
                Subs = fChildren.Count == 0 ? [] : GetSubs(fChildren, currentPath, level),
            });
        }

        return tree;
    }

    private static List<FolderTree> InitializeFiles(this List<FolderTree> dirs, IEnumerable<Object> items)
    {
        foreach (var dir in dirs)
        {
            var getFiles = items.Where(x => x.Name?.Contains(dir.Path) == true);
            foreach (var f in getFiles)
            {
                var parts = (f.Name ?? string.Empty).Split(dir.Path + "/");
                var fpart = parts.LastOrDefault()?.Split('/').FirstOrDefault();

                dir.Files.AddWhen(IsFile(fpart) && fpart?.Contains(".path", StringComparison.OrdinalIgnoreCase) == false, new()
                {
                    Name = fpart ?? string.Empty,
                    Link = f.MediaLink,
                    SelfLink = f.SelfLink,
                    Size = f.Size,
                    Type = f.ContentType,
                    Path = $"{dir.Path}/{fpart}",
                    Created = f.TimeCreatedDateTimeOffset?.DateTime,
                    Modified = f.UpdatedDateTimeOffset?.DateTime,
                    Generation = f.Generation,
                    Id = f.Id,
                });
            }

            if (dir.Subs.Count != 0)
            {
                dir.Subs.InitializeFiles(items);//recurse
            }
        }

        return dirs.SizeSetter();
    }

    private static List<FolderTree> SizeSetter(this List<FolderTree> tree)
    {
        tree.ForEach(item =>
        {
            var __size = item.Files.Sum(f => (decimal)(f.Size ?? 0));
            if (item.Subs.Count != 0)
            {
                //recurse
                item.Subs.SizeSetter();
            }
            item.Size = (ulong)(__size + item.Subs.Sum(sx => (decimal)sx.Size));
        });

        return tree;
    }

    private static bool IsFile(string? part)
        => part?.Split('.').Length > 1;

}//class

internal class TmpStore
{
    public string Name { get; set; } = string.Empty;
    public Object? Item { get; set; }
}

public class FolderTree
{
    public string Name { get; set; } = string.Empty;
    public int Level { get; set; }
    public string Path { get; set; } = string.Empty;
    public ulong Size { get; set; }
    public List<FolderTree> Subs { get; set; } = [];
    public List<FileProp> Files { get; set; } = [];
}

public class FileProp
{
    public string Name { get; set; } = string.Empty;
    public string? Link { get; set; }
    public ulong? Size { get; set; }
    public string? Type { get; set; }
    public string Path { get; set; } = string.Empty;
    [JsonIgnore, NotMapped]
    public string? SelfLink { get; set; }
    [JsonIgnore, NotMapped]
    public string? Id { get; set; }
    [JsonIgnore, NotMapped]
    public long? Generation { get; set; }
    public DateTime? Created { get; set; }
    public DateTime? Modified { get; set; }
    public EFileStatus Status { get; set; } = EFileStatus.COMPLETED;
    public EFileOperationType Operation { get; set; } = EFileOperationType.NO_OPERATION;
}

public class ContentTypePair(EContentType contentType, string name)
{
    public EContentType ContentType { get; set; } = contentType;
    public string Name { get; set; } = name;

    public static string? Get(EContentType contentType) => List.FirstOrDefault(x => x.ContentType == contentType)?.Name;
    public static EContentType Get(string? contentType) => List.FirstOrDefault(x => x.Name == contentType)?.ContentType ?? EContentType.Json;
    private static List<ContentTypePair> List { get; } = [
        new(EContentType.ImageJpeg, StorageContent.image ),
            new(EContentType.TextHtml, StorageContent.textHtml ),
            new(EContentType.Pdf, StorageContent.pdf ),
            new(EContentType.Json, StorageContent.json ),
            new(EContentType.MsWord, StorageContent.word ),
            new(EContentType.MsExcel, StorageContent.excel ),
            new(EContentType.Zip, StorageContent.zip ),
        ];
}

public class StorageContent
{
    public const string image = "image/jpeg";
    public const string textHtml = "text/html";
    public const string pdf = "application/pdf";
    public const string json = "application/json";
    public const string word = "application/msword";
    public const string excel = "application/vnd.ms-excel";
    public const string zip = "application/zip";
    public const string dat = "text/dat";
    public const string yaml = "application/yaml";

    private static List<Tuple<string, string>> Pair =>
    [
        new("jpg,jpeg,png", image),
            new("html", textHtml),
            new("pdf", pdf),
            new("json", json),
            new("docx", word),
            new("xls,xxls,cvc", excel),
            new("zip", zip),
        ];

    public static string? Get(string fileName)
        => Pair.FirstOrDefault(x => x.Item1.Contains(fileName.GetFileExtension(), StringComparison.OrdinalIgnoreCase))?.Item2;
}

public enum EContentType { ImageJpeg, TextHtml, Pdf, Json, MsWord, MsExcel, Zip, Yaml, }

public enum EFileStatus
{
    RUNNING,
    COMPLETED,
    FAILED
}

public enum EFileOperationType
{
    UPLOAD,
    DELETE,
    RENAME,
    NO_OPERATION
}


public enum EBackupType
{
    BUSINESS_DB_BACKUP,
    SYSTEM_DB_BACKUP
}


