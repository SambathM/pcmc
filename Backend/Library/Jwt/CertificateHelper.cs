using Localize.Helper.Extensions.Helpers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Library.Jwt;

public static class CertificateHelper
{
    private static readonly Lazy<X509Certificate2> _certificate = new(CreateCertificate);
    private static readonly Lazy<SecurityKey> _issuerSigningKey = new(() => new X509SecurityKey(Certificate));
    private static readonly Lazy<SigningCredentials> _signingCredentials = new(() => new X509SigningCredentials(Certificate));
    //private static readonly Lazy<X509Certificate2> _defaultCert = new(GetLocalizeCert);

    public static X509Certificate2 Certificate => _certificate.Value;
    public static SecurityKey GetIssuerSigningKey => _issuerSigningKey.Value;
    public static SigningCredentials GetSigningCredentials => _signingCredentials.Value;
    //public static X509Certificate2 DefaultCertificate => _defaultCert.Value;

    private static X509Certificate2 CreateCertificate()
    {
        using var scope = AppSettings.ServiceProvider.CreateScope();
        var b64PrivateKey = scope.ServiceProvider
            .GetRequiredService<AppSettings>()
            .Configs
            .Secrets
            .RsaPrivateKeyBase64;

        var rsaPrivateKey = b64PrivateKey.FromBase64String().StringFromBytes();
        return LoadCertificate(rsaPrivateKey);
    }

    public static X509Certificate2 LoadCertificate(string privateKey)
    {
        using var rsa = RSA.Create();
        if (privateKey.StartsWith("<RSAKeyValue>"))
        {
            rsa.FromXmlString(privateKey);
        }
        else
        {
            rsa.ImportFromPem(privateKey);
        }
        var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        return request.CreateSelfSigned(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddYears(1));
    }


    // Get cert from pfx file
    public static X509Certificate2 GetCertFromPfx(string pfxFilePath, string password)
    {
        if (string.IsNullOrEmpty(pfxFilePath) || string.IsNullOrEmpty(password))
            throw new ArgumentException("PFX file path and password cannot be null or empty.");

        return new X509Certificate2(pfxFilePath, password, X509KeyStorageFlags.MachineKeySet | X509KeyStorageFlags.PersistKeySet);
    }

}

