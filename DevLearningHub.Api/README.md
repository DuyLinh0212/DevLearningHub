# DevLearningHub API

DevLearningHub API là backend ASP.NET Core 8 cho hệ thống học lập trình, luyện quiz, theo dõi tiến độ học tập và diễn đàn cộng đồng. Dự án hiện tập trung vào các nhóm chức năng chính: xác thực người dùng, quản lý tài khoản, ngân hàng câu hỏi, bộ đề quiz, phiên làm bài, tiến độ học tập, roadmap và phân hệ diễn đàn cộng đồng (bài viết, bình luận, vote, tag, kiểm duyệt). Phân hệ diễn đàn có hỗ trợ realtime cho bình luận bằng SignalR: khi một người tạo, sửa hoặc xóa bình luận thì mọi người đang mở cùng bài viết sẽ thấy thay đổi ngay mà không cần tải lại trang.

## Công Nghệ Sử Dụng

- ASP.NET Core 8 Web API
- Entity Framework Core 8
- SQL Server
- JWT Bearer Authentication
- Refresh Token
- Role-based Authorization Policy (`AdminOnly`, `ModeratorOrAdmin`)
- SignalR cho realtime bình luận diễn đàn (hub `/hubs/comments`)
- Cloudinary để lưu ảnh (avatar, ảnh bài viết, topic, roadmap, quiz)
- Swagger/OpenAPI trong môi trường Development

## Cấu Trúc Thư Mục

```text
Controllers/
  Auth/        API đăng ký, đăng nhập, refresh token, logout
  User/        API người dùng hiện tại và quản trị người dùng
  Quiz/        API topic, câu hỏi, bộ đề, phiên quiz, tiến độ, roadmap
  Community/   API diễn đàn: posts, comments, tags, vote, kiểm duyệt

Dtos/
  Auth/        DTO request/response cho xác thực
  Common/      Response wrapper dùng chung
  Quiz/        DTO cho topic, question, quiz set, quiz session, progress, roadmap
  Community/   DTO cho post, comment, tag, vote, moderation, paged response

Authorization/ Hằng số role (AppRoles) và policy (AppPolicies)
Entities/      Entity Framework Core entity và mapping database
Extensions/    Helper đọc claim từ JWT
Hubs/          SignalR hub cho realtime bình luận diễn đàn (CommentHub)
Services/      JWT option, token service và CloudinaryService
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
  },
  "Cloudinary": {
    "CloudName": "",
    "ApiKey": "",
    "ApiSecret": ""
  }
}
```

Lưu ý:

- `DefaultConnection` trỏ đến database SQL Server.
- `Jwt:Key` phải dài tối thiểu 32 bytes vì hệ thống ký access token bằng `HmacSha256`.
- `Cloudinary` cần điền `CloudName`, `ApiKey`, `ApiSecret` thật để upload ảnh hoạt động. Để trống thì các endpoint upload ảnh sẽ lỗi.
- Không nên để connection string thật hoặc secret Cloudinary trong source code khi deploy production.

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

Các API có phân trang (danh sách user, danh sách post) trả về `data` dạng paged response:

```json
{
  "items": [],
  "totalCount": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 0
}
```

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

Role được đưa vào JWT bằng claim `ClaimTypes.Role`.

### Role Và Policy

Các role được định nghĩa trong `Authorization/AppRoles.cs`:

- `Admin`: quyền cao nhất, quản trị toàn hệ thống.
- `Moderator`: kiểm duyệt nội dung diễn đàn.
- `User`: người dùng thông thường.

Các policy được định nghĩa trong `Authorization/AppPolicies.cs` và đăng ký trong `Program.cs`:

| Policy | Yêu cầu role |
| :--- | :--- |
| `AdminOnly` | `Admin` |
| `ModeratorOrAdmin` | `Moderator` hoặc `Admin` |

Các endpoint kiểm duyệt diễn đàn và quản lý tag dùng policy `ModeratorOrAdmin`. Các API admin user dùng kiểm tra role `Admin`.

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

## Phân Hệ Diễn Đàn Cộng Đồng

Phân hệ diễn đàn nằm trong `Controllers/Community/` gồm 3 controller chính (`PostsController`, `CommentsController`, `TagsController`) và một helper dùng chung cho logic vote (`CommunityVotes`).

Đặc điểm chung:

- Đọc dữ liệu (danh sách post, chi tiết post, danh sách comment, danh sách tag) là `AllowAnonymous`.
- Tạo/sửa/xóa/vote/comment yêu cầu JWT hợp lệ.
- Kiểm duyệt và quản lý tag yêu cầu policy `ModeratorOrAdmin`.
- Nội dung bị ẩn dùng cờ `is_hidden` thay cho xóa cứng. Người ẩn được ghi lại trong `moderation_logs`.

