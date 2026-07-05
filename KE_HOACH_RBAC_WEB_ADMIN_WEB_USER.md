# Kế hoạch RBAC cho Web.Admin và Web.User

## Mục tiêu tài liệu

Tài liệu này gom toàn bộ định hướng và kế hoạch triển khai liên quan đến:

- Việt hóa Sidebar của `Web.Admin`
- Hợp nhất màn hình phân quyền trên `Web.Admin`
- Tổ chức lại Sidebar `Web.Admin` theo workflow nghiệp vụ
- Refactor chiến lược phân quyền của `Web.User`

Tài liệu này là plan triển khai và định hướng kiến trúc, không phải mô tả code đã làm.

---

# Phần A. Web.Admin

## 1. Mục tiêu triển khai v1

- Dùng `/admin/roles` làm màn hình **Phân quyền** chính
- Chuyển màn này thành 2 tab:
  - `Nhóm quyền`
  - `Danh sách người dùng`
- Giữ `/admin/users` để tương thích cũ nhưng redirect sang `/admin/roles?tab=users`
- Việt hóa toàn bộ Sidebar admin sang tiếng Việt có dấu
- Tái tổ chức giao diện phân quyền theo layout 2 cột:
  - Trái là danh sách role
  - Phải là ma trận quyền
- Giữ cơ chế override quyền theo từng user trong tab `Danh sách người dùng`

---

## 2. Quyết định v1

### 2.1 Quyết định điều hướng

Để giảm khối lượng thay đổi route và giảm rủi ro trong lần triển khai đầu:

- Sidebar v1 chỉ giữ một entry chính cho khu vực RBAC là `Phân quyền`
- Entry này trỏ tới `/admin/roles`
- `/admin/users` chỉ còn vai trò tương thích cũ và redirect mềm sang `/admin/roles?tab=users`

### 2.2 Quyết định hiển thị

- Không làm gán cứng UI theo role cụ thể như `Moderator`, `Forum Admin`, `CTV Quiz`
- Mọi menu, tab và dữ liệu đều phải hiển thị theo permission thực tế
- Các ví dụ role trong tài liệu chỉ có tính minh họa, không được hardcode vào logic điều hướng

### 2.3 Quyết định phạm vi

Trong v1:

- Không làm dải avatar thành viên theo role ở cột trái
- Chỉ hiển thị `userCount`
- Giữ modal override quyền theo user đang có, chưa chuyển sang editor inline

---

## 3. Đề xuất tổ chức Sidebar Web.Admin

### 3.1 Nguyên tắc thiết kế

- Sidebar được tổ chức theo **chức năng nghiệp vụ (Business Workflow)** thay vì theo **Role**
- **Role chỉ quyết định người dùng nhìn thấy menu nào**, không quyết định cấu trúc Sidebar
- Một menu có thể phục vụ nhiều Role khác nhau bằng cách hiển thị nội dung theo Permission
- Không tạo các menu riêng như `Moderator`, `Forum Admin`, `CTV Quiz` vì sẽ khó mở rộng khi hệ thống phát sinh thêm nhiều loại CTV
- Các ví dụ role trong tài liệu này chỉ là ví dụ minh họa, không làm gán cứng; việc hiển thị luôn phải dựa trên permission

### 3.2 Cấu trúc Sidebar mục tiêu

```text
🏠 Điều phối
│
├── Tổng quan
├── Kiểm duyệt
├── Báo cáo
└── Bình luận

📚 Nội dung
│
├── Bài viết
├── Bài code
├── Bộ đề
├── Lộ trình
├── Chủ đề
└── Tag

👥 Quản lý truy cập
│
├── Người dùng
├── Vai trò
└── Quyền

⚙️ Hệ thống
│
├── Nhật ký
└── Cài đặt
```

### 3.3 Ghi chú với v1

Đề xuất trên là **cấu trúc Sidebar mục tiêu** về mặt Information Architecture.

