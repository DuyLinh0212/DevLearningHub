# Tổng hợp thay đổi API

Tài liệu mô tả các thay đổi đã thực hiện trên `DevLearningHub.Api` (nhánh `develop`).

Gồm 3 nhóm tính năng:

1. CRUD Topic cho Admin
2. Phân quyền riêng lẻ cho từng user (per-user permission)
3. API sao chép Quiz Set (chỉ khi `AllowedCopy = true`)

---

## 1. CRUD Topic cho Admin

Trước đây `TopicsController` chỉ có `GET /api/topics`. Topic chỉ được tạo gián tiếp khi
tạo quiz set / import câu hỏi. Nay bổ sung CRUD riêng cho Admin.

### Endpoint

| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| GET | `/api/topics?includeInactive=` | Public | Liệt kê topic active; Admin truyền `includeInactive=true` để xem cả topic đã ẩn |
| POST | `/api/topics` | AdminOnly | Tạo topic, tự sinh slug duy nhất (bỏ dấu tiếng Việt), chặn trùng tên |
| PUT | `/api/topics/{id}` | AdminOnly | Sửa tên/slug/mô tả/icon/trạng thái, tự regenerate slug khi cần |
| DELETE | `/api/topics/{id}` | AdminOnly | **Soft delete** (`IsActive = false`) |

### Ghi chú thiết kế

- **DELETE là soft-delete** (không xóa cứng) để tránh vi phạm khóa ngoại với
  Questions / QuizSets / Problems / RoadmapTopics / UserTopicProgress. Đồng nhất với
  cách `QuestionsController` xử lý.
- Slug dùng chung thuật toán bỏ dấu + đảm bảo duy nhất giống logic import có sẵn.

### File thay đổi

- `Controllers/Quiz/TopicsController.cs` — thêm POST/PUT/DELETE, thêm `includeInactive` cho GET.
- `Dtos/Quiz/QuizDtos.cs` — thêm `CreateTopicRequest`, `UpdateTopicRequest`; thêm field `IsActive` vào `TopicResponse`.

---

## 2. Phân quyền riêng lẻ cho từng user

Hệ thống trước đây phân quyền **bằng role cứng** (JWT mang claim `role`, policy
`AdminOnly` / `ModeratorOrAdmin` dùng `RequireRole`). Admin chỉ có thể **đổi role**.

DB đã có sẵn bảng `permissions`, `role_permissions`, `user_permissions`
(có cờ `is_granted`) nhưng **chưa được sử dụng**. Phần này kích hoạt chúng theo
mô hình **Role + override riêng lẻ**.

### Mô hình quyền

```
Quyền hiệu lực (effective)
  = (quyền từ các role đang active)        ∪  RolePermission
  + (quyền cấp riêng cho user)             ∪  UserPermission.IsGranted = true
  - (quyền chặn riêng cho user)            \  UserPermission.IsGranted = false
```

### Cơ chế enforce

- Khi **login / refresh**, hệ thống tính quyền hiệu lực và **nhúng vào access token**
  dưới dạng claim `permission` (mỗi quyền 1 claim).
- Bảo vệ endpoint bằng attribute:

  ```csharp
  [HasPermission("quiz:create")]
  public async Task<...> CreateSomething() { ... }
  ```

- Quyền `system.full_control` đóng vai trò **wildcard** (thỏa mọi check).
- Các role check cũ (`AdminOnly`, `ModeratorOrAdmin`, `User.IsInRole(...)`) **được giữ nguyên** —
  cơ chế permission là bổ sung, không phá vỡ cái cũ.

> ⚠️ Vì quyền nằm trong JWT nên thay đổi quyền **chỉ có hiệu lực sau khi user
> login/refresh lại token**.

### Endpoint quản lý (đều yêu cầu Admin)

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| GET | `/api/admin/permissions` | Danh sách quyền, gom theo module |
| GET | `/api/admin/users/{userId}/permissions` | Quyền hiệu lực của user + chi tiết (role/grant/deny) |
| PUT | `/api/admin/users/{userId}/permissions` | Cấp / chặn / bỏ-override hàng loạt |
| DELETE | `/api/admin/users/{userId}/permissions/{permission}` | Bỏ 1 override (trở về kế thừa từ role) |

Body cho `PUT`:

```json
{
  "items": [
    { "permission": "quiz:create",     "state": "grant"   },
    { "permission": "post:delete_any", "state": "deny"    },
    { "permission": "comment:hide",    "state": "inherit" }
  ]
}
```

- `grant` — cấp quyền riêng cho user (thêm bản ghi `UserPermission.IsGranted = true`)
- `deny` — chặn quyền dù role có (`UserPermission.IsGranted = false`)
- `inherit` — xóa override, quay về kế thừa từ role

Phản hồi `GET .../permissions`:

```json
{
  "userId": "...",
  "roles": ["User"],
  "rolePermissions": ["comment:create", "post:create"],
  "grants": ["quiz:create"],
  "denies": ["post:delete_any"],
  "effective": ["comment:create", "post:create", "quiz:create"]
}
```

