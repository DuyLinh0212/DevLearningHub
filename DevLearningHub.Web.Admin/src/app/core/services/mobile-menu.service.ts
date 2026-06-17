import { Injectable, signal } from '@angular/core';

/**
 * Service dùng chung để điều khiển trạng thái đóng/mở Sidebar trên Mobile.
 * Thay vì mỗi page phải truyền @Input/@Output qua lại với SidebarComponent,
 * chỉ cần inject service này và gọi toggle() từ bất kỳ đâu.
 */
@Injectable({
  providedIn: 'root'
})
export class MobileMenuService {
  /** Signal lưu trạng thái sidebar: true = đang mở, false = đang đóng */
  readonly isOpen = signal(false);

  /** Bật/tắt sidebar */
  toggle() {
    this.isOpen.update(v => !v);
  }

  /** Mở sidebar */
  open() {
    this.isOpen.set(true);
  }

  /** Đóng sidebar */
  close() {
    this.isOpen.set(false);
  }
}