Tuy nhiên trong lần triển khai v1 hiện tại:

- Chưa tách `Người dùng`, `Vai trò`, `Quyền` thành 3 menu độc lập
- Sẽ gộp trước vào một màn `Phân quyền`
- Sau này có thể tách tiếp mà không phải đổi lại cơ chế phân quyền, vì nền tảng hiển thị vẫn là permission-driven

---

## 4. Ý nghĩa từng khu vực trên Sidebar

## Điều phối

Đây là khu vực làm việc hằng ngày của Admin và các CTV.

### Tổng quan

Hiển thị Dashboard và các thống kê hệ thống.

Yêu cầu quyền:

- `analytics:view`

### Kiểm duyệt

Đây là **một Moderation Queue duy nhất**, không tách thành nhiều menu.

Các loại nội dung hiển thị theo permission của người đăng nhập.

Ví dụ:

```text
Kiểm duyệt

• Bài viết
• Bài code
• Bộ đề
• Ngân hàng bài
• Lộ trình
```

Nguyên tắc:

- Người có `post:review` chỉ nhìn thấy `Bài viết`
- Người có `quiz:review` chỉ nhìn thấy `Bộ đề`
- Người có `problem_bank:review` chỉ nhìn thấy `Ngân hàng bài`
- Admin nhìn thấy toàn bộ

Không tạo các menu riêng:

- Duyệt bài viết
- Duyệt Quiz
- Duyệt Roadmap
- Duyệt Bank

### Báo cáo

Quản lý toàn bộ báo cáo do người dùng gửi.

Ví dụ các tab:

```text
Bài viết

Bình luận

Người dùng

Quiz

Roadmap
```

Các tab cũng hiển thị theo permission.

### Bình luận

Quản lý comment vi phạm.

Ví dụ:

- Comment bị report
- Comment spam
- Comment đã ẩn
- Comment đã xóa

CTV lọc comment chỉ cần truy cập menu này mà không cần đi qua Moderation Queue.

## Nội dung

Đây là khu vực CRUD nội dung của hệ thống, không phải khu vực kiểm duyệt.

Bao gồm:

- Bài viết
- Bài code
- Bộ đề
- Lộ trình
- Chủ đề
- Tag

## Quản lý truy cập

Bao gồm:

- Người dùng
- Vai trò
- Quyền

Không nên tạo các menu như:

- Moderator
- Moderator Roles

vì `Moderator` chỉ là một role trong hệ thống RBAC.

## Hệ thống

Bao gồm:

- Nhật ký
- Cài đặt hệ thống

Sau này có thể mở rộng thêm:

- Email
- AI
- Queue
- Storage
- Cache
- Backup

---

## 5. Hiển thị Sidebar theo Permission

### CTV kiểm duyệt bài viết

```text
Điều phối
    Kiểm duyệt
```

Bên trong chỉ hiển thị:

```text
Bài viết
```

### CTV kiểm duyệt ngân hàng bài

```text
Điều phối
    Kiểm duyệt
```

Bên trong chỉ hiển thị:

```text
Ngân hàng bài
```

### CTV lọc bình luận

```text
Điều phối
    Bình luận
```

### Quản trị diễn đàn

```text
Điều phối
    Kiểm duyệt
    Báo cáo
    Bình luận
```

### Admin

Hiển thị toàn bộ Sidebar.

### Kết luận

Sidebar chỉ nên phản ánh **chức năng của hệ thống**, không phản ánh **vai trò của người dùng**.

Role sẽ quyết định:

- Menu nào được hiển thị
- Tab nào xuất hiện trong từng menu
- Dữ liệu nào được phép truy cập
- Thao tác nào được phép thực hiện

Thiết kế này giúp Sidebar luôn gọn gàng, dễ mở rộng và không cần thay đổi cấu trúc khi phát sinh thêm các vai trò như CTV kiểm duyệt bài viết, CTV kiểm duyệt ngân hàng câu hỏi, CTV lọc bình luận hoặc các nhóm Reviewer khác.

