namespace Evalyn.API.Infrastructure;

public sealed class ApiException : Exception
{
    public int StatusCode { get; }
    public string? Detail { get; }

    public ApiException(int statusCode, string title, string? detail = null) : base(title)
    {
        StatusCode = statusCode;
        Detail = detail;
    }
}
