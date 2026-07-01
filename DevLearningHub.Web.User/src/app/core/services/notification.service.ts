import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import * as signalR from '@microsoft/signalr';

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  refId: string | null;
  refType: string | null;
  isRead: boolean;
  createdAt: string;
  reporterName?: string | null;
  reportDescription?: string | null;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  totalCount: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private http = inject(HttpClient);

  unreadCount = signal(0);

  // Emits each realtime notification pushed over SignalR.
  readonly newNotification$ = new Subject<NotificationItem>();

  private connection?: signalR.HubConnection;
  private starting?: Promise<void>;

  // Call once after login (or on app init when a token is present).
  connectRealtime(): void {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.ensureConnected(token);
  }

  disconnectRealtime(): void {
    if (this.connection) {
      this.connection.stop().catch(() => {});
      this.connection = undefined;
    }
  }

  private ensureConnected(token: string): void {
    if (this.connection?.state === signalR.HubConnectionState.Connected) return;

    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl(`/hubs/notifications?access_token=${encodeURIComponent(token)}`)
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.None)
        .build();

      this.connection.on('ReceiveNotification', (notif: any) => {
        const item: NotificationItem = {
          id: notif.id,
          type: notif.type,
          message: notif.message,
          refId: notif.refId ?? null,
          refType: notif.refType ?? null,
          isRead: notif.isRead ?? false,
          createdAt: notif.createdAt,
          reporterName: notif.reporterName ?? null,
          reportDescription: notif.reportDescription ?? null
        };
        this.newNotification$.next(item);
        // Bump badge without waiting for UnreadCountChanged
        this.unreadCount.update(c => c + 1);
      });

      this.connection.on('UnreadCountChanged', (count: number) => {
        this.unreadCount.set(count);
      });
    }

    if (!this.starting) {
      this.starting = this.connection.start()
        .catch(err => console.warn('[SignalR/notifications] realtime disabled:', err?.message ?? err))
        .finally(() => { this.starting = undefined; });
    }
  }

  loadUnreadCount(): void {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/notifications/unread-count').subscribe({
      next: (res) => {
        const count = res?.data?.unreadCount ?? res?.unreadCount ?? 0;
        this.unreadCount.set(count);
      },
      error: () => {}
    });
  }

  getNotifications(page = 1, pageSize = 20, unreadOnly = false): Observable<any> {
    return this.http.get<any>('/api/notifications', {
      params: { page: String(page), pageSize: String(pageSize), unreadOnly: String(unreadOnly) }
    });
  }

  markAsRead(id: string): Observable<any> {
    return this.http.post<any>(`/api/notifications/${id}/read`, {}).pipe(
      tap((res) => {
        const count = res?.data?.unreadCount ?? 0;
        this.unreadCount.set(count);
      })
    );
  }

  markAllAsRead(): Observable<any> {
    return this.http.post<any>('/api/notifications/read-all', {}).pipe(
      tap(() => this.unreadCount.set(0))
    );
  }

  clearAllNotifications(): Observable<any> {
    return this.http.delete<any>('/api/notifications/clear-all').pipe(
      tap(() => this.unreadCount.set(0))
    );
  }

  deleteNotification(id: string): Observable<any> {
    return this.http.delete<any>(`/api/notifications/${id}`).pipe(
      tap((res) => {
        const count = res?.data?.unreadCount ?? 0;
        this.unreadCount.set(count);
      })
    );
  }
}