---

## 6. Kế hoạch Việt hóa Sidebar hiện tại

Các nhãn cần đổi sang tiếng Việt có dấu:

- `Điều phối`
- `Nội dung`
- `Hệ thống`
- `Tổng quan`
- `Kiểm duyệt`
- `Bộ đề`
- `Bài code`
- `Chủ đề`
- `Lộ trình`
- `Bài viết`
- `Báo cáo`
- `Phân quyền`
- `Nhật ký`
- `Cài đặt`
- `Quản trị viên`
- `Vận hành, kiểm duyệt và hệ thống`
- `Đóng menu`

Các nhãn không nên giữ tiếng Anh hoặc không dấu trong UI cuối:

- `Control room`
- `Admin Hub`
- `Moderator roles`
- `Tong quan`
- `Cai dat`
- `Phan quyen`

---

## 7. Kế hoạch hợp nhất màn Phân quyền

## 7.1 Điều hướng

- `/admin/roles` là màn hình chính
- Query param `tab=groups|users`
- Nếu thiếu query param thì mặc định `tab=groups`
- `/admin/users` redirect sang `/admin/roles?tab=users`

## 7.2 Cấu trúc màn hình

### Tab `Nhóm quyền`

Layout 2 cột:

- Cột trái:
  - Danh sách role
  - Tên role
  - Mô tả
  - `userCount`
  - Trạng thái active/inactive
  - Badge system/custom
  - Nút `Thêm`, `Sửa`, `Xóa` theo permission hiện có

- Cột phải:
  - Ma trận quyền của role đang chọn
  - Checkbox theo từng permission có thật
  - Nút `Lưu`
  - Lưu bằng `PUT /api/admin/roles/{id}/permissions`

### Tab `Danh sách người dùng`

Tái sử dụng flow hiện tại:

- Search
- Filter role
- Filter status
- Pagination
- Tạo user
- Khóa / mở khóa
- Xem profile
- Modal `Quản lý người dùng`

Modal `Quản lý người dùng` tiếp tục dùng:

- `GET /api/admin/users/{id}/management`
- `PUT /api/admin/users/{id}/management`

Mục tiêu của tab này là giữ trải nghiệm quản trị user, nhưng đặt nó vào cùng một vùng chức năng với role/permission.

---

## 8. Danh mục 32 quyền hiện tại

Đây là nguồn sự thật cần dùng để seed/upsert permission catalog.

### Moderation / Review

- `problem_bank:review`
- `post:review`
- `quiz:review`
- `problem:review`

### Post

- `post:create`
- `post:edit_own`
- `post:edit_any`
- `post:delete_any`
- `post:hide`
- `post:hide_any`

### Comment

- `comment:create`
- `comment:hide`
- `comment:delete`

### User

- `user:view_all`
- `user:ban`
- `user:edit_role`

### Problem

- `problem:create`
- `problem:edit`

### Quiz

- `quiz:create`
- `quiz:edit`

### Roadmap

- `roadmap:create`
- `roadmap:edit`
- `roadmap:delete`
- `roadmap:view_progress`

### Role

- `role:create`
- `role:assign_permission`
- `role:view`
- `role:delete`
- `role:edit`

### System / Admin

- `analytics:view`
- `audit:view`
- `system.full_control`

---

## 9. Quy tắc dựng ma trận quyền

## 9.1 Quy tắc hàng

Row được dựng theo `resource/module` của permission:

- `post` → `Bài đăng`
- `comment` → `Bình luận`
- `user` → `Người dùng`
- `problem` → `Bài tập lập trình`
- `problem_bank` → `Ngân hàng bài tập`
- `quiz` → `Quiz`
- `roadmap` → `Lộ trình`
- `role` → `Vai trò`
- `analytics` → `Phân tích`
- `audit` → `Nhật ký hệ thống`
- `system` → `Hệ thống`

