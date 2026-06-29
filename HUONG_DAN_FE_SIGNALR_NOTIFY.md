# Hướng dẫn FE: Tích hợp Thông báo thời gian thực (SignalR)

> Tài liệu dành cho team Frontend (Angular 20) để tích hợp hệ thống **thông báo realtime** đã được triển khai ở Backend (Phần 1 trong `Notify&Problem_Bank.md`).
> Phần API đã hoàn thành — FE chỉ cần làm theo tài liệu này.

---

## 1. Tổng quan

Backend đẩy thông báo cá nhân cho từng user qua **SignalR** trong 5 sự kiện:

| # | Sự kiện | `type` | Người nhận thông báo |
|---|---------|--------|----------------------|
| 1 | Có người **trả lời (reply)** bình luận | `comment_reply` | Tác giả bình luận gốc |
| 2 | **Bài viết (Post)** bị xóa | `post_deleted` | Tác giả bài viết |
| 3 | **Bình luận (Comment)** bị xóa | `comment_deleted` | Tác giả bình luận |
| 4 | **Bộ đề (Quiz)** bị xóa | `quiz_deleted` | Người tạo bộ đề |
| 5 | **Bài tập Code** bị xóa | `problem_deleted` | Người tạo bài tập |

Mỗi thông báo vừa được **lưu vào DB** (xem được cả khi offline) vừa được **đẩy realtime** nếu user đang online. Người thực hiện hành động **không** tự nhận thông báo về hành động của chính mình (ví dụ tự xóa bài của mình thì không có thông báo).

Có 2 kênh FE cần dùng:
- **SignalR Hub** (`/hubs/notifications`): nhận thông báo realtime + số chưa đọc.
- **REST API** (`/api/notifications`): tải lịch sử, đếm số chưa đọc, đánh dấu đã đọc.

---

## 2. Kết nối SignalR Hub

### Endpoint
```
/hubs/notifications
```
(qua proxy `proxy.conf.json` giống `/hubs/comments` đang dùng. Khi gọi thẳng API thì là `http://localhost:5000/hubs/notifications`.)

### Xác thực — BẮT BUỘC
Hub này yêu cầu đăng nhập (`[Authorize]`). Trình duyệt không gắn được header `Authorization` vào WebSocket, nên **phải truyền JWT qua `accessTokenFactory`**. SignalR sẽ tự thêm token vào query string `?access_token=...` và Backend đã được cấu hình để đọc nó.

```ts
.withUrl('/hubs/notifications', {
  accessTokenFactory: () => localStorage.getItem('accessToken') ?? ''
})
```

> Token được lưu ở `localStorage['accessToken']` (giống `auth.interceptor.ts`).

### Các sự kiện server → client

| Tên sự kiện | Payload | Ý nghĩa |
|-------------|---------|---------|
| `ReceiveNotification` | `NotificationResponse` | Có 1 thông báo mới |
| `UnreadCountChanged` | `number` | Tổng số thông báo chưa đọc mới nhất (để cập nhật badge chuông) |

### Payload `NotificationResponse`
```ts
export interface NotificationResponse {
  id: string;            // Guid
  type: string;          // 'comment_reply' | 'post_deleted' | 'comment_deleted' | 'quiz_deleted' | 'problem_deleted'
  message: string;       // Nội dung hiển thị (tiếng Việt, đã render sẵn)
  refId: string | null;  // Guid của đối tượng liên quan để điều hướng
  refType: string | null;// 'post' | 'quiz_set' | 'problem'
  isRead: boolean;
  createdAt: string;     // ISO datetime
}
```

### Quy ước điều hướng khi click vào thông báo
Dựa vào `refType` + `refId`:

| `refType` | Điều hướng gợi ý |
|-----------|------------------|
| `post` | `/forum/post/{refId}` (dùng cho `comment_reply`, `post_deleted`, `comment_deleted`) |
| `quiz_set` | `/quiz/{refId}` (lưu ý: với `quiz_deleted` thì bộ đề đã bị xóa — chỉ nên hiển thị thông báo, không điều hướng) |
| `problem` | `/playground/problem/{refId}` (với `problem_deleted` thì bài đã bị xóa) |

