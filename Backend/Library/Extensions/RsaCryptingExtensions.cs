using Library.Services;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Cryptography;
using System.Text;

namespace Library.Extensions;

public static class RsaCryptingExtensions
{
    public static string Encrypt(this string? data)
    {
        if (string.IsNullOrWhiteSpace(data))
            return string.Empty;

        var (_, publicKeyPem) = ResolveRsaKeyPair();

        using var rsa = RSA.Create();
        rsa.ImportFromPem(publicKeyPem);

        var inputBytes = Encoding.UTF8.GetBytes(data);

        var keySizeBytes = rsa.KeySize / 8;

        // OAEP SHA256 overhead
        var maxBlockSize = keySizeBytes - (2 * 32) - 2;

        using var output = new MemoryStream();

        for (var offset = 0; offset < inputBytes.Length; offset += maxBlockSize)
        {
            var chunkSize = Math.Min(maxBlockSize, inputBytes.Length - offset);

            var encrypted = rsa.Encrypt(
                inputBytes.AsSpan(offset, chunkSize).ToArray(),
                RSAEncryptionPadding.OaepSHA256);

            output.Write(encrypted);
        }

        return Convert.ToBase64String(output.ToArray());
    }

    public static string Decrypt(this string? encryptedData)
    {
        if (string.IsNullOrWhiteSpace(encryptedData))
            return string.Empty;

        var (privateKeyPem, _) = ResolveRsaKeyPair();

        var data = Convert.FromBase64String(encryptedData);

        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);

        var keySizeBytes = rsa.KeySize / 8;

        if (data.Length % keySizeBytes != 0)
        {
            throw new CryptographicException(
                $"Invalid ciphertext length ({data.Length}).");
        }

        using var output = new MemoryStream();

        for (var offset = 0; offset < data.Length; offset += keySizeBytes)
        {
            var decrypted = rsa.Decrypt(
                data.AsSpan(offset, keySizeBytes).ToArray(),
                RSAEncryptionPadding.OaepSHA256);

            output.Write(decrypted);
        }

        return Encoding.UTF8.GetString(output.ToArray());
    }

    private static (string privateKey, string publicKey) ResolveRsaKeyPair()
    {
        if (AppSettings.ServiceProvider == null)
        {
            throw new InvalidOperationException(
                "AppSettings.ServiceProvider is not initialized.");
        }

        return AppSettings.ServiceProvider
            .GetRequiredService<RsaCryptoResolver>()
            .Keys;
    }
}