## 9.2 Quy tắc cột

Column được sinh từ action suffix có thật trong catalog, nhưng luôn sắp theo thứ tự cố định sau:

1. `view`
2. `view_all`
3. `view_progress`
4. `create`
5. `edit`
6. `edit_own`
7. `edit_any`
8. `delete`
9. `delete_any`
10. `hide`
11. `hide_any`
12. `review`
13. `ban`
14. `assign_permission`
15. `full_control`

Label tiếng Việt cho các cột:

- `view` → `Xem`
- `view_all` → `Xem tất cả`
- `view_progress` → `Xem tiến độ`
- `create` → `Thêm mới`
- `edit` → `Chỉnh sửa`
- `edit_own` → `Sửa của mình`
- `edit_any` → `Sửa tất cả`
- `delete` → `Xóa`
- `delete_any` → `Xóa tất cả`
- `hide` → `Ẩn`
- `hide_any` → `Ẩn / hiện lại`
- `review` → `Duyệt`
- `ban` → `Khóa`
- `assign_permission` → `Gán quyền`
- `full_control` → `Toàn quyền`

## 9.3 Quy tắc ô trong bảng

- Chỉ render checkbox ở ô có permission thật
- Ô không có permission phải để trống hoặc disabled
- Không tự sinh permission giả chỉ để lấp đầy bảng
- `system.full_control` chỉ xuất hiện tại row `Hệ thống` và cột `Toàn quyền`

---

## 10. Tác động Frontend cần triển khai

### Sidebar

- Việt hóa toàn bộ text
- Bỏ entry `Người dùng` khỏi sidebar v1
- Giữ entry `Phân quyền` dẫn tới màn hợp nhất

### Role Management

- Rework `RoleManagementComponent` thành page shell có tab
- Tạo view model cho ma trận quyền, tối thiểu:
  - `PermissionMatrixColumn`
  - `PermissionMatrixRow`
- Không map trực tiếp 32 quyền trong template

### User Management

- Nhúng lại UI và logic hiện tại vào tab `Danh sách người dùng`
- Đồng bộ copy/UI với vùng `Phân quyền`
- Không đổi contract modal override quyền user

---

## 11. Tác động Backend cần triển khai

### 11.1 Catalog permission

- Thêm migration hoặc seed idempotent để upsert đúng 32 quyền
- Không đổi schema
- Nếu permission thiếu hoặc mô tả cũ không đúng thì cập nhật lại

### 11.2 Role response

Mở rộng `RoleResponse` để trả thêm:

- `effectivePermissions: string[]`

Giữ nguyên:

- `permissions: string[]`

Ý nghĩa:

- `permissions` là tập raw permission trong `role_permissions`
- `effectivePermissions` là tập quyền role thực sự có hiệu lực để render matrix đúng

### 11.3 Quy tắc tính `effectivePermissions`

- `Admin`:
  - Toàn bộ permission catalog
  - Luôn có `system.full_control`

- `User`:
  - Raw role permissions
  - Cộng thêm baseline user permissions đang được `PermissionService` áp dụng

- Role khác:
  - Dùng raw role permissions

### 11.4 API giữ nguyên

Không đổi contract các API sau:

- `GET /api/admin/permissions`
- `GET /api/admin/users/{id}/management`
- `PUT /api/admin/users/{id}/management`
- `POST /api/admin/users/{id}/management/logout`
- `PUT /api/admin/roles/{id}/permissions`

---

## 12. Test Plan cho Web.Admin

### Sidebar

- Sidebar render đúng tiếng Việt có dấu
- Logic ẩn/hiện menu theo permission vẫn hoạt động
- Không còn các label không dấu hoặc label tiếng Anh cũ

### Route

- `/admin/roles` mở tab `Nhóm quyền`
- `/admin/roles?tab=users` mở tab `Danh sách người dùng`
- `/admin/users` redirect đúng sang `/admin/roles?tab=users`

