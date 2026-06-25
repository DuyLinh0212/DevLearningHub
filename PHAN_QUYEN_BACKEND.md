# Phân quyền — Thay đổi phía Backend (DevLearningHub.Api)

Tài liệu mô tả các thay đổi backend liên quan tới **vai trò (Role)** và **quyền hạn (Permission)**:
trang quản lý người dùng của Admin, và việc cho phép người dùng thao tác (xóa comment, xóa/sửa
bài đăng) dựa trên **quyền** thay vì chỉ dựa trên vai trò.

---

## 1. Mô hình phân quyền hiện có

Hệ thống đã có sẵn cơ chế phân quyền 2 lớp:

- **Role → Permission**: mỗi vai trò (`Admin`, `Moderator`, `User`) gắn với một tập permission
  qua bảng `role_permissions`.
- **Override theo từng user**: bảng `user_permissions` cho phép **cấp thêm** (`is_granted = 1`)
  hoặc **thu hồi** (`is_granted = 0`) một quyền cụ thể cho một user, đè lên quyền từ vai trò.

**Quyền hiệu lực (effective)** được tính bởi `Services/PermissionService.cs`:

```
effective = (quyền-từ-các-role + grants) − denies
```

Quyền đặc biệt `system.full_control` là wildcard, thỏa mãn mọi kiểm tra quyền.

Các permission trong CSDL (nhóm theo module):

| Module  | Permission                                                        |
|---------|------------------------------------------------------------------|
| post    | `post:create`, `post:edit_own`, `post:edit_any`, `post:delete_any`, `post:hide` |
| comment | `comment:create`, `comment:delete`, `comment:hide`               |
| quiz    | `quiz:create`, `quiz:edit`                                        |
| problem | `problem:create`, `problem:edit`                                  |
| user    | `user:view_all`, `user:edit_role`, `user:ban`                    |
| audit   | `audit:view`                                                      |
| system  | `system.full_control`                                            |

---

## 2. Token (JWT) chứa permission

`Services/TokenService.cs` nhúng **role claims** và **permission claims** vào access token khi
đăng nhập. `Controllers/Auth/AuthController.cs → BuildAuthResponseAsync` lấy **quyền hiệu lực**
(`PermissionService.GetEffectivePermissionsAsync`) rồi đưa vào token.

> ⚠️ **Lưu ý quan trọng:** permission được "đóng băng" vào token tại thời điểm đăng nhập.
> Khi admin thay đổi quyền của một user, user đó phải **đăng xuất / đăng nhập lại** thì token mới
> chứa quyền mới.

Helper kiểm tra quyền — `Extensions/ClaimsPrincipalExtensions.cs`:

```csharp
// true khi user có quyền này HOẶC có wildcard system.full_control
public static bool HasPermission(this ClaimsPrincipal principal, string permission)
{
    return principal.HasClaim(PermissionClaimType, permission)
        || principal.HasClaim(PermissionClaimType, FullControlPermission);
}
```

---

## 3. API mới: Quản lý người dùng (Role + Permission gộp một màn hình)

Phục vụ trang "Quản lý User" của Admin (chọn role bằng radio + tích checkbox quyền + nút Lưu).

### File mới
- `Dtos/Admin/UserManagementDtos.cs`
- `Controllers/User/AdminUserManagementController.cs`

