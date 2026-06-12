# DevLearningHub API

DevLearningHub API là backend ASP.NET Core 8 cho hệ thống học lập trình, luyện quiz và theo dõi tiến độ học tập. Dự án hiện tập trung vào các nhóm chức năng chính: xác thực người dùng, quản lý tài khoản, ngân hàng câu hỏi, bộ đề quiz, phiên làm bài, tiến độ học tập và roadmap.

## Công Nghệ Sử Dụng

- ASP.NET Core 8 Web API
- Entity Framework Core 8
- SQL Server
- JWT Bearer Authentication
- Refresh Token
- Swagger/OpenAPI trong môi trường Development

## Cấu Trúc Thư Mục

```text
Controllers/
  Auth/        API đăng ký, đăng nhập, refresh token, logout
  User/        API người dùng hiện tại và quản trị người dùng
  Quiz/        API topic, câu hỏi, bộ đề, phiên quiz, tiến độ, roadmap

Dtos/
  Auth/        DTO request/response cho xác thực
  Common/      Response wrapper dùng chung
  Quiz/        DTO cho topic, question, quiz set, quiz session, progress, roadmap

Entities/      Entity Framework Core entity và mapping database
Extensions/    Helper đọc claim từ JWT
Services/      JWT option và token service
```

## Cấu Hình

File cấu hình chính: `appsettings.json`.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=...;Initial Catalog=DevLearningHub;..."
  },
  "Jwt": {
    "Issuer": "DevLearningHub",
    "Audience": "DevLearningHub",
    "Key": "dev-secret-change-me-please-32-bytes",
    "AccessTokenMinutes": 30,
    "RefreshTokenDays": 14
  }
}
```

Lưu ý:

- `DefaultConnection` trỏ đến database SQL Server.
- `Jwt:Key` phải dài tối thiểu 32 bytes vì hệ thống ký access token bằng `HmacSha256`.
- Không nên để connection string thật trong source code khi deploy production.

## Chạy Dự Án

Restore và build:

```powershell
dotnet restore
dotnet build
```

Chạy API:

```powershell
dotnet run
```

Khi chạy ở môi trường Development, Swagger UI được bật tự động. Có thể dùng Swagger để test API sau khi ứng dụng chạy.

## Chuẩn Response Chung

Hầu hết API trả về wrapper chung `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "errors": null
}
```

Ý nghĩa:

- `success`: trạng thái thành công hoặc thất bại.
- `message`: thông báo ngắn cho client.
- `data`: dữ liệu trả về.
- `errors`: chi tiết lỗi nếu có.

## Xác Thực Và Phân Quyền

Hệ thống dùng JWT Bearer Authentication.

Luồng cơ bản:

1. Client gọi `POST /api/auth/login` hoặc `POST /api/auth/register`.
2. API trả về `accessToken` và `refreshToken`.
3. Client gửi access token trong header:

```http
Authorization: Bearer <access-token>
```

4. Khi access token hết hạn, client gọi `POST /api/auth/refresh` bằng refresh token.
5. Khi logout, client gọi `POST /api/auth/logout` để revoke refresh token.

Role được đưa vào JWT bằng claim `ClaimTypes.Role`. Các API admin yêu cầu role `Admin`.

## Nhóm API Auth

Base route: `api/auth`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Không | Tạo tài khoản mới, hash password, tạo access token và refresh token |
| `POST` | `/login` | Không | Đăng nhập bằng username hoặc email |
| `POST` | `/refresh` | Không | Xoay vòng refresh token và cấp access token mới |
| `POST` | `/logout` | Không | Thu hồi refresh token |

Các bảng liên quan:

- `users`
- `refresh_tokens`
- `user_roles`
- `roles`
- `audit_logs`

Ghi chú:

- Google OAuth trong file plan chưa được implement.
- User mới đăng ký hiện chưa tự động được gán role mặc định.

## Nhóm API Users

Base route: `api/users`

Các endpoint yêu cầu JWT hợp lệ.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/me` | Lấy profile của user đang đăng nhập |
| `PUT` | `/me` | Cập nhật `fullName` và `avatarUrl` |
| `GET` | `/{id}/stats` | Lấy thống kê học tập và XP của một user |
| `GET` | `/leaderboard` | Lấy bảng xếp hạng XP |

### `GET /api/users/me`

Trả về thông tin cơ bản:

- `id`
- `username`
- `email`
- `fullName`
- `avatarUrl`
- `xpPoints`

### `PUT /api/users/me`

Body ví dụ:

```json
{
  "fullName": "Nguyen Van A",
  "avatarUrl": "https://example.com/avatar.png"
}
```

API cập nhật:

- `users.full_name`
- `users.avatar_url`
- `users.updated_at`

