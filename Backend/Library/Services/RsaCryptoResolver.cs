using System.Security.Cryptography;
using System.Text;

namespace Library.Services;

public sealed class RsaCryptoResolver(AppSettings appSettings)
{
    private readonly Lazy<(string privateKey, string publicKey)> _keys = new(
            () => Initialize(appSettings),
            LazyThreadSafetyMode.ExecutionAndPublication);

    public (string privateKey, string publicKey) Keys => _keys.Value;

    private static (string privateKey, string publicKey) Initialize(
        AppSettings appSettings)
    {
        var privateKeyValue =
            appSettings.Configs.Secrets.RsaPrivateKeyBase64;

        if (string.IsNullOrWhiteSpace(privateKeyValue))
        {
            throw new InvalidOperationException(
                "RSA private key is not configured.");
        }

        var privatePem = DecodePrivateKey(privateKeyValue);

        using var rsa = RSA.Create();

        rsa.ImportFromPem(privatePem);

        if (rsa.KeySize < 2048)
        {
            throw new CryptographicException(
                $"RSA key size {rsa.KeySize} is not supported.");
        }

        var publicPem = rsa.ExportRSAPublicKeyPem();

        return (privatePem, publicPem);
    }

    private static string DecodePrivateKey(string value)
    {
        try
        {
            var decoded = Encoding.UTF8.GetString(
                Convert.FromBase64String(value));

            if (decoded.Contains("BEGIN"))
                return decoded;
        }
        catch
        {
            // Not Base64
        }

        if (value.Contains("BEGIN"))
            return value;

        throw new CryptographicException(
            "Private key must be PEM or Base64-encoded PEM.");
    }
}