> Với các loại `*_deleted`, đối tượng đã bị xóa nên thường chỉ hiển thị message, không cần điều hướng. Với `comment_reply` thì điều hướng tới post để xem câu trả lời.

---

## 3. REST API thông báo

Tất cả endpoint đều cần `Authorization: Bearer <token>` (interceptor hiện có tự gắn). Response bọc trong envelope chuẩn `ApiResponse<T>`:
```ts
interface ApiResponse<T> { success: boolean; message: string; data: T; errors?: any; }
```

| Method | Endpoint | Mô tả | Trả về (`data`) |
|--------|----------|-------|-----------------|
| `GET` | `/api/notifications?page=1&pageSize=20&unreadOnly=false` | Danh sách thông báo (mới nhất trước) | `NotificationListResponse` |
| `GET` | `/api/notifications/unread-count` | Số chưa đọc (seed badge lúc tải trang) | `{ unreadCount: number }` |
| `POST` | `/api/notifications/{id}/read` | Đánh dấu 1 thông báo đã đọc | `{ id, isRead: true, unreadCount }` |
| `POST` | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc | `{ updated, unreadCount: 0 }` |
| `DELETE` | `/api/notifications/{id}` | Xóa 1 thông báo | `{ deleted: true, unreadCount }` |

### `NotificationListResponse`
```ts
export interface NotificationListResponse {
  items: NotificationResponse[];
  totalCount: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

---

## 4. Service Angular mẫu (copy-paste được)

`src/app/core/services/notification-realtime.service.ts`

```ts
import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';

export interface NotificationResponse {
  id: string;
  type: string;
  message: string;
  refId: string | null;
  refType: string | null;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationRealtimeService {
  private connection?: signalR.HubConnection;
  private starting?: Promise<void>;

  /** Thông báo mới nhận realtime. Component subscribe để chèn vào đầu danh sách. */
  readonly received$ = new Subject<NotificationResponse>();

  /** Số chưa đọc — dùng signal để bind thẳng vào badge chuông. */
  readonly unreadCount = signal(0);

  /** Gọi 1 lần sau khi đăng nhập thành công (ví dụ trong APP_INITIALIZER hoặc layout chính). */
  async connect(): Promise<void> {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken');
    if (!token) return; // chưa đăng nhập thì không kết nối

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/notifications', {
          accessTokenFactory: () => localStorage.getItem('accessToken') ?? ''
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.None)
        .build();

      this.connection.on('ReceiveNotification', (n: NotificationResponse) => {
        this.received$.next(n);
      });
      this.connection.on('UnreadCountChanged', (count: number) => {
        this.unreadCount.set(count);
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Connected) return;

    if (!this.starting) {
      this.starting = this.connection.start()
        .catch(err => console.warn('[SignalR] Notifications disabled:', err?.message ?? err))
        .finally(() => { this.starting = undefined; });
    }
    await this.starting;
  }

  /** Gọi khi logout để ngắt kết nối. */
  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = undefined;
    this.unreadCount.set(0);
  }
}
```

`src/app/core/services/notification-api.service.ts` (gọi REST)

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { NotificationResponse } from './notification-realtime.service';

interface ApiResponse<T> { success: boolean; message: string; data: T; }
export interface NotificationListResponse {
  items: NotificationResponse[];
  totalCount: number; unreadCount: number;
  page: number; pageSize: number; totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly base = '/api/notifications';
  constructor(private http: HttpClient) {}

  list(page = 1, pageSize = 20, unreadOnly = false): Observable<NotificationListResponse> {
    return this.http
      .get<ApiResponse<NotificationListResponse>>(
        `${this.base}?page=${page}&pageSize=${pageSize}&unreadOnly=${unreadOnly}`)
      .pipe(map(r => r.data));
  }

  unreadCount(): Observable<number> {
    return this.http
      .get<ApiResponse<{ unreadCount: number }>>(`${this.base}/unread-count`)
      .pipe(map(r => r.data.unreadCount));
  }

  markRead(id: string)  { return this.http.post<ApiResponse<any>>(`${this.base}/${id}/read`, {}); }
  markAllRead()         { return this.http.post<ApiResponse<any>>(`${this.base}/read-all`, {}); }
  remove(id: string)    { return this.http.delete<ApiResponse<any>>(`${this.base}/${id}`); }
}
```