### `GET /api/users/{id}/stats`

Thống kê dựa trên:

- `users.xp_points`
- số lượng quiz session có `status = "completed"`
- điểm trung bình từ `quiz_sessions.score / quiz_sessions.total_questions`
- rank theo XP hiện tại

### `GET /api/users/leaderboard`

Query:

- `top`: số lượng user muốn lấy, mặc định `20`, tối đa `100`.

API chỉ lấy user đang active, sắp xếp theo:

1. `xp_points` giảm dần
2. `username` tăng dần

## Nhóm API Admin Users

Base route: `api/admin/users`

Yêu cầu:

- JWT hợp lệ.
- User có role `Admin` trong bảng `user_roles`.
- Role `Admin` phải active trong bảng `roles`.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/` | Danh sách user có phân trang, tìm kiếm và role |
| `GET` | `/{id}` | Chi tiết một user |
| `PATCH` | `/{id}/lock` | Khóa tài khoản |
| `PATCH` | `/{id}/unlock` | Mở khóa tài khoản |
| `PUT` | `/{id}/role` | Thay role hiện tại bằng một role active |

### `GET /api/admin/users`

Query:

- `page`: trang hiện tại, mặc định `1`.
- `pageSize`: số bản ghi mỗi trang, mặc định `20`, tối đa `100`.
- `search`: tìm theo username, email hoặc full name.

Response data có dạng:

```json
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0
}
```

### `GET /api/admin/users/{id}`

Trả về:

- thông tin profile
- trạng thái active/locked
- lý do khóa
- thời điểm khóa
- danh sách role
- số quiz đã hoàn thành

### `PATCH /api/admin/users/{id}/lock`

Body ví dụ:

```json
{
  "reason": "Vi phạm quy định cộng đồng"
}
```

API cập nhật:

- `users.is_locked = true`
- `users.locked_at`
- `users.locked_reason`
- `users.updated_at`

Để tránh tự khóa tài khoản quản trị, API không cho admin lock chính mình.

### `PATCH /api/admin/users/{id}/unlock`

API cập nhật:

- `users.is_locked = false`
- `users.locked_at = null`
- `users.locked_reason = null`
- `users.updated_at`

### `PUT /api/admin/users/{id}/role`

Body ví dụ:

```json
{
  "role": "Student"
}
```

Cách xử lý:

- Kiểm tra user tồn tại.
- Kiểm tra role tồn tại và `is_active = true`.
- Xóa các role hiện tại của user trong `user_roles`.
- Thêm một role mới vào `user_roles`.

Ghi chú:

- API này hiện xử lý theo mô hình một user có một role chính.
- Không cho admin tự đổi role của chính mình để tránh mất quyền quản trị.

## Nhóm API Topics

Base route: `api/topics`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Lấy danh sách topic active |

Bảng liên quan:

- `topics`

## Nhóm API Questions

Base route: `api/questions`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Lấy danh sách câu hỏi, có filter |
| `POST` | `/` | Có | Tạo câu hỏi và đáp án |
| `PUT` | `/{id}` | Có | Cập nhật câu hỏi và thay toàn bộ đáp án |
| `DELETE` | `/{id}` | Có | Soft delete bằng `is_active = false` |
| `POST` | `/import` | Có | Import danh sách câu hỏi từ JSON |

Bảng liên quan:

- `questions`
- `question_options`
- `topics`
- `users`

Ghi chú:

- Endpoint import hiện nhận JSON list, chưa xử lý file Excel.
- Khi tạo hoặc cập nhật câu hỏi, cần tối thiểu 2 option và ít nhất 1 đáp án đúng.
- Người tạo câu hỏi mới có quyền sửa/xóa câu hỏi đó.

## Nhóm API Quiz Sets

Base route: `api/quiz-sets`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Lấy danh sách bộ đề public |
| `GET` | `/{id}` | Không | Lấy chi tiết bộ đề |
| `POST` | `/` | Có | Tạo bộ đề |
| `PUT` | `/{id}` | Có | Cập nhật bộ đề |
| `DELETE` | `/{id}` | Có | Xóa bộ đề nếu chưa có session |
| `POST` | `/{id}/questions` | Có | Gán câu hỏi vào bộ đề |
| `DELETE` | `/{id}/questions/{questionId}` | Có | Gỡ câu hỏi khỏi bộ đề |
| `GET` | `/{id}/questions` | Không | Lấy danh sách câu hỏi trong bộ đề |

Bảng liên quan:

- `quiz_sets`
- `quiz_set_questions`
- `questions`
- `topics`
- `quiz_sessions`

Ghi chú:

- Bộ đề private chỉ chủ sở hữu xem được.
- Chỉ chủ sở hữu bộ đề được sửa, xóa, gán hoặc gỡ câu hỏi.
- Không được xóa bộ đề đã có quiz session.

## Nhóm API Quiz Sessions

Base route: `api/quiz-sessions`

Tất cả endpoint yêu cầu JWT hợp lệ.

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/` | Bắt đầu một phiên làm quiz |
| `POST` | `/{id}/submit` | Nộp bài, chấm điểm và lưu đáp án |
| `GET` | `/{id}/result` | Lấy kết quả đã lưu |

