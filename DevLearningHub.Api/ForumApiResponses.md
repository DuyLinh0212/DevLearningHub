# Forum & Community API — Mô tả Response (cho Frontend)

Tài liệu mô tả dữ liệu trả về của 18 endpoint module Forum & Community (STT 48–65),
giúp FE biết chính xác cấu trúc `data` để render.

## Envelope chung

Mọi response đều bọc trong `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Success",
  "data": null,
  "errors": null
}
```

- `success`: `true` khi thành công, `false` khi lỗi.
- `message`: thông báo ngắn cho client.
- `data`: phần dữ liệu chính (mô tả bên dưới).
- `errors`: chi tiết lỗi nếu có.

## Các shape dùng lại

```jsonc
// Author — nhúng trong post & comment
Author {
  id: string (guid),
  username: string,
  fullName: string | null,
  avatarUrl: string | null
}

// Tag
Tag {
  id: string (guid),
  name: string,
  slug: string,
  colorHex: string   // ví dụ "#5c2d91"
}

// PostSummary — item trong danh sách feed
PostSummary {
  id: string (guid),
  title: string,
  author: Author,
  upvotes: number,
  downvotes: number,
  viewCount: number,
  commentCount: number,
  isHidden: boolean,
  createdAt: string (ISO datetime),
  updatedAt: string (ISO datetime),
  tags: Tag[]
}

// PostDetail = PostSummary + các field sau
PostDetail {
  ...PostSummary,
  bodyMarkdown: string,
  imageUrl: string | null,
  acceptedCommentId: string (guid) | null,
  myVote: "up" | "down" | null   // vote hiện tại của user đang đăng nhập
}

// Comment — đệ quy qua replies
Comment {
  id: string (guid),
  postId: string (guid),
  parentId: string (guid) | null,
  author: Author,
  bodyMarkdown: string,
  upvotes: number,
  downvotes: number,
  isAccepted: boolean,
  isHidden: boolean,
  createdAt: string (ISO datetime),
  updatedAt: string (ISO datetime),
  replies: Comment[]
}

// PagedResponse<T>
PagedResponse<T> {
  items: T[],
  totalCount: number,
  page: number,
  pageSize: number,
  totalPages: number
}

// VoteResult
VoteResult {
  upvotes: number,
  downvotes: number,
  myVote: "up" | "down" | null
}
```

## Response từng endpoint

| STT | Method | Endpoint | `data` trả về | Ghi chú cho FE |
| :--- | :--- | :--- | :--- | :--- |
| 48 | GET | /api/posts | `PagedResponse<PostSummary>` | Render feed + phân trang. `tags` có sẵn để hiển thị chip |
| 49 | POST | /api/posts | `PostDetail` | Bài vừa tạo; `upvotes/downvotes/viewCount = 0`, `myVote = null` |
| 50 | GET | /api/posts/{id} | `PostDetail` | `viewCount` đã +1; `myVote` cho biết user đã vote chưa; `acceptedCommentId` để highlight best answer |
| 51 | PUT | /api/posts/{id} | `PostDetail` | Bài sau khi cập nhật |
| 52 | DELETE | /api/posts/{id} | `{ deleted: true }` | Xóa xong, FE gỡ khỏi list |
| 53 | POST | /api/posts/{id}/vote | `VoteResult` | Cập nhật ngay số upvote/downvote + trạng thái nút vote (`myVote`) |
| 54 | GET | /api/posts/{id}/comments | `Comment[]` (cây lồng nhau) | Đệ quy theo `replies`; comment ẩn đã bị loại |
| 55 | POST | /api/posts/{id}/comments | `Comment` | Comment/reply vừa tạo (`replies = []`); dùng `parentId` để chèn đúng nhánh |
| 56 | PUT | /api/comments/{id} | `Comment` | Comment sau khi sửa |
| 57 | DELETE | /api/comments/{id} | `{ deleted: true, count: N }` | `count` = số comment bị xóa (gồm reply con) |
| 58 | POST | /api/comments/{id}/vote | `VoteResult` | Như vote post |
| 59 | POST | /api/comments/{id}/accept | `{ commentId, isAccepted }` | `isAccepted = true` → đánh dấu best answer; `false` → đã bỏ đánh dấu |
| 60 | GET | /api/tags | `Tag[]` | Danh sách tag cho dropdown/filter |
| 61 | POST | /api/tags | `Tag` | Tag vừa tạo (có `slug` tự sinh) |
| 62 | PUT | /api/tags/{id} | `Tag` | Tag sau khi sửa |
| 63 | DELETE | /api/tags/{id} | `{ deleted: true }` | |
| 64 | POST | /api/posts/{id}/moderate | `{ id, isHidden }` | `isHidden` là trạng thái mới sau khi ẩn/bỏ ẩn |
| 65 | POST | /api/comments/{id}/moderate | `{ id, isHidden }` | |

