# Audit Log — Tính năng phía Backend (DevLearningHub.Api)

Ghi lại "ai làm gì, khi nào, trên đối tượng nào" và cho phép admin có quyền `audit:view` xem lại.

---

## 1. Thành phần

| Thành phần | File | Vai trò |
|------------|------|---------|
| Entity | `Entities/AuditLog.cs` | Bảng `audit_logs` (đã có sẵn) |
| Service | `Services/AuditService.cs` | **Mới** — ghi log tập trung |
| Controller | `Controllers/User/AdminAuditController.cs` | **Mới** — API xem log |
| DTO | `Dtos/Admin/AuditLogDtos.cs` | **Mới** — `AuditLogResponse` |
| DI | `Program.cs` | Đăng ký `IAuditService` + `AddHttpContextAccessor()` |

Cột bảng `audit_logs`: `id`, `actor_id`, `action` (≤100), `target_type` (≤50), `target_id`, `detail` (nvarchar max), `ip_address` (≤50), `created_at`.

---

## 2. AuditService — ghi log tập trung

```csharp
public interface IAuditService
{
    Task LogAsync(string action, string? targetType = null, Guid? targetId = null,
                  string? detail = null, Guid? actorId = null);
}
```

- **Actor**: lấy từ user đang đăng nhập (HttpContext). Có thể truyền `actorId` thủ công cho trường hợp
  login/register (lúc đó request chưa authenticated).
- **IP**: tự lấy từ `HttpContext.Connection.RemoteIpAddress`.
- **An toàn**: tự cắt chuỗi cho đúng giới hạn cột; lỗi ghi log được nuốt (try/catch) để
  **không làm hỏng** request chính (auditing là best-effort).

---

## 3. API xem log (yêu cầu quyền `audit:view`)

| Method | Route | Mô tả |
|--------|-------|-------|
| `GET` | `/api/admin/audit-logs` | Danh sách log (mới nhất trước), phân trang + lọc |
| `GET` | `/api/admin/audit-logs/actions` | Danh sách action phân biệt (cho dropdown lọc) |

### Tham số lọc của `GET /api/admin/audit-logs`
| Tham số | Ý nghĩa |
|---------|---------|
| `page`, `pageSize` | Phân trang (pageSize tối đa 100) |
| `action` | Lọc theo action (chứa chuỗi, vd `user.lock`) |
| `actorId` | Lọc theo người thực hiện |
| `targetType` | Lọc theo loại đối tượng (`user`, `quiz_set`...) |
| `targetId` | Lọc theo id đối tượng |
| `from`, `to` | Lọc theo khoảng thời gian (`created_at`) |

Mỗi dòng trả về (`AuditLogResponse`) kèm thông tin actor: `actorUsername`, `actorFullName`.

---

## 4. Các hành động được ghi log

| Action | Khi nào | Target |
|--------|---------|--------|
| `auth.register` / `auth.login` / `auth.refresh` / `auth.logout` | Sự kiện xác thực | user |
| `user.role_change` | Đổi vai trò 1 user (`PUT /admin/users/{id}/role`) | user |
| `user.lock` / `user.unlock` | Khóa / mở khóa tài khoản | user |
| `user.management_save` | Lưu role + quyền ở màn hình quản lý user | user |
| `user.permission_change` | Cấp/thu quyền lẻ (batch) | user |
| `user.permission_reset` | Gỡ override 1 quyền (về kế thừa role) | user |
| `quiz.delete` | Xóa bộ đề | quiz_set |

> AuthController đã được refactor để dùng chung `IAuditService` thay vì tự tạo entity.

---

## 5. Kết quả test

- Sinh log khi đổi role / khóa / mở khóa → hiển thị đúng actor, action, target, detail, IP.
- Lọc theo `action`, `actorId`, `targetType`, khoảng thời gian → đều đúng.
- `GET /actions` trả danh sách action phân biệt.
- User **không có** `audit:view` (vd namtqn4) gọi API → **403**.

---

## 6. Mở rộng về sau

Muốn ghi thêm hành động nào, chỉ cần inject `IAuditService` và gọi:
```csharp
await _audit.LogAsync("post.delete", "post", postId, $"title={post.Title}");
```
Đặt lời gọi **sau** khi thao tác chính `SaveChanges` thành công.