---

## 5. Ví dụ component chuông thông báo

```ts
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationRealtimeService, NotificationResponse } from '../../core/services/notification-realtime.service';
import { NotificationApiService } from '../../core/services/notification-api.service';

@Component({ selector: 'app-notification-bell', /* standalone, template... */ })
export class NotificationBellComponent implements OnInit {
  private realtime = inject(NotificationRealtimeService);
  private api = inject(NotificationApiService);
  private router = inject(Router);

  items: NotificationResponse[] = [];
  unread = this.realtime.unreadCount; // signal

  async ngOnInit() {
    // 1) Seed lịch sử + số chưa đọc khi tải trang
    const data = await this.api.list(1, 20).toPromise();
    this.items = data?.items ?? [];
    this.realtime.unreadCount.set(data?.unreadCount ?? 0);

    // 2) Mở kết nối realtime
    await this.realtime.connect();

    // 3) Lắng nghe thông báo mới
    this.realtime.received$.subscribe(n => this.items.unshift(n));
  }

  open(n: NotificationResponse) {
    if (!n.isRead) {
      this.api.markRead(n.id).subscribe();
      n.isRead = true;
    }
    // Điều hướng theo refType (bỏ qua với các loại *_deleted nếu muốn)
    if (n.refType === 'post' && n.refId) {
      this.router.navigate(['/forum/post', n.refId]);
    }
  }

  markAll() {
    this.api.markAllRead().subscribe(() => {
      this.items.forEach(i => i.isRead = true);
      this.realtime.unreadCount.set(0);
    });
  }
}
```

---

## 6. Việc cần làm (checklist FE)

- [ ] **Web.User**: `@microsoft/signalr` đã có sẵn trong `package.json` — không cần cài thêm.
- [ ] **Web.Admin**: nếu muốn hiển thị thông báo cho moderator/admin, cần cài: `npm i @microsoft/signalr` (hiện chưa có).
- [ ] Tạo 2 service (`notification-realtime.service.ts`, `notification-api.service.ts`) như mục 4.
- [ ] Thêm component chuông vào topbar/header, bind `unreadCount` (signal) vào badge.
- [ ] Gọi `realtime.connect()` **sau khi đăng nhập thành công** và `realtime.disconnect()` **khi logout**.
- [x] `proxy.conf.json` (Web.User) **đã** proxy `/hubs` với `"ws": true` sẵn — không cần sửa. `/hubs/notifications` sẽ chạy qua cấu hình này. (Nếu thêm thông báo cho **Web.Admin**, kiểm tra `proxy.conf.json` của Admin có block tương tự với `"ws": true` không, chưa có thì thêm vào.)
  ```json
  // proxy.conf.json hiện tại của Web.User (đã đúng)
  "/hubs": { "target": "<backend>", "secure": false, "changeOrigin": true, "ws": true }
  ```
- [ ] Test: mở 2 tài khoản; tài khoản A reply bình luận của B → B thấy thông báo ngay; admin xóa bài của B → B nhận thông báo.

---

## 7. Lưu ý kỹ thuật

- **Payload là camelCase** (Backend đã cấu hình `JsonNamingPolicy.CamelCase` cho SignalR), khớp với REST response — dùng trực tiếp không cần map.
- **Tự thông báo bị bỏ qua**: nếu A tự xóa bài của A thì A không nhận thông báo (đây là hành vi đúng theo thiết kế).
- **Offline vẫn nhận được**: thông báo luôn được lưu DB, nên user offline khi quay lại gọi `GET /api/notifications` sẽ thấy đầy đủ.
- **`UnreadCountChanged`** được đẩy kèm mỗi thông báo mới → không cần tự cộng dồn ở FE, chỉ cần `set` theo giá trị server gửi.
- **Reconnect**: `withAutomaticReconnect()` tự kết nối lại; sau khi mất kết nối nên gọi lại `GET /api/notifications` để đồng bộ những gì bỏ lỡ.
- **Token hết hạn**: nếu refresh token đổi `accessToken`, lần kết nối/reconnect sau `accessTokenFactory` sẽ tự lấy token mới từ `localStorage`.