### File mới

- `Authorization/PermissionRequirement.cs` — requirement mang tên 1 quyền.
- `Authorization/PermissionAuthorizationHandler.cs` — kiểm tra claim `permission` (+ wildcard).
- `Authorization/PermissionPolicyProvider.cs` — tạo policy động cho tên bắt đầu bằng `perm:`, fallback về provider mặc định.
- `Authorization/HasPermissionAttribute.cs` — attribute `[HasPermission("...")]`.
- `Services/PermissionService.cs` — `IPermissionService` tính quyền hiệu lực + breakdown.
- `Controllers/User/AdminPermissionsController.cs` — catalog quyền.
- `Controllers/User/AdminUserPermissionsController.cs` — quản lý quyền theo user.
- `Dtos/Admin/PermissionDtos.cs` — DTOs.

### File sửa

- `Extensions/ClaimsPrincipalExtensions.cs` — thêm hằng claim type + helper `HasPermission()`.
- `Services/TokenService.cs` — `CreateAccessToken(...)` thêm tham số `permissions`, nhúng claim.
- `Controllers/Auth/AuthController.cs` — inject `IPermissionService`, tính & truyền effective permissions.
- `Program.cs` — đăng ký `IPermissionService`, `IAuthorizationPolicyProvider`, `IAuthorizationHandler`.

### Lưu ý khi dùng

- File seed `Database/DevLearningHubData.sql` hiện chỉ có user role `User`, **chưa có
  account Admin sẵn** — cần 1 tài khoản role `Admin` để gọi nhóm API này.
- Catalog quyền đã seed sẵn (ví dụ `quiz:create`, `user:edit_role`, `post:delete_any`,
  `system.full_control`...). **Chưa có** quyền riêng cho topic; nếu muốn gate CRUD topic
  bằng permission thì cần thêm bản ghi vào bảng `permissions` rồi gắn `[HasPermission(...)]`.

---

## 3. API sao chép Quiz Set

Bổ sung API sao chép quiz set. Cổng kiểm soát chính: chỉ cho copy khi
quiz set nguồn có `AllowedCopy = true`.

Trước đó field `AllowedCopy` đã tồn tại trong entity/DB nhưng **chưa được expose ở
DTO nào** nên không ai bật được. Đã bổ sung để cờ này có ý nghĩa.

### Endpoint

`POST /api/quiz-sets/{id}/copy` — yêu cầu đăng nhập (`[Authorize]`).

Body (tùy chọn):

```json
{ "title": "Tên bản sao tùy chọn" }
```

### Logic kiểm soát quyền copy

1. Không tìm thấy quiz set → `404`.
2. Quiz set **private** mà người gọi không phải chủ sở hữu / admin → `403`.
3. `AllowedCopy = false` và người gọi không phải chủ sở hữu / admin →
   `403 "This quiz set does not allow copying."`
4. Chủ sở hữu và admin **được bỏ qua cổng `AllowedCopy`** (copy quiz của chính mình
   không cần tự bật cờ).

### Hành vi sao chép (deep copy — độc lập với bản gốc)

- Tạo quiz set mới: `CreatedBy` = người gọi, `Title` = `"<gốc> (Copy)"` hoặc title truyền vào.
- Giữ nguyên: Description / Mode / TimeLimitSeconds / Level / TopicId.
- Mặc định bản sao: `IsPublic = false`, `AllowedCopy = false` (an toàn, không tự lan truyền).
- **Nhân bản từng câu hỏi + đáp án** thành bản ghi mới (do người copy sở hữu), giữ đúng
  thứ tự → sửa bản gốc không ảnh hưởng bản sao và ngược lại.

### Thay đổi kèm theo

- Thêm `AllowedCopy` vào `CreateQuizSetRequest`, `UpdateQuizSetRequest`
  → owner bật/tắt cho phép copy.
- Thêm `AllowedCopy` vào `QuizSetResponse`, `QuizSetDetailResponse`
  → client đọc được trạng thái.

### File thay đổi

- `Controllers/Quiz/QuizSetsController.cs` — thêm endpoint `POST /{id}/copy`; wire
  `AllowedCopy` vào create / update / các projection response.
- `Dtos/Quiz/QuizDtos.cs` — thêm `CopyQuizSetRequest`; thêm `AllowedCopy` vào các DTO liên quan.

### Lưu ý

- Bản sao luôn về private. Nếu muốn giữ nguyên `IsPublic` / `AllowedCopy` của bản gốc thì cần chỉnh thêm.
- Hiện cho phép copy **không giới hạn số lần**.

---

## Trạng thái build

- `DevLearningHub.Api` — build thành công, 0 warning / 0 error.
- `DevLearningHub.Test` — build thành công.

> Lưu ý: chưa chạy test runtime do connection string trỏ tới SQL Server nội bộ
> (`DELLBTIEN\SQLDUYLINH`, Windows Integrated Security). Cần chạy trên máy có DB.
