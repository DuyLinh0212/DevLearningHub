using DevLearningHub.Api.Authorization;
using DevLearningHub.Api.Dtos.CodePlayground;
using DevLearningHub.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevLearningHub.Api.Controllers.CodePlayground;

[ApiController]
[Route("api/admin/judge")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Moderator}")] // Cho phép cả Admin và Moderator
public class AdminJudgeController : ControllerBase
{
    private readonly Judge0UrlHolder _urlHolder;

    public AdminJudgeController(Judge0UrlHolder urlHolder)
    {
        _urlHolder = urlHolder;
    }

    [HttpGet("url")]
    public ActionResult<JudgeUrlResponse> GetUrl()
    {
        return Ok(new JudgeUrlResponse { Url = _urlHolder.Url });
    }

    [HttpPut("url")]
    public IActionResult UpdateUrl([FromBody] UpdateJudgeUrlRequest request)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        
        _urlHolder.SetUrl(request.Url);
        return Ok(new JudgeUrlResponse { Url = _urlHolder.Url });
    }
}