### Endpoint (yêu cầu quyền Admin — `[Authorize(Policy = AppPolicies.AdminOnly)]`)

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET`  | `/api/admin/users/{id}/management` | Trả về thông tin user + danh sách role (kèm `selected`) + toàn bộ catalog permission nhóm theo module, mỗi quyền có `checked` (đang hiệu lực) và `fromRole` (kế thừa từ vai trò hiện tại). |
| `PUT`  | `/api/admin/users/{id}/management` | Lưu role đã chọn + danh sách permission được tích. |

### Body của `PUT`
```json
{
  "role": "User",
  "permissions": ["post:create", "comment:create", "comment:delete"]
}
```

### Logic checkbox "tích = có quyền"
Khi lưu, controller đối chiếu danh sách `permissions` (các ô được tích) với quyền của **role mới**
rồi tự quy đổi sang override:

| Tình huống | Hành động |
|------------|-----------|
| Tích, role **chưa** có quyền | Tạo override **grant** (`is_granted = 1`) |
| Bỏ tích, role **đang** có quyền | Tạo override **deny** (`is_granted = 0`) |
| Trạng thái tích trùng với role | Xóa override → quay về **kế thừa** từ role |

→ Đảm bảo "quyền hiệu lực" sau khi lưu **khớp chính xác** các ô đã tích.

### Quy tắc nghiệp vụ
- Thay toàn bộ role hiện tại của user bằng **một** role đã chọn (atomic).
- **Chặn tự sửa**: admin không được thay đổi role/quyền của chính mình (tránh tự khóa quyền).
- Validate: role phải tồn tại & đang active; tên permission phải có trong catalog (sai → `400`).

### Kết quả test
- `GET` trả đúng trạng thái `checked`/`fromRole`.
- `PUT` đổi role + lưu quyền → bảng `user_permissions` ghi đúng grant/deny.
- Tự sửa quyền của mình → `400`; permission sai tên → `400`.

---

## 4. Sửa lỗi: Cho phép thao tác theo PERMISSION (không chỉ theo Role)

**Vấn đề:** Một số endpoint kiểm tra theo **vai trò** (`IsModerator()` = `User.IsInRole(...)`),
nên một user role `User` dù được **cấp riêng** quyền (vd `comment:delete`) vẫn bị **403**.

**Cách sửa:** Thay kiểm tra vai trò bằng kiểm tra **permission** (`User.HasPermission(...)`).
Vì role `Moderator`/`Admin` vốn đã có các quyền tương ứng trong `role_permissions`, claim quyền của
họ vẫn chứa quyền đó → tương thích ngược, không làm mất quyền của Moderator/Admin.

### `Controllers/Community/CommentsController.cs` — `DeleteComment`
```csharp
// Trước:
if (comment.AuthorId != userId && !IsModerator())

// Sau:
if (comment.AuthorId != userId && !User.HasPermission("comment:delete"))
```

### `Controllers/Community/PostsController.cs`
```csharp
// DeletePost — Trước:
if (post.AuthorId != userId && !IsModerator())
// Sau:
if (post.AuthorId != userId && !User.HasPermission("post:delete_any"))

// UpdatePost (sửa bài) — Trước: chỉ tác giả
if (post.AuthorId != userId)
// Sau:
if (post.AuthorId != userId && !User.HasPermission("post:edit_any"))
```

> Sửa comment (`UpdateComment`) **giữ nguyên author-only** vì hệ thống không có quyền
> `comment:edit_any`.

### Kết quả test (user role `User` + grant `comment:delete`)
- Xóa comment của người khác → **200** ✅
- User không có quyền → **403** ✅

---

## 5. Bổ sung `roles` + `permissions` vào `/api/users/me`

**Vấn đề gốc:** Frontend không có cách nào biết user đang đăng nhập có quyền gì, vì
`GET /api/users/me` chỉ trả thông tin hồ sơ cơ bản.

### `Dtos/Auth/AuthDtos.cs` — thêm 2 trường vào `UserProfileResponse`
```csharp
public List<string> Roles { get; set; } = new();        // role đang active
public List<string> Permissions { get; set; } = new();  // quyền hiệu lực
```

### `Controllers/User/UsersController.cs` — `GetMe`
- Inject `IPermissionService`.
- Nạp kèm role của user và tính **quyền hiệu lực** trả về cho client.

```json
GET /api/users/me
{
  "data": {
    "id": "...", "username": "namtest", "email": "...",
    "roles": ["User"],
    "permissions": ["comment:create", "comment:delete", "post:create", "post:edit_own"]
  }
}
```

---

## 6. Danh sách file backend đã thay đổi

| File | Thay đổi |
|------|----------|
| `Dtos/Admin/UserManagementDtos.cs` | **Mới** — DTO màn hình quản lý user |
| `Controllers/User/AdminUserManagementController.cs` | **Mới** — GET/PUT quản lý role+quyền |
| `Dtos/Auth/AuthDtos.cs` | Thêm `Roles`, `Permissions` vào `UserProfileResponse` |
| `Controllers/User/UsersController.cs` | `/me` trả roles + permissions |
| `Controllers/Community/CommentsController.cs` | Xóa comment theo quyền `comment:delete` |
| `Controllers/Community/PostsController.cs` | Xóa/sửa bài theo `post:delete_any` / `post:edit_any` |

---

## 7. Ghi chú vận hành

- Sau khi đổi quyền của user, user phải **đăng nhập lại** để token cập nhật quyền mới.
- Quyền `system.full_control` vượt qua mọi kiểm tra `HasPermission`.
- Mọi endpoint quản lý đều yêu cầu policy `AdminOnly`.