Bảng liên quan:

- `posts`
- `post_tags`
- `tags`
- `comments`
- `votes`
- `moderation_logs`
- `users`

### Nhóm API Posts

Base route: `api/posts`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Danh sách bài viết có phân trang, tìm kiếm, lọc theo tag và tác giả |
| `GET` | `/{id}` | Không | Chi tiết bài viết, tự tăng `view_count` |
| `POST` | `/` | Có | Tạo bài viết mới |
| `PUT` | `/{id}` | Có (tác giả) | Cập nhật bài viết và thay tag |
| `POST` | `/{id}/image` | Có (tác giả) | Upload ảnh bìa bài viết lên Cloudinary (`multipart/form-data`) |
| `DELETE` | `/{id}` | Có (tác giả hoặc Mod/Admin) | Xóa bài viết kèm comment và vote |
| `POST` | `/{id}/vote` | Có | Upvote/downvote bài viết (toggle) |
| `GET` | `/{id}/comments` | Không | Lấy comment dạng cây lồng nhau |
| `POST` | `/{id}/comments` | Có | Thêm comment hoặc reply |
| `POST` | `/{id}/moderate` | Mod/Admin | Ẩn hoặc bỏ ẩn bài viết, ghi `moderation_logs` |

Query của `GET /api/posts`:

- `page`: trang hiện tại, mặc định `1`.
- `pageSize`: số bản ghi mỗi trang, mặc định `20`, tối đa `100`.
- `search`: tìm theo tiêu đề hoặc nội dung markdown.
- `tag`: lọc theo slug của tag.
- `authorId`: lọc theo tác giả.

Ghi chú:

- Danh sách chỉ trả về bài viết chưa bị ẩn (`is_hidden = false`).
- Bài viết bị ẩn chỉ tác giả hoặc Mod/Admin mới xem được chi tiết.
- Chỉ tác giả mới được sửa hoặc upload ảnh bài viết của mình.
- Khi tạo/sửa bài viết, mọi `tagIds` truyền lên phải tồn tại. Ở `PUT`, để `tagIds = null` thì giữ nguyên tag hiện tại.
- Xóa bài viết sẽ xóa kèm toàn bộ comment và vote liên quan.

### Nhóm API Comments

Base route: `api/comments`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `PUT` | `/{id}` | Có (tác giả) | Cập nhật nội dung comment |
| `DELETE` | `/{id}` | Có (tác giả hoặc Mod/Admin) | Xóa comment và toàn bộ reply lồng nhau |
| `POST` | `/{id}/vote` | Có | Upvote/downvote comment (toggle) |
| `POST` | `/{id}/accept` | Có (tác giả bài viết) | Đánh dấu comment là câu trả lời được chấp nhận (toggle) |
| `POST` | `/{id}/moderate` | Mod/Admin | Ẩn hoặc bỏ ẩn comment, ghi `moderation_logs` |

Ghi chú:

- Comment tạo từ `POST /api/posts/{id}/comments`; có thể truyền `parentId` để reply, parent phải thuộc cùng bài viết và chưa bị ẩn.
- Xóa comment sẽ xóa đệ quy toàn bộ reply con và vote của chúng; nếu comment bị xóa đang là accepted answer thì gỡ con trỏ `accepted_comment_id` trên bài viết.
- Chỉ tác giả bài viết mới được accept câu trả lời; accept lại comment đang accepted sẽ bỏ chọn.
- Khi Mod/Admin ẩn một comment đang là accepted answer thì comment đó tự bị bỏ accept.
- Tạo, sửa, xóa comment đều phát sự kiện realtime qua SignalR tới mọi client đang mở bài viết đó (xem mục "Realtime Bình Luận Qua SignalR"). Riêng vote, accept và moderate hiện chưa phát realtime.

### Nhóm API Tags

Base route: `api/tags`

| Method | Endpoint | Auth | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Danh sách tag, sắp xếp theo tên |
| `POST` | `/` | Mod/Admin | Tạo tag mới |
| `PUT` | `/{id}` | Mod/Admin | Cập nhật tên và màu tag |
| `DELETE` | `/{id}` | Mod/Admin | Xóa tag và gỡ khỏi mọi bài viết |

Ghi chú:

- `slug` được tự sinh từ `name` (chuẩn hóa chữ thường, thay ký tự đặc biệt bằng dấu gạch, tối đa 50 ký tự).
- Trùng `name` hoặc `slug` sẽ trả về `409 Conflict`.
- `colorHex` nếu để trống sẽ mặc định `#6366f1`; giá trị không đủ định dạng `#RRGGBB` cũng được đưa về mặc định.

### Logic Vote Dùng Chung

`CommunityVotes` xử lý vote cho cả post và comment trên bảng `votes`:

