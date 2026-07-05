# Kế hoạch: Roadmap + Search + Vietnamese Fix + Landing Page (Phase 4 → 6)

> Trích từ plan tổng "Fix moderation bugs + build sequential roadmap + EXP + admin log + search + UI polish".
> Phase 1 (fix bug) và Phase 2 (moderation UI + audit log + hiển thị trạng thái duyệt nội dung của chính mình) đã hoàn tất trên branch `enhance/be-all`.
> Các phase dưới đây **chưa bắt đầu**, làm theo thứ tự, báo cáo sau mỗi phase trước khi làm phase tiếp theo.


## Phase 4 — Mở rộng tìm kiếm (Roadmap, Code)

`topbar.ts` (`onSearchInput`, dòng 316-351) hiện chỉ query `/api/quiz-sets` và `/api/posts`. Thêm 2 lời gọi song song: `/api/roadmaps` (lọc theo title/description ở client, cùng pattern với quiz) và tìm kiếm code/problem — kiểm tra xem `ProblemsController` đã có endpoint list-with-filter công khai chưa; nếu có thì dùng, nếu chưa thì thêm hỗ trợ query param `?search=` (thay đổi nhỏ, cộng thêm). Cập nhật biến đếm `pending` lên 4, thêm mảng `matchedRoadmaps`/`matchedProblems`, mở rộng template `topbar.html` với 2 section kết quả mới ("Lộ trình", "Bài code") theo đúng mẫu section quiz/post hiện có.

**Kiểm tra:** mở ô tìm kiếm, gõ tên một roadmap đã biết và tên một bài code đã biết, xác nhận cả hai hiện ra như kết quả có thể click, điều hướng đúng trang.

---

## Phase 5 — Sửa dấu tiếng Việt trong UI Roadmap

Sửa toàn bộ chuỗi không dấu đã phát hiện trong `roadmap-view.html` (và `roadmap-view.ts` cho các label/message phía TS). Ví dụ: "Hoc tap"→"Học tập", "Lo trinh hoc tap"→"Lộ trình học tập", "Tao lo trinh"→"Tạo lộ trình", "Lam moi"→"Làm mới", "Dinh huong"→"Định hướng", "muc hoc"→"mục học", "Sua"/"Xoa"→"Sửa"/"Xóa", "Chua chon lo trinh"→"Chưa chọn lộ trình", "Lo trinh chua co muc hoc"→"Lộ trình chưa có mục học", "Ban da tao duoc khung lo trinh..."→sửa đủ dấu, "Bat dau"→"Bắt đầu", "Chua san sang"→"Chưa sẵn sàng", "Bat buoc"→"Bắt buộc", "Cap nhat"/"Khoi tao"→"Cập nhật"/"Khởi tạo", "Tieu de"→"Tiêu đề", "Mo ta"→"Mô tả", "Cap do"→"Cấp độ", "Co ban"/"Trung cap"/"Nang cao"→"Cơ bản"/"Trung cấp"/"Nâng cao", "Cong khai roadmap"→"Công khai lộ trình", "Dang luu..."→"Đang lưu...", "Huy"→"Hủy", aria-label của modal, v.v. Rà soát toàn bộ file, không chỉ các ví dụ nêu trên.

Ghi chú: `getReviewStatusLabel()`/`getReviewStatusClass()` trong `roadmap-view.ts:215-235` hiện đang dùng label không dấu — có thể cân nhắc migrate luôn phần này sang dùng `ReviewStatusBadgeComponent` (đã tạo ở Phase 2, có đủ dấu) thay vì giữ implementation riêng không dấu, dù việc này không được yêu cầu tường minh — hỏi ý kiến trước khi đổi.

**Kiểm tra:** so sánh trực quan trang roadmap trước/sau, không còn chuỗi tiếng Việt thiếu dấu nào.

---

## Phase 6 — Redesign trang Landing Page

`features/landing/` (347 dòng HTML, 130 dòng TS, 1077 dòng CSS) redesign lại toàn bộ giao diện bằng skill `/frontend-design` để định hướng thẩm mỹ (typography, lựa chọn hình ảnh riêng biệt, tránh giao diện template chung chung), giữ nguyên routing/CTA hiện có trong `landing.ts` trừ khi nội dung cần cập nhật cho đúng thực tế sản phẩm (ví dụ: danh sách tính năng nên phản ánh đúng những gì sản phẩm có — quiz, code playground, roadmap, forum, leaderboard). Sẽ xác định phạm vi từng section (hero, features, stats, testimonials, CTA) và xin duyệt hướng đi trước khi code, vì đây là thay đổi giao diện mang tính chủ quan/ảnh hưởng lớn nhất.

**Kiểm tra:** chạy dev server Web.User, xem trang `/` (hoặc route landing) trên trình duyệt, kiểm tra responsive ở độ rộng mobile, xác nhận không có link/CTA nào bị hỏng.

---

## Cách kiểm tra tổng thể

- Backend: `dotnet build` sau mỗi phase; chạy bộ test `DevLearningHub.Test` (`CodePlaygroundApiTests.cs`, `ForumApiTests.cs`, `QuizSetApiTests.cs`, `QuizSessionApiTests.cs`, `ReportsNotificationApiTests.cs`) — mở rộng test ở những chỗ hành vi thay đổi (chuỗi hành động moderation, filter hiển thị, cấp XP).
- Frontend: build cả Web.User và Web.Admin (`ng build` / `npm run build`), thao tác thủ công từng luồng đã thay đổi trên dev server theo đúng ghi chú kiểm tra ở trên.
- Migration: áp dụng các file `.sql` mới lên bản sao DB dev trước khi đụng vào DB dùng chung; xác nhận `CK_moderation_logs_action` cho phép các action string mới bằng một lượt approve/reject thủ công trên Web.Admin.
