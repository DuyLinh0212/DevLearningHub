# Hướng dẫn FE: Kho quản lý bài tập Code (Problem Bank)

> Tài liệu dành cho team Frontend (Angular 20) tích hợp tính năng **Problem Bank** (mục 2 trong `Notify&Problem_Bank.md`).
> Phần Backend đã hoàn thành (entities, DB, API). FE làm theo tài liệu này.

---

## 1. Tổng quan

**Problem Bank** = một "kho" gom nhiều bài tập code lại để quản lý tập trung. Gồm 3 nhóm tính năng:

- **Người tạo (Creator):** tạo kho (có thể để trống), thêm/gỡ bài tập vào kho, sửa/xóa kho.
- **Thống kê (Người học):** tiến độ hoàn thành `%`, độ chính xác trung bình, danh sách người tham gia.
- **Tương tác:** thích (Like) và đánh giá (Rating 1–5 sao + nhận xét).

> Tiến độ & độ chính xác được Backend **tính động** từ lịch sử nộp bài (`submissions`), FE chỉ cần gọi API và hiển thị.
> Một bài coi là **đã giải** khi user có lần nộp `verdict = "accepted"`.

### Yêu cầu xác thực
- Các API **đọc công khai** (`GET` list / detail / ratings): không bắt buộc đăng nhập. Nếu có gửi token, response sẽ kèm `myLiked` / `myRating`.
- Các API **ghi** và **progress/participants**: cần `Authorization: Bearer <token>` (interceptor hiện có tự gắn).

Tất cả response bọc trong envelope chuẩn:
```ts
interface ApiResponse<T> { success: boolean; message: string; data: T; errors?: any; }
```

---

## 2. Danh sách API

Base path: `/api/problem-banks`

| Method | Endpoint | Quyền | Mô tả |
|--------|----------|-------|-------|
| `GET` | `/api/problem-banks?createdBy={userId?}` | Công khai | List kho (public + kho của mình). Lọc theo người tạo nếu truyền `createdBy` |
| `GET` | `/api/problem-banks/{id}` | Công khai* | Chi tiết kho + danh sách bài tập |
| `POST` | `/api/problem-banks` | Đăng nhập | Tạo kho mới (cho phép rỗng) |
| `PUT` | `/api/problem-banks/{id}` | Chủ kho / `problem:edit` | Sửa thông tin kho |
| `DELETE` | `/api/problem-banks/{id}` | Chủ kho / `problem:edit` | Xóa kho (tự xóa items/likes/ratings) |
| `POST` | `/api/problem-banks/{id}/problems` | Chủ kho | Thêm 1 bài tập vào kho |
| `DELETE` | `/api/problem-banks/{id}/problems/{problemId}` | Chủ kho | Gỡ 1 bài tập khỏi kho |
| `GET` | `/api/problem-banks/{id}/progress` | Đăng nhập | Tiến độ của **user hiện tại** trong kho |
| `GET` | `/api/problem-banks/{id}/participants` | Chủ kho / `problem:edit` | Danh sách người tham gia + % hoàn thành |
| `POST` | `/api/problem-banks/{id}/like` | Đăng nhập | Bật/tắt thích (toggle) |
| `POST` | `/api/problem-banks/{id}/rating` | Đăng nhập | Đặt/cập nhật sao + nhận xét |
| `GET` | `/api/problem-banks/{id}/ratings?page=1&pageSize=20` | Công khai | Danh sách review (phân trang) |

\* Kho `isPublic = false` chỉ chủ kho xem được (trả 403 với người khác).

---

## 3. Kiểu dữ liệu (TypeScript)

