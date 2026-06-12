using System.Text;
using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.Common;
using DevLearningHub.Api.Dtos.Community;
using DevLearningHub.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevLearningHub.Api.Controllers.Community;

[ApiController]
[Route("api/tags")]
// Manage forum tags. Reads are public, writes require Moderator or Admin.
public class TagsController : ControllerBase
{
    private readonly DevLearningHubContext _db;

    public TagsController(DevLearningHubContext db)
    {
        _db = db;
    }

    [HttpGet]
    [AllowAnonymous]
    // List all tags ordered by name.
    public async Task<ActionResult<ApiResponse<List<TagResponse>>>> GetTags()
    {
        var tags = await _db.Tags
            .AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new TagResponse
            {
                Id = t.Id,
                Name = t.Name,
                Slug = t.Slug,
                ColorHex = t.ColorHex.Trim()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<TagResponse>>.Ok(tags));
    }

    [HttpPost]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Create a new tag.
    public async Task<ActionResult<ApiResponse<TagResponse>>> CreateTag(CreateTagRequest request)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<TagResponse>.Fail("Tag name is required."));
        }

        var slug = Slugify(name);

        var clash = await _db.Tags.AnyAsync(t => t.Name == name || t.Slug == slug);
        if (clash)
        {
            return Conflict(ApiResponse<TagResponse>.Fail("A tag with the same name or slug already exists."));
        }

        var tag = new Tag
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = slug,
            ColorHex = NormalizeColor(request.ColorHex)
        };

        _db.Tags.Add(tag);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<TagResponse>.Ok(MapTag(tag)));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Update a tag's name and color.
    public async Task<ActionResult<ApiResponse<TagResponse>>> UpdateTag(Guid id, UpdateTagRequest request)
    {
        var tag = await _db.Tags.FirstOrDefaultAsync(t => t.Id == id);
        if (tag == null)
        {
            return NotFound(ApiResponse<TagResponse>.Fail("Tag not found."));
        }

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(ApiResponse<TagResponse>.Fail("Tag name is required."));
        }

        var slug = Slugify(name);

        var clash = await _db.Tags.AnyAsync(t => t.Id != id && (t.Name == name || t.Slug == slug));
        if (clash)
        {
            return Conflict(ApiResponse<TagResponse>.Fail("A tag with the same name or slug already exists."));
        }

        tag.Name = name;
        tag.Slug = slug;
        tag.ColorHex = NormalizeColor(request.ColorHex);

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<TagResponse>.Ok(MapTag(tag)));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = AppPolicies.ModeratorOrAdmin)]
    // Delete a tag and detach it from every post.
    public async Task<ActionResult<ApiResponse<object>>> DeleteTag(Guid id)
    {
        var tag = await _db.Tags
            .Include(t => t.Posts)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (tag == null)
        {
            return NotFound(ApiResponse<object>.Fail("Tag not found."));
        }

        // Clear the post_tags links before removing the tag.
        tag.Posts.Clear();
        _db.Tags.Remove(tag);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { deleted = true }));
    }

    private static TagResponse MapTag(Tag tag)
    {
        return new TagResponse
        {
            Id = tag.Id,
            Name = tag.Name,
            Slug = tag.Slug,
            ColorHex = tag.ColorHex.Trim()
        };
    }

    private static string NormalizeColor(string? colorHex)
    {
        var value = colorHex?.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            return "#6366f1";
        }

        if (!value.StartsWith('#'))
        {
            value = "#" + value;
        }

        return value.Length == 7 ? value : "#6366f1";
    }

    // Build a url-friendly slug from a tag name.
    private static string Slugify(string name)
    {
        var builder = new StringBuilder(name.Length);
        var lastWasDash = false;

        foreach (var ch in name.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(ch);
                lastWasDash = false;
            }
            else if (!lastWasDash)
            {
                builder.Append('-');
                lastWasDash = true;
            }
        }

        var slug = builder.ToString().Trim('-');
        if (slug.Length > 50)
        {
            slug = slug[..50].Trim('-');
        }

        return string.IsNullOrEmpty(slug) ? $"tag-{Guid.NewGuid():N}"[..12] : slug;
    }
}
