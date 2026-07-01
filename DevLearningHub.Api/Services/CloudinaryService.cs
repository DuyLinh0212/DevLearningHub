using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.Extensions.Options;

namespace DevLearningHub.Api.Services;

public class CloudinaryService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryService(IOptions<CloudinarySettings> options)
    {
        var settings = options.Value;

        var account = new Account(
            settings.CloudName,
            settings.ApiKey,
            settings.ApiSecret
        );

        _cloudinary = new Cloudinary(account);
    }

    #region Avatar

    public async Task<(string Url, string PublicId)> UploadAvatarAsync(
        Guid userId,
        IFormFile file)
    {
        ValidateImage(file);

        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),

            Folder = "devlearninghub/avatars",

            PublicId = $"avatar_{userId}",

            Overwrite = true
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            throw new Exception(result.Error.Message);

        return (
            result.SecureUrl.ToString(),
            result.PublicId
        );
    }

    #endregion

    #region Banner

    public async Task<(string Url, string PublicId)> UploadBannerAsync(
        Guid userId,
        IFormFile file)
    {
        ValidateImage(file);

        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),

            Folder = "devlearninghub/banners",

            PublicId = $"banner_{userId}",

            Overwrite = true
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            throw new Exception(result.Error.Message);

        return (
            result.SecureUrl.ToString(),
            result.PublicId
        );
    }

    #endregion

    #region Post

    public async Task<(string Url, string PublicId)> UploadPostImageAsync(
        Guid postId,
        IFormFile file)
    {
        return await UploadImageAsync(
            file,
            $"devlearninghub/posts/{postId}"
        );
    }

    #endregion

    #region Topic

    public async Task<(string Url, string PublicId)> UploadTopicImageAsync(
        Guid topicId,
        IFormFile file)
    {
        return await UploadImageAsync(
            file,
            $"devlearninghub/topics/{topicId}"
        );
    }

    #endregion

    #region Roadmap

    public async Task<(string Url, string PublicId)> UploadRoadmapImageAsync(
        Guid roadmapId,
        IFormFile file)
    {
        return await UploadImageAsync(
            file,
            $"devlearninghub/roadmaps/{roadmapId}"
        );
    }

    #endregion

    #region Quiz

    public async Task<(string Url, string PublicId)> UploadQuizImageAsync(
        Guid questionId,
        IFormFile file)
    {
        return await UploadImageAsync(
            file,
            $"devlearninghub/quiz-images/{questionId}"
        );
    }

    #endregion

    #region Delete

    public async Task DeleteImageAsync(string publicId)
    {
        if (string.IsNullOrWhiteSpace(publicId))
            return;

        await _cloudinary.DestroyAsync(
            new DeletionParams(publicId)
        );
    }

    #endregion

    #region Private

    private async Task<(string Url, string PublicId)> UploadImageAsync(
        IFormFile file,
        string folder)
    {
        ValidateImage(file);

        await using var stream = file.OpenReadStream();

        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),

            Folder = folder,

            UseFilename = false,

            UniqueFilename = true,

            Overwrite = false
        };

        var result = await _cloudinary.UploadAsync(uploadParams);

        if (result.Error != null)
            throw new Exception(result.Error.Message);

        return (
            result.SecureUrl.ToString(),
            result.PublicId
        );
    }

    private static void ValidateImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("File không hợp lệ.");

        var allowedExtensions = new[]
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".gif"
        };

        var extension = Path.GetExtension(file.FileName)
            .ToLowerInvariant();

        if (!allowedExtensions.Contains(extension))
            throw new ArgumentException(
                "Chỉ cho phép upload jpg, jpeg, png, webp, gif."
            );

        if (file.Length > 5 * 1024 * 1024)
            throw new ArgumentException(
                "Ảnh không được vượt quá 5MB."
            );
    }

    #endregion
}