Bảng liên quan:

- `quiz_sessions`
- `quiz_answers`
- `quiz_sets`
- `quiz_set_questions`
- `questions`
- `question_options`
- `user_topic_progress`

Luồng xử lý:

1. User bắt đầu quiz bằng `QuizSetId`.
2. API tạo record trong `quiz_sessions` với `status = "in_progress"`.
3. User nộp danh sách đáp án.
4. API đối chiếu với `question_options.is_correct`.
5. API lưu `quiz_answers`.
6. API cập nhật `quiz_sessions.score`, `status`, `ended_at`, `time_taken_seconds`.
7. API cập nhật tiến độ trong `user_topic_progress` nếu quiz set có topic.

## Nhóm API Progress

Base route: `api/users/me`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/progress` | Có | Lấy tiến độ học tập theo topic của user hiện tại |

Bảng liên quan:

- `user_topic_progress`
- `topics`

## Nhóm API Roadmaps

Base route: `api/roadmaps`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Lấy danh sách roadmap và topic theo thứ tự |

Bảng liên quan:

- `roadmaps`
- `roadmap_topics`
- `topics`

## Nhóm API Forum & Community

Module diễn đàn gồm bài viết, comment lồng nhau, vote, tag và kiểm duyệt nội dung.

### Phân quyền dùng chung

- `Public`: không cần đăng nhập.
- `User+`: cần JWT hợp lệ (mọi role).
- `Moderator+`: role `Moderator` hoặc `Admin`, qua policy `ModeratorOrAdmin`.

Quy ước sửa/xóa:

- Sửa bài viết / comment: chỉ chủ sở hữu.
- Xóa bài viết / comment: chủ sở hữu, hoặc `Moderator`/`Admin` xóa bất kỳ.
- Ẩn nội dung vi phạm: dùng endpoint `moderate` (chỉ `Moderator+`), không xóa dữ liệu.

### Posts

Base route: `api/posts`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Danh sách bài viết, có phân trang, tìm kiếm và lọc theo tag |
| `POST` | `/` | User+ | Tạo bài viết mới |
| `GET` | `/{id}` | Public | Chi tiết bài viết, tự tăng `view_count` |
| `PUT` | `/{id}` | User+ | Sửa bài viết (chủ sở hữu) |
| `DELETE` | `/{id}` | User+ | Xóa bài viết (chủ sở hữu hoặc Moderator+) |
| `POST` | `/{id}/vote` | User+ | Upvote/Downvote bài viết |
| `GET` | `/{id}/comments` | Public | Lấy comment dạng cây lồng nhau |
| `POST` | `/{id}/comments` | User+ | Thêm comment hoặc reply |
| `POST` | `/{id}/moderate` | Moderator+ | Ẩn/bỏ ẩn bài viết và ghi `moderation_logs` |

`GET /api/posts` query:

- `page`: trang hiện tại, mặc định `1`.
- `pageSize`: số bản ghi mỗi trang, mặc định `20`, tối đa `100`.
- `search`: tìm theo tiêu đề hoặc nội dung.
- `tag`: lọc theo `slug` của tag.
- `authorId`: lọc theo tác giả.

Response là `PagedResponse<T>`:

```json
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0
}
```

`POST /api/posts` body ví dụ:

```json
{
  "title": "Làm sao tối ưu EF Core?",
  "bodyMarkdown": "Mình đang gặp N+1 query...",
  "imageUrl": null,
  "tagIds": ["b0000000-0000-0000-0000-000000000002"]
}
```

`POST /api/posts/{id}/vote` body:

```json
{ "voteType": "up" }
```

- `voteType`: `"up"` hoặc `"down"`.
- Bấm lại cùng loại sẽ bỏ vote; bấm loại khác sẽ đổi chiều. Mỗi user một vote trên một đối tượng.
- Response trả về `upvotes`, `downvotes` đã đếm lại và `myVote` (`"up"`/`"down"`/`null`).

### Comments

Base route: `api/comments`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `PUT` | `/{id}` | User+ | Sửa comment (chủ sở hữu) |
| `DELETE` | `/{id}` | User+ | Xóa comment và toàn bộ reply con (chủ sở hữu hoặc Moderator+) |
| `POST` | `/{id}/vote` | User+ | Upvote/Downvote comment |
| `POST` | `/{id}/accept` | User+ | Đánh dấu Best Answer (chỉ tác giả bài viết) |
| `POST` | `/{id}/moderate` | Moderator+ | Ẩn/bỏ ẩn comment và ghi `moderation_logs` |

Ghi chú:

- `accept` chỉ tác giả bài viết được dùng; set `posts.accepted_comment_id` và `comments.is_accepted`. Gọi lại trên cùng comment sẽ bỏ đánh dấu.
- Comment bị ẩn sẽ tự mất trạng thái Best Answer và không xuất hiện trong cây comment công khai.

### Tags

Base route: `api/tags`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Public | Danh sách tất cả tag |
| `POST` | `/` | Moderator+ | Tạo tag mới |
| `PUT` | `/{id}` | Moderator+ | Sửa tag |
| `DELETE` | `/{id}` | Moderator+ | Xóa tag và gỡ khỏi mọi bài viết |

`POST /api/tags` body ví dụ:

```json
{ "name": "ASP.NET Core", "colorHex": "#5c2d91" }
```

- `slug` được sinh tự động từ `name`; `name` và `slug` phải là duy nhất.
- `colorHex` không bắt buộc, mặc định `#6366f1`.