```ts
export interface ProblemBankUserSummary {
  id: string; username: string; fullName?: string | null; avatarUrl?: string | null;
}

// Thẻ tóm tắt 1 kho (list)
export interface ProblemBankResponse {
  id: string;
  title: string;
  description?: string | null;
  isPublic: boolean;
  creator: ProblemBankUserSummary;
  problemCount: number;
  likeCount: number;
  avgRating: number;        // 0..5
  ratingCount: number;
  myLiked: boolean;         // theo user hiện tại
  myRating?: number | null; // 1..5 hoặc null
  createdAt: string;
  updatedAt?: string | null;
}

// 1 bài tập trong kho
export interface ProblemBankProblemItem {
  problemId: string; title: string; difficulty: string;
  isActive: boolean; orderIndex: number; addedAt: string;
}

// Chi tiết kho = tóm tắt + danh sách bài
export interface ProblemBankDetailResponse extends ProblemBankResponse {
  problems: ProblemBankProblemItem[];
}

// Tiến độ của user hiện tại
export interface ProblemBankProblemAccuracy {
  problemId: string; title: string; solved: boolean;
  bestAccuracyPercent?: number | null; // 0..100
}
export interface ProblemBankProgressResponse {
  bankId: string;
  totalProblems: number;
  solvedProblems: number;
  completionPercent: number;   // ví dụ 80 nghĩa là 80%
  avgAccuracyPercent: number;  // trung bình độ chính xác tốt nhất các bài đã thử
  problems: ProblemBankProblemAccuracy[];
}

// 1 dòng người tham gia
export interface ProblemBankParticipantResponse {
  user: ProblemBankUserSummary;
  solvedCount: number;
  totalProblems: number;
  completionPercent: number;
  avgAccuracyPercent: number;
}

// 1 review
export interface ProblemBankRatingResponse {
  user: ProblemBankUserSummary;
  rating: number;            // 1..5
  comment?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

// Request bodies
export interface CreateProblemBankRequest { title: string; description?: string; isPublic?: boolean; }
export interface UpdateProblemBankRequest { title: string; description?: string; isPublic?: boolean; }
export interface AddProblemToBankRequest  { problemId: string; orderIndex?: number; }
export interface RateProblemBankRequest   { rating: number; comment?: string; }
```

### Response đặc biệt (không bọc DTO riêng — đọc trong `data`)
- `POST /like` → `{ liked: boolean, likeCount: number }`
- `POST /rating` → `{ myRating: number, avgRating: number, ratingCount: number }`
- `POST /{id}/problems` → `{ added: true }`
- `DELETE /{id}/problems/{problemId}` → `{ removed: true }`
- `DELETE /{id}` → `{ deleted: true }`
- `GET /ratings` → `PagedResponse<ProblemBankRatingResponse>` = `{ items, totalCount, page, pageSize, totalPages }`

---

## 4. Angular Service mẫu (copy-paste được)

`src/app/core/services/problem-bank.service.ts`

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ProblemBankResponse, ProblemBankDetailResponse, ProblemBankProgressResponse,
  ProblemBankParticipantResponse, ProblemBankRatingResponse,
  CreateProblemBankRequest, UpdateProblemBankRequest, AddProblemToBankRequest, RateProblemBankRequest
} from '../models/problem-bank.models';

interface ApiResponse<T> { success: boolean; message: string; data: T; }
interface PagedResponse<T> { items: T[]; totalCount: number; page: number; pageSize: number; totalPages: number; }

@Injectable({ providedIn: 'root' })
export class ProblemBankService {
  private readonly base = '/api/problem-banks';
  constructor(private http: HttpClient) {}

  private data<T>() { return map((r: ApiResponse<T>) => r.data); }

  list(createdBy?: string): Observable<ProblemBankResponse[]> {
    let params = new HttpParams();
    if (createdBy) params = params.set('createdBy', createdBy);
    return this.http.get<ApiResponse<ProblemBankResponse[]>>(this.base, { params }).pipe(this.data());
  }

  get(id: string): Observable<ProblemBankDetailResponse> {
    return this.http.get<ApiResponse<ProblemBankDetailResponse>>(`${this.base}/${id}`).pipe(this.data());
  }

  create(body: CreateProblemBankRequest): Observable<ProblemBankResponse> {
    return this.http.post<ApiResponse<ProblemBankResponse>>(this.base, body).pipe(this.data());
  }
  update(id: string, body: UpdateProblemBankRequest): Observable<ProblemBankResponse> {
    return this.http.put<ApiResponse<ProblemBankResponse>>(`${this.base}/${id}`, body).pipe(this.data());
  }
  remove(id: string) { return this.http.delete<ApiResponse<any>>(`${this.base}/${id}`); }

  addProblem(id: string, body: AddProblemToBankRequest) {
    return this.http.post<ApiResponse<any>>(`${this.base}/${id}/problems`, body);
  }
  removeProblem(id: string, problemId: string) {
    return this.http.delete<ApiResponse<any>>(`${this.base}/${id}/problems/${problemId}`);
  }

  myProgress(id: string): Observable<ProblemBankProgressResponse> {
    return this.http.get<ApiResponse<ProblemBankProgressResponse>>(`${this.base}/${id}/progress`).pipe(this.data());
  }
  participants(id: string): Observable<ProblemBankParticipantResponse[]> {
    return this.http.get<ApiResponse<ProblemBankParticipantResponse[]>>(`${this.base}/${id}/participants`).pipe(this.data());
  }