### Matrix

- Ma trận được sinh đúng từ 32 quyền hiện tại
- Ví dụ row `post` có các cột:
  - `Thêm mới`
  - `Sửa của mình`
  - `Sửa tất cả`
  - `Xóa tất cả`
  - `Ẩn`
  - `Ẩn / hiện lại`
  - `Duyệt`
- Row `system` chỉ có `Toàn quyền`
- Các ô không tồn tại không sinh checkbox giả

### Role actions

- Lưu quyền role gửi đúng payload `permissions[]`
- Reload lại state sau khi lưu
- Không xóa được role hệ thống
- Không xóa được role đang có user
- Create/edit role giữ nguyên rule hiện tại

### User management

- Tab `Danh sách người dùng` vẫn chạy đúng:
  - Search
  - Filter
  - Pagination
  - Tạo user
  - Khóa / mở khóa
  - Xem profile
  - Gán role và override quyền user

### Backend/API

- Các test API hiện có vẫn pass
- Bổ sung test cho `effectivePermissions` của `Admin`
- Bổ sung test cho `effectivePermissions` của `User`

---

## 13. Giả định và ràng buộc

- Danh sách 32 permission ở mục 8 là nguồn sự thật hiện tại
- File seed/dữ liệu legacy hiện có có thể chưa đầy đủ, cần được đồng bộ lại
- V1 chưa làm strip avatar user theo role
- V1 giữ modal override quyền user hiện tại
- Role examples trong tài liệu chỉ để minh họa, không được dùng làm điều kiện hardcode trong UI

---

# Phần B. Refactor Web.User Permission Strategy

## 1. Mục tiêu

Đơn giản hóa cơ chế phân quyền của `Web.User`, tách biệt rõ giữa:

- **User Application**
- **Admin Application**

`Web.User` chỉ phục vụ trải nghiệm của người dùng cuối:

- Học tập
- Tạo nội dung
- Quản lý nội dung của chính mình

`Web.User` không phải là nơi thực hiện các chức năng quản trị.

---

## 2. Vấn đề hiện tại

Hiện tại `Web.User` đang sử dụng permission để:

- Hiển thị menu
- Hiển thị nút chức năng
- Quyết định người dùng có được thao tác hay không

Ví dụ:

- `post:create`
- `problem:create`
- `quiz:create`
- `roadmap:create`
- `post:edit_own`

Hệ quả:

- UI phụ thuộc quá nhiều vào permission
- Phải đồng bộ logic permission ở cả `Web.Admin` và `Web.User`
- Khi phát sinh nhiều role sẽ rất khó bảo trì
- `Web.User` dần trở thành một `Admin thu nhỏ`

---

## 3. Hướng refactor

## 3.1 Không dùng permission để hiển thị UI trên Web.User

Các menu và chức năng dành cho người dùng cuối nên được quyết định bởi:

- Đăng nhập hay chưa
- Chủ sở hữu tài nguyên
- Trạng thái dữ liệu như `ReviewStatus`, `Visibility`

Ví dụ với bài viết:

Hiển thị nút `Sửa`

Điều kiện:

- Là chủ bài viết

Không cần kiểm tra:

- `post:edit_own`

Hiển thị nút `Xóa`

Điều kiện:

- Là chủ bài viết

Không cần kiểm tra:

- `post:delete_own`

Hiển thị nút `Đăng bài`

Điều kiện:

- Đã đăng nhập

Không cần kiểm tra:

- `post:create`

## 3.2 Permission chỉ dùng ở Backend

Frontend chỉ quyết định trải nghiệm người dùng.

Backend vẫn tiếp tục xác thực quyền nếu cần.

Ví dụ:

```text
POST /api/posts

→ Backend kiểm tra đăng nhập
→ Backend kiểm tra Business Rule
→ Backend tạo bài
```

