using Xunit;

// Các integration test dùng chung WebApplicationFactory/InMemory DB, chạy tuần tự để tránh xóa/seed chồng chéo.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
