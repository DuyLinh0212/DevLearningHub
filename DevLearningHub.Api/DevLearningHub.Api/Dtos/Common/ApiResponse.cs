namespace DevLearningHub.Api.Dtos.Common;

// Standard API response envelope.
public class ApiResponse<T>
{
    public bool Success { get; set; }

    public string Message { get; set; } = "Success";

    public T? Data { get; set; }

    public object? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Success")
    {
        return new ApiResponse<T>
        {
            Success = true,
            Message = message,
            Data = data
        };
    }

    public static ApiResponse<T> Fail(string message, object? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = errors
        };
    }
}
