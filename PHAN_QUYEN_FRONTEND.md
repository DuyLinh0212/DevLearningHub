# Phân quyền — Thay đổi phía Frontend

Tài liệu mô tả thay đổi của **2 ứng dụng Angular**:

- **DevLearningHub.Web.Admin** — màn hình "Quản lý người dùng" (gán role + tích quyền).
- **DevLearningHub.Web.User** — hiển thị nút **Xóa/Sửa** comment & bài đăng theo quyền.

---

## A. ADMIN — Màn hình "Quản lý người dùng"

### Mục tiêu
Dựng lại giao diện quản lý user đúng mẫu thiết kế: thông tin user + **radio chọn Role** +
**checkbox các Permission** (nhóm theo module) + nút **Lưu**, gọi API gộp
`/api/admin/users/{id}/management`.

### File thay đổi
| File | Thay đổi |
|------|----------|
| `src/app/features/admin/user-management/user-management.ts`   | Viết lại logic: bỏ modal cũ, thêm modal "Quản lý người dùng" |
| `src/app/features/admin/user-management/user-management.html` | Gộp nút thao tác + modal mới (radio role + checkbox quyền) |
| `src/app/features/admin/user-management/user-management.css`  | Style cho radio role & lưới checkbox quyền |

### Thay đổi giao diện
- Trong bảng user: gộp 2 nút cũ (đổi vai trò + quản lý quyền) thành **1 nút 🛡️ "Quản lý"**.
- Bỏ 2 modal cũ (dropdown role + modal grant/deny/inherit), thay bằng **1 modal duy nhất** gồm:
  - **Thông tin User**: username, email, họ tên.
  - **Role**: danh sách `radio` (User / Moderator / Admin), role hiện tại được chọn sẵn.
  - **Permissions**: checkbox nhóm theo module; mỗi nhóm có badge đếm `đã tích / tổng`.
    Mỗi ô hiện nhãn tiếng Việt (mô tả) + mã kỹ thuật (vd `post:create`); ô thuộc role hiện tại
    có icon 🛡️ gợi ý "mặc định từ vai trò".
  - Nút **Lưu** (kèm trạng thái "Đang lưu...").

### Luồng dữ liệu
```
openManageModal(user)
  └─ GET /api/admin/users/{id}/management
       ├─ manageRoles          ← danh sách role (đánh dấu selected)
       ├─ manageSelectedRole   ← role đang được chọn
       ├─ manageModules        ← catalog quyền nhóm theo module
       └─ manageChecked{}      ← map { tên-quyền : đang-tích? } theo "checked"

saveManage()
  └─ PUT /api/admin/users/{id}/management
       body: { role: manageSelectedRole, permissions: [các quyền đang tích] }
```

Ngữ nghĩa checkbox: **tích = có quyền**. Backend tự quy đổi sang grant/deny dựa trên role
(xem `PHAN_QUYEN_BACKEND.md`). Frontend chỉ gửi danh sách quyền **được tích**.

### Hàm chính (`user-management.ts`)
- `openManageModal(user)` / `closeManageModal()`
- `togglePermission(name)` — đảo trạng thái tích một quyền
- `countCheckedInModule(mod)` — đếm số quyền đã tích trong một module (cho badge)
- `saveManage()` — gửi role + danh sách quyền đã tích

---

## B. USER — Hiển thị nút Xóa/Sửa theo quyền

### Vấn đề ban đầu
User được cấp quyền `comment:delete` nhưng **không thấy nút xóa** comment của người khác.
Nguyên nhân phía frontend: hàm kiểm tra chỉ xét **tác giả**, **không** xét quyền:

```ts
// CŨ — chỉ tác giả mới xóa được
canDeleteComment(c) {
  return commentAuthorId === this.currentUserId;
}
```

Ngoài ra `/api/users/me` (lúc đó) không trả về quyền nên frontend hoàn toàn "mù" về permission.

### File thay đổi
| File | Thay đổi |
|------|----------|
| `src/app/features/forum/post-detail/post-detail.ts` | Nạp permission từ `/me`, thêm `hasPermission()`, cập nhật `canDelete*` / `canEdit*` |

### Thay đổi chi tiết

**1) Lưu permission của user đăng nhập**
```ts
currentUserPermissions: string[] = [];
```

**2) Nạp permission từ `/api/users/me`** (trong `loadCurrentUser()`)
```ts
this.currentUserPermissions =
  (user.permissions || []).map((p: string) => (p || '').toLowerCase());
```

**3) Helper kiểm tra quyền**
```ts
hasPermission(permission: string): boolean {
  const target = (permission || '').toLowerCase();
  return this.currentUserPermissions.includes(target)
      || this.currentUserPermissions.includes('system.full_control');
}
```

**4) Cập nhật điều kiện hiển thị nút**

| Hàm | Quy tắc mới |
|-----|-------------|
| `canDeleteComment(c)` | tác giả **HOẶC** `hasPermission('comment:delete')` |
| `canDeletePost()`     | tác giả **HOẶC** `hasPermission('post:delete_any')` |
| `canEditPost()`       | tác giả **HOẶC** `hasPermission('post:edit_any')` |
| `canEditComment(c)`   | **giữ nguyên** chỉ tác giả (không có quyền `comment:edit_any`) |

```ts
canDeleteComment(comment: any): boolean {
  if (!comment || !this.currentUserId) return false;
  const commentAuthorId = (comment.author.id || '').toString().toLowerCase();
  return commentAuthorId === this.currentUserId
      || this.hasPermission('comment:delete');
}
```

> Các điều kiện hiển thị nút khớp đúng với kiểm tra ở backend, tránh hiện nút rồi bị `403`.

---

## C. Cấu hình kết nối API (proxy)

Cả 2 frontend gọi API qua đường `/api` nhờ proxy. Khi chạy local, proxy được trỏ về API local
(`http://localhost:5122`):

- `DevLearningHub.Web.Admin/proxy.conf.json`
- `DevLearningHub.Web.User/proxy.conf.json`

---

## D. Cách chạy & kiểm thử

Chạy 3 service:
```bash
# API
cd DevLearningHub.Api && dotnet run --launch-profile http      # http://localhost:5122

# Frontend User
cd DevLearningHub.Web.User && npm start                        # http://localhost:4200

# Frontend Admin (đổi port để không trùng)
cd DevLearningHub.Web.Admin && npx ng serve --port 4300        # http://localhost:4300
```

Kịch bản kiểm thử:
1. **Admin** (`:4300`) → Quản lý người dùng → bấm 🛡️ ở một user → chọn role + tích/bỏ tích quyền → **Lưu**.
2. **User** (`:4200`) → đăng nhập bằng tài khoản vừa cấp quyền → mở một bài đăng → kiểm tra
   nút **Xóa** comment/bài đăng xuất hiện đúng theo quyền.

> ⚠️ **Quan trọng:** Permission được nhúng vào token lúc đăng nhập. Sau khi admin đổi quyền,
> user phải **đăng xuất / đăng nhập lại** thì nút mới hiển thị đúng.

---

## E. Tóm tắt file frontend đã thay đổi

| Ứng dụng | File |
|----------|------|
| Admin | `features/admin/user-management/user-management.ts` |
| Admin | `features/admin/user-management/user-management.html` |
| Admin | `features/admin/user-management/user-management.css` |
| Admin | `proxy.conf.json` |
| User  | `features/forum/post-detail/post-detail.ts` |
| User  | `proxy.conf.json` |
