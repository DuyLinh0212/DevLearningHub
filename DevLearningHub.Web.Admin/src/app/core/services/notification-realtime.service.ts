import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';

export interface NotificationItem {
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

  readonly received$ = new Subject<NotificationItem>();
  readonly moderationQueueChanged$ = new Subject<string>();
  readonly unreadCount = signal(0);

  connect(): void {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.ensureConnected(token);
  }

  disconnect(): void {
    this.connection?.stop().catch(() => {});
    this.connection = undefined;
    this.unreadCount.set(0);
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
        this.received$.next({
          id: notif.id,
          type: notif.type,
          message: notif.message,
          refId: notif.refId ?? null,
          refType: notif.refType ?? null,
          isRead: notif.isRead ?? false,
          createdAt: notif.createdAt
        });
      });

      this.connection.on('UnreadCountChanged', (count: number) => {
        this.unreadCount.set(count);
      });

      this.connection.on('ModerationQueueChanged', (type: string) => {
        this.moderationQueueChanged$.next(type);
      });
    }

    if (!this.starting) {
      this.starting = this.connection.start()
        .catch(err => console.warn('[SignalR/notifications] realtime disabled:', err?.message ?? err))
        .finally(() => { this.starting = undefined; });
    }
  }
}