  toggleLike(id: string): Observable<{ liked: boolean; likeCount: number }> {
    return this.http.post<ApiResponse<{ liked: boolean; likeCount: number }>>(`${this.base}/${id}/like`, {}).pipe(this.data());
  }
  rate(id: string, body: RateProblemBankRequest): Observable<{ myRating: number; avgRating: number; ratingCount: number }> {
    return this.http.post<ApiResponse<any>>(`${this.base}/${id}/rating`, body).pipe(this.data());
  }
  ratings(id: string, page = 1, pageSize = 20): Observable<PagedResponse<ProblemBankRatingResponse>> {
    return this.http.get<ApiResponse<PagedResponse<ProblemBankRatingResponse>>>(
      `${this.base}/${id}/ratings?page=${page}&pageSize=${pageSize}`).pipe(this.data());
  }
}
```

---

## 5. Gợi ý UI

### Trang danh sách kho
- Card mỗi kho: `title`, `creator.fullName`, `problemCount` bài, ❤️ `likeCount`, ⭐ `avgRating` (`ratingCount` lượt).
- Nút tạo kho (mở form `CreateProblemBankRequest`).

### Trang chi tiết kho
- Header: tiêu đề, mô tả, người tạo, nút **Like** (đổi theo `myLiked`), khối **Rating** (chọn 1–5 sao + ô nhận xét, prefill `myRating`).
- **Thanh tiến độ**: gọi `myProgress(id)` → hiển thị `completionPercent%` (ví dụ "4/5 bài — 80%") và `avgAccuracyPercent`.
- Danh sách bài tập (`problems[]`): mỗi dòng có badge `solved` (lấy từ `progress.problems`), link tới trang giải bài `/playground/problem/{problemId}`.
- Nếu là **chủ kho**: nút thêm bài (`addProblem`), gỡ bài (`removeProblem`), tab **Người tham gia** (`participants`) hiển thị bảng xếp hạng `completionPercent` / `avgAccuracyPercent`.

### Ví dụ thanh tiến độ (component nhỏ)
```ts
this.bankService.myProgress(bankId).subscribe(p => {
  this.percent = p.completionPercent;          // ví dụ 80
  this.label = `${p.solvedProblems}/${p.totalProblems} bài — ${p.completionPercent}%`;
  this.accuracy = p.avgAccuracyPercent;        // độ chính xác TB
});
```

### Like & Rating
```ts
like(id: string) {
  this.bankService.toggleLike(id).subscribe(r => { this.myLiked = r.liked; this.likeCount = r.likeCount; });
}
submitRating(id: string, stars: number, comment: string) {
  this.bankService.rate(id, { rating: stars, comment }).subscribe(r => {
    this.avgRating = r.avgRating; this.ratingCount = r.ratingCount; this.myRating = r.myRating;
  });
}
```

---

## 6. Lưu ý & quy tắc nghiệp vụ

- **Tạo kho rỗng**: `POST /` chỉ cần `title`; bài tập thêm sau qua `POST /{id}/problems`.
- **Thêm bài đã có trong kho** → 400 `"Problem is already in this bank."` (FE nên disable bài đã thêm).
- **Quyền quản lý**: chỉ **chủ kho** (hoặc tài khoản có quyền `problem:edit` — Admin/Moderator) mới sửa/xóa/thêm/gỡ bài và xem **participants**. FE nên ẩn các nút này nếu `creator.id !== currentUserId` và user không phải admin/mod.
- **Rating**: mỗi user 1 đánh giá/kho, gọi lại `POST /rating` sẽ **ghi đè** (cập nhật sao + nhận xét). `comment` tối đa 500 ký tự.
- **Like**: `POST /like` là **toggle** (gọi lần nữa để bỏ thích).
- **Kho riêng tư** (`isPublic=false`): không hiện trong list của người khác; mở chi tiết trả 403.
- **camelCase**: toàn bộ JSON theo camelCase, khớp interface ở trên.
- **Không cần SignalR** cho tính năng này (khác Phần 1) — chỉ REST.

---

## 7. Checklist FE

- [ ] Thêm file models (`problem-bank.models.ts`) theo mục 3.
- [ ] Thêm `ProblemBankService` theo mục 4.
- [ ] Màn danh sách kho + form tạo kho.
- [ ] Màn chi tiết: danh sách bài, thanh tiến độ (`progress`), Like, Rating + danh sách review (`ratings`).
- [ ] Khu vực quản lý cho chủ kho: thêm/gỡ bài, tab Người tham gia (`participants`).
- [ ] Ẩn/hiện nút quản lý theo quyền (chủ kho hoặc admin/mod).