- `targetType`: `"post"` hoặc `"comment"`.
- `voteType`: `"up"` hoặc `"down"`.
- Toggle: vote lại cùng loại sẽ gỡ vote; vote loại khác sẽ chuyển đổi.
- Sau mỗi thao tác, API đếm lại tổng `upvotes`/`downvotes` và đồng bộ vào `posts` hoặc `comments`, trả về cả `myVote` hiện tại của người dùng.

### Realtime Bình Luận Qua SignalR

Phân hệ diễn đàn dùng SignalR để đẩy thay đổi bình luận theo thời gian thực. Mục tiêu là khi một người tạo, sửa hoặc xóa bình luận thì mọi người đang xem cùng bài viết sẽ thấy ngay mà không cần F5.

Hub được định nghĩa trong `Hubs/CommentHub.cs` và map tại:

```text
/hubs/comments
```

Cách hoạt động:

- Client gọi method `JoinPost(postId)` trên hub để tham gia group của một bài viết, và `LeavePost(postId)` khi rời. Mỗi group có tên dạng `post-{postId}`, nên broadcast chỉ tới đúng những người đang mở bài viết đó.
- Hub cho phép kết nối ẩn danh (đọc bình luận vốn là `AllowAnonymous`). Mọi hành động ghi (tạo/sửa/xóa) vẫn đi qua REST endpoint có `[Authorize]`, nên kết nối SignalR chỉ dùng để nhận thông báo, không dùng để ghi dữ liệu.
- Payload được serialize camelCase để khớp với response REST hiện có.

Các sự kiện server đẩy về client:

| Sự kiện | Phát ra khi | Payload |
| :--- | :--- | :--- |
| `CommentCreated` | `POST /api/posts/{id}/comments` thành công | `CommentResponse` của bình luận/reply vừa tạo |
| `CommentUpdated` | `PUT /api/comments/{id}` thành công | `CommentResponse` sau khi cập nhật |
| `CommentDeleted` | `DELETE /api/comments/{id}` thành công | `{ postId, commentId, deletedIds }` gồm toàn bộ id bị xóa (cả reply lồng nhau) |

Ghi chú:

- Chỉ phân hệ Comment dùng realtime. Post, Vote (Like/Dislike), Notification và các module khác không phát qua SignalR.
- Client nhận sự kiện nên xử lý idempotent (kiểm tra id đã có trong cây chưa) vì người tự thao tác cũng nhận lại broadcast của chính mình.

### Upload Ảnh Qua Cloudinary

`CloudinaryService` (đăng ký trong `Program.cs`) xử lý upload ảnh cho nhiều phân hệ:

- Avatar người dùng: `devlearninghub/avatars`
- Ảnh bài viết: `devlearninghub/posts/{postId}`
- Ảnh topic, roadmap, quiz: thư mục tương ứng

Ràng buộc validate ảnh:

- Định dạng cho phép: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.
- Dung lượng tối đa: `5MB`.

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
| Community | `posts`, `post_tags`, `tags`, `comments`, `votes`, `moderation_logs`, `notifications` |
| Coding problem | `problems`, `test_cases`, `submissions`, `submission_test_results`, `programming_languages` |

## Các Điểm Cần Seed Dữ Liệu

Để test đầy đủ, database cần có:

- Role `Admin`, `Moderator`, `User` (hoặc role mặc định khác) active.
- Ít nhất một admin user có record trong `user_roles`.
- Ít nhất một moderator user để test các API kiểm duyệt diễn đàn.
- Topic active để tạo câu hỏi.
- Question và option để tạo quiz set.
- Quiz set có câu hỏi để start quiz session.
- Một vài tag để gán cho bài viết diễn đàn.

## Trạng Thái Hiện Tại So Với Plan

Đã có:

- Auth cơ bản bằng JWT và refresh token.
- User profile, update profile, stats, leaderboard.
- Admin list/detail/lock/unlock/change role.
- Topic, question, quiz set, quiz session, progress, roadmap.
- Phân hệ diễn đàn cộng đồng: posts, comments, tags, vote, accept answer, kiểm duyệt với `moderation_logs`.
- Realtime bình luận diễn đàn qua SignalR (tạo/sửa/xóa comment) bằng hub `/hubs/comments`.
- Upload ảnh qua Cloudinary (avatar, post, topic, roadmap, quiz).
- Phân quyền bằng policy `AdminOnly` và `ModeratorOrAdmin`.
- README tổng quan tiếng Việt.

Chưa có hoặc chưa hoàn chỉnh:

- Google OAuth: `GET /api/auth/google`, `GET /api/auth/google/callback`.
- Import câu hỏi từ Excel thật; hiện chỉ import JSON list.
- Cơ chế tự gán role mặc định khi register.
- Notification cho hoạt động diễn đàn (bảng `notifications` đã có mapping nhưng chưa có API).
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