## 3.3 Chuyển các chức năng quản trị sang Web.Admin

Không hiển thị trên `Web.User` các chức năng như:

- Xóa bài của người khác
- Ẩn bài viết
- Duyệt bài
- Ban người dùng
- Xem Audit Log
- Quản lý Role
- Quản lý Permission

Các chức năng này chỉ tồn tại trong `Web.Admin`.

## 3.4 Web.User chỉ quản lý dữ liệu của chính mình

Người dùng có thể:

- Tạo bài viết
- Sửa bài viết của mình
- Xóa bài viết của mình
- Tạo Quiz
- Tạo Problem
- Tạo Roadmap
- Quản lý các nội dung do mình tạo

Người dùng không thể:

- Xóa bài của người khác
- Duyệt bài
- Ẩn bài người khác
- Xử lý báo cáo
- Quản lý người dùng

## 3.5 Giữ lại Permission ở Backend cho khả năng mở rộng

Không xóa toàn bộ permission.

Permission vẫn tồn tại để phục vụ:

- `Web.Admin`
- API Authorization
- Khả năng mở rộng nếu sau này có thêm nhiều loại tài khoản người dùng

Frontend `Web.User` sẽ không phụ thuộc trực tiếp vào permission.

---

## 4. Các bước thực hiện

### Bước 1

Loại bỏ khỏi các component của `Web.User` các đoạn:

- `hasPermission(...)`
- `canAccess(...)`
- `permissionGuard`

### Bước 2

Thay thế bằng điều kiện nghiệp vụ.

Ví dụ:

```typescript
const canEdit = post.authorId === currentUser.id;
```

```typescript
const canDelete = post.authorId === currentUser.id;
```

### Bước 3

Đơn giản hóa Sidebar của `Web.User`.

Sidebar không còn phụ thuộc vào permission.

Chỉ phụ thuộc vào:

- Đã đăng nhập
- Vai trò cơ bản `Guest/User`

### Bước 4

Chuyển toàn bộ các permission liên quan đến quản trị sang `Web.Admin`.

Ví dụ:

- `post:review`
- `problem:review`
- `quiz:review`
- `problem_bank:review`
- `roadmap:review`
- `user:ban`
- `role:*`
- `audit:view`
- `analytics:view`

---

## 5. Kết quả mong muốn

## Web.User

Chỉ tập trung vào:

- Học tập
- Tạo nội dung
- Quản lý nội dung của chính mình

UI đơn giản và ít phụ thuộc vào RBAC.

## Web.Admin

Toàn bộ chức năng quản trị sử dụng RBAC.

Permission quyết định:

- Menu
- Chức năng
- Dữ liệu được xem
- Hành động được phép thực hiện

Nhờ đó hai ứng dụng có trách nhiệm rõ ràng:

- **Web.User**: End-user Application
- **Web.Admin**: Administration & Moderation Application

---

## 6. Acceptance Criteria cho Web.User

- Không còn logic hiển thị UI chính dựa vào permission ở `Web.User`
- Các nút `Sửa`, `Xóa`, `Quản lý` trong `Web.User` được quyết định chủ yếu bởi ownership và trạng thái dữ liệu
- Sidebar `Web.User` không còn phụ thuộc trực tiếp vào permission catalog của RBAC admin
- Các thao tác quản trị chỉ còn ở `Web.Admin`
- Backend vẫn giữ authorization cần thiết để tránh frontend bypass

---

## 7. Kết luận chung

Định hướng cuối cùng của hệ thống là:

- `Web.User` đơn giản, tập trung vào end-user flow
- `Web.Admin` tập trung toàn bộ moderation và administration
- Sidebar `Web.Admin` phản ánh workflow nghiệp vụ, không phản ánh role
- Permission quyết định khả năng nhìn thấy menu, tab, dữ liệu và thao tác
- Không gán cứng UI theo tên role; mọi hiển thị đều phải suy ra từ permission thực tế

