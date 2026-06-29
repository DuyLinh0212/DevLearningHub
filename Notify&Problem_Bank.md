## Yêu Cầu Cập Nhật Tính Năng Mới

### 1. Tích Hợp SignalR (Hệ Thống Thông Báo Thời Gian Thực)
Bổ sung các API sử dụng SignalR để đẩy thông báo (push notifications) cho người dùng ngay lập tức trong các sự kiện sau:
*   **Tương tác:** Có người trả lời (reply) bình luận của người dùng.
*   **Kiểm duyệt & Xóa nội dung:**
    *   Bài viết (Post) bị xóa.
    *   Bình luận (Comment) bị xóa.
    *   Bộ đề (Quiz) bị xóa.
    *   Bài tập Code bị xóa.

---

### 2. Thiết Kế Bảng `problem_bank` (Kho Quản Lý Bài Tập Code)
Thêm mới một bảng dữ liệu với tên đề xuất là `problem_bank` (có thể điều chỉnh tùy ý). Bảng này hoạt động như một danh sách/bộ sưu tập để quản lý các bài tập code một cách tập trung.

**Tính năng dành cho Người tạo (Creator):**
*   **Quản lý linh hoạt:** Cho phép tạo một `problem_bank` trống lúc đầu và bổ sung các bài tập vào sau.
*   **Thêm/Bớt bài tập:** Người dùng có thể dễ dàng thêm một bài tập code của họ vào kho, hoặc gỡ bỏ (remove) bài tập đó ra khỏi `problem_bank`.

**Tính năng Thống kê & Theo dõi (Dành cho Người học):**
*   **Lưu vết người dùng:** Hệ thống cần lưu trữ thông tin của tất cả những User đã tham gia giải các bài tập nằm trong `problem_bank`.
*   **Đo lường tiến độ:** Tính toán và hiển thị phần trăm hoàn thành của từng User.
    *   *Ví dụ:* Một `problem_bank` có tổng cộng 5 bài code, nếu User giải quyết thành công 4 bài thì tiến độ hoàn thành là **80%** `(4/5 * 100)`.
*   **Tỷ lệ chính xác:** Thống kê tỷ lệ chính xác trung bình của người dùng ở mỗi bài tập (lấy kết quả của lần thử có điểm/tỷ lệ cao nhất).

**Tính năng Tương tác:**
*   Hiển thị và lưu trữ **Số lượt thích (Likes)** dành cho `problem_bank`.
*   Hiển thị và lưu trữ hệ thống **Đánh giá (Ratings)** từ những người dùng đã trải nghiệm bộ bài tập này.