import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationService, NotificationItem } from '../../core/services/notification.service';

type SettingsTab = 'profile' | 'security' | 'notifications' | 'appearance' | 'privacy';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  public notificationService = inject(NotificationService);

  firstName: string = '';
  lastName: string = '';
  email: string = '';
  role: string = 'Người dùng';
  avatarUrl: string = '';
  xpPoints: number = 0;
  isSaving: boolean = false;
  isUploadingAvatar: boolean = false;

  activeTab: SettingsTab = 'profile';

  notifications: NotificationItem[] = [];
  selectedNotif: NotificationItem | null = null;
  notifLoading = false;
  notifError = false;
  notifPage = 1;
  notifTotalPages = 1;
  private notifLoaded = false;
  private notifRealtimeSub?: Subscription;

  ngOnInit() {
    this.loadUserProfile();
    this.notifRealtimeSub = this.notificationService.newNotification$.subscribe(notif => {
      this.notifications = [notif, ...this.notifications.filter(existing => existing.id !== notif.id)];
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.notifRealtimeSub?.unsubscribe();
  }

  setTab(tab: SettingsTab) {
    this.activeTab = tab;
    if (tab === 'notifications' && !this.notifLoaded) {
      this.loadNotifications(1);
    }
  }

  loadNotifications(page = 1) {
    this.notifLoading = true;
    this.notifError = false;
    this.notifLoaded = true;
    this.notificationService.getNotifications(page, 20).subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.notifications = data?.items || [];
        this.selectedNotif = null;
        this.notifPage = data?.page ?? page;
        this.notifTotalPages = data?.totalPages ?? 1;
        this.notificationService.unreadCount.set(data?.unreadCount ?? 0);
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Settings] Failed to load notifications:', err);
        this.notifications = [];
        this.notifLoading = false;
        this.notifError = true;
        this.cdr.detectChanges();
      }
    });
  }

  goToNotifPage(page: number) {
    if (page < 1 || page > this.notifTotalPages || page === this.notifPage) return;
    this.loadNotifications(page);
  }

  openNotifDetail(notif: NotificationItem) {
    this.selectedNotif = this.selectedNotif?.id === notif.id ? null : notif;

    if (!notif.isRead) {
      this.notificationService.markAsRead(notif.id).subscribe({
        next: () => {
          notif.isRead = true;
          this.cdr.detectChanges();
        }
      });
    }

    this.cdr.detectChanges();
  }

  markAllNotifRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
        this.selectedNotif = null;
        this.cdr.detectChanges();
      }
    });
  }

  deleteNotif(notif: NotificationItem, event: Event) {
    event.stopPropagation();
    this.notificationService.deleteNotification(notif.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notif.id);
        if (this.selectedNotif?.id === notif.id) this.selectedNotif = null;
        this.cdr.detectChanges();
      }
    });
  }

  canOpenNotifTarget(notif: NotificationItem): boolean {
    return !!this.getNotifRoute(notif);
  }

  openNotifTarget(notif: NotificationItem, event: Event) {
    event.stopPropagation();
    const commands = this.getNotifRoute(notif);
    if (!commands) return;
    this.router.navigate(commands);
  }

  private getNotifRoute(notif: NotificationItem): any[] | null {
    if (!notif.refId || !notif.refType) return null;

    switch (notif.refType.toLowerCase()) {
      case 'post':
      case 'comment':
        return ['/forum/post', notif.refId];
      case 'problem':
        return ['/code', notif.refId];
      case 'quiz_set':
        return ['/quiz', notif.refId];
      case 'question':
        return ['/quiz-create'];
      default:
        return null;
    }
  }

  getNotifIcon(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'comment': return 'bi-chat-left-text';
      case 'comment_reply': return 'bi-chat-left-text';
      case 'post_comment': return 'bi-chat-left-text';
      case 'content_reported': return 'bi-flag-fill';
      case 'post_deleted': return 'bi-trash-fill';
      case 'comment_deleted': return 'bi-trash-fill';
      case 'quiz_deleted': return 'bi-journal-x';
      case 'problem_deleted': return 'bi-code-square';
      case 'content_approved': return 'bi-check-circle-fill';
      case 'content_rejected': return 'bi-x-circle-fill';
      case 'like': return 'bi-heart-fill';
      case 'follow': return 'bi-person-plus-fill';
      case 'submission': return 'bi-code-slash';
      case 'achievement': return 'bi-trophy-fill';
      default: return 'bi-bell-fill';
    }
  }

  getRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
  }

  loadUserProfile() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) return;

        this.email = user.email || '';
        this.avatarUrl = user.avatarUrl || '';
        this.xpPoints = user.xpPoints || 0;
        this.loadUserStats(user.id);

        const rawRoles = user.roles || [];
        let isAdmin = rawRoles.some((r: string) => r.toLowerCase() === 'admin') || user.role?.toLowerCase() === 'admin';

        if (!isAdmin) {
          try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
            if (token) {
              const payloadPart = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
              const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

              if (Array.isArray(roleClaim)) {
                isAdmin = roleClaim.map((r: string) => r.toLowerCase()).includes('admin');
              } else if (roleClaim) {
                isAdmin = roleClaim.toLowerCase() === 'admin';
              }
            }
          } catch (tokenError) {
            console.error('Không thể đọc role từ token:', tokenError);
          }
        }

        this.role = isAdmin ? 'Quản trị viên' : 'Học viên';

        if (user.fullName) {
          const fullName = user.fullName.trim();
          const nameParts = fullName.split(' ');
          this.firstName = nameParts.pop() || '';
          this.lastName = nameParts.join(' ');
        } else {
          this.firstName = user.username || '';
          this.lastName = '';
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Không thể tải hồ sơ người dùng:', err);
        this.role = 'Học viên';
        this.cdr.detectChanges();
      }
    });
  }

  private loadUserStats(userId: string) {
    if (!userId) return;

    this.http.get<any>(`/api/users/${userId}/stats`).subscribe({
      next: (res) => {
        const stats = res?.data || res;
        this.xpPoints = stats?.totalXP ?? this.xpPoints;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;

    const combinedFullName = `${this.lastName.trim()} ${this.firstName.trim()}`.trim();
    const updatePayload = {
      fullName: combinedFullName,
      avatarUrl: this.avatarUrl
    };

    this.http.put<any>('/api/users/me', updatePayload).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Cập nhật hồ sơ thành công!');
        window.dispatchEvent(new Event('profile-updated'));
        this.loadUserProfile();
      },
      error: (err) => {
        this.isSaving = false;
        alert(`Lưu thất bại! (Mã lỗi: ${err.status})`);
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.isUploadingAvatar) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn đúng file ảnh!');
      input.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh không được vượt quá 5MB!');
      input.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    this.isUploadingAvatar = true;

    this.http.post<any>('/api/users/me/avatar', formData).subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.avatarUrl = user?.avatarUrl || '';
        this.isUploadingAvatar = false;
        input.value = '';
        window.dispatchEvent(new Event('profile-updated'));
        alert('Cập nhật ảnh đại diện thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        const message = err?.error?.message || `Upload ảnh thất bại! (Mã lỗi: ${err.status})`;
        alert(message);
        this.isUploadingAvatar = false;
        input.value = '';
        this.cdr.detectChanges();
      }
    });
  }
}