## Ví dụ response cụ thể

### 48 — GET /api/posts

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "1f2e...",
        "title": "Làm sao tối ưu EF Core?",
        "author": {
          "id": "a000...",
          "username": "admin",
          "fullName": "System Admin",
          "avatarUrl": null
        },
        "upvotes": 3,
        "downvotes": 0,
        "viewCount": 12,
        "commentCount": 2,
        "isHidden": false,
        "createdAt": "2026-06-12T08:30:00Z",
        "updatedAt": "2026-06-12T08:30:00Z",
        "tags": [
          { "id": "b000...", "name": "ASP.NET Core", "slug": "aspnet-core", "colorHex": "#5c2d91" }
        ]
      }
    ],
    "totalCount": 1,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  },
  "errors": null
}
```

### 54 — GET /api/posts/{id}/comments (cây lồng nhau)

```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "c001...",
      "postId": "1f2e...",
      "parentId": null,
      "author": { "id": "u001...", "username": "linh", "fullName": null, "avatarUrl": null },
      "bodyMarkdown": "Bạn thử dùng AsNoTracking()",
      "upvotes": 1,
      "downvotes": 0,
      "isAccepted": true,
      "isHidden": false,
      "createdAt": "2026-06-12T09:00:00Z",
      "updatedAt": "2026-06-12T09:00:00Z",
      "replies": [
        {
          "id": "c002...",
          "postId": "1f2e...",
          "parentId": "c001...",
          "author": { "id": "u002...", "username": "nam", "fullName": null, "avatarUrl": null },
          "bodyMarkdown": "Chuẩn luôn, cảm ơn!",
          "upvotes": 0,
          "downvotes": 0,
          "isAccepted": false,
          "isHidden": false,
          "createdAt": "2026-06-12T09:05:00Z",
          "updatedAt": "2026-06-12T09:05:00Z",
          "replies": []
        }
      ]
    }
  ],
  "errors": null
}
```

### 53 / 58 — Vote

```json
{
  "success": true,
  "message": "Success",
  "data": { "upvotes": 4, "downvotes": 0, "myVote": "up" },
  "errors": null
}
```

## Trường hợp lỗi

Khi lỗi: `success = false`, `data = null`, `message` là mô tả ngắn.

| HTTP | Khi nào | `message` ví dụ |
| :--- | :--- | :--- |
| 400 | Sai input | `"voteType must be 'up' or 'down'."`, `"Title and body are required."` |
| 401 | Chưa đăng nhập / token hết hạn | `"Unauthorized."` |
| 403 | Không đủ quyền / nội dung bị ẩn | `"Forbidden."`, `"Only the post author can accept an answer."` |
| 404 | Không tìm thấy | `"Post not found."`, `"Comment not found."` |
| 409 | Trùng dữ liệu | `"A tag with the same name or slug already exists."` |

Ví dụ:

```json
{
  "success": false,
  "message": "Post not found.",
  "data": null,
  "errors": null
}
```