### Moderation

Body dùng chung cho `POST /api/posts/{id}/moderate` và `POST /api/comments/{id}/moderate`:

```json
{ "reason": "Vi phạm quy định cộng đồng", "hidden": true }
```

- `hidden`: `true` để ẩn (mặc định), `false` để bỏ ẩn.
- Mỗi lần gọi tạo một bản ghi trong `moderation_logs` với `action` là `hide`/`unhide`.

Bảng liên quan tới toàn module:

- `posts`
- `comments`
- `votes`
- `tags`
- `post_tags`
- `moderation_logs`

### Seed dữ liệu test nhanh

File `Database/SeedForumTestData.sql` tạo sẵn tài khoản và tag để test:

- `admin` / `Admin@123` — role `Admin`.
- `moderator` / `Mod@12345` — role `Moderator`.
- 5 tag mẫu (C#, ASP.NET Core, JavaScript, SQL, Hỏi đáp).

Chạy script này sau khi import database chính. Đăng nhập qua `POST /api/auth/login` để lấy token test các endpoint `Moderator+`.

## Mapping Database Chính

Mapping EF Core nằm trong:

```text
Entities/DevLearningHubContext.cs
```

Các bảng chính đã có mapping:

| Nhóm | Bảng |
| :--- | :--- |
| User/Auth | `users`, `roles`, `user_roles`, `permissions`, `user_permissions`, `refresh_tokens`, `audit_logs` |
| Quiz | `topics`, `questions`, `question_options`, `quiz_sets`, `quiz_set_questions`, `quiz_sessions`, `quiz_answers` |
| Progress | `user_topic_progress`, `xp_transactions` |
| Roadmap | `roadmaps`, `roadmap_topics` |
| Community/khác | `posts`, `comments`, `votes`, `tags`, `post_tags`, `notifications`, `moderation_logs` |
| Coding problem | `problems`, `test_cases`, `submissions`, `submission_test_results`, `programming_languages` |

## Các Điểm Cần Seed Dữ Liệu

Để test đầy đủ, database cần có:

- Role `Admin` active.
- Role `Student` hoặc role mặc định khác nếu muốn gán cho user thường.
- Ít nhất một admin user có record trong `user_roles`.
- Topic active để tạo câu hỏi.
- Question và option để tạo quiz set.
- Quiz set có câu hỏi để start quiz session.

## Trạng Thái Hiện Tại So Với Plan

Đã có:

- Auth cơ bản bằng JWT và refresh token.
- User profile, update profile, stats, leaderboard.
- Admin list/detail/lock/unlock/change role.
- Topic, question, quiz set, quiz session, progress, roadmap.
- README tổng quan tiếng Việt.

Chưa có hoặc chưa hoàn chỉnh:

- Google OAuth: `GET /api/auth/google`, `GET /api/auth/google/callback`.
- Import câu hỏi từ Excel thật; hiện chỉ import JSON list.
- Cơ chế tự gán role mặc định khi register.
- Test tự động cho controller/service.

## Kiểm Tra Build

Lệnh kiểm tra:

```powershell
dotnet build --no-restore
```

Nếu build thành công, output kỳ vọng:

```text
Build succeeded.
0 Error(s)
```

Hiện project có thể còn warning về connection string hardcoded trong `DevLearningHubContext.cs`. Warning này không chặn build, nhưng nên xử lý trước khi đưa lên môi trường thật.
