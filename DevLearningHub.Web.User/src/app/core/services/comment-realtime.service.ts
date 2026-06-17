import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';

// Shape broadcast by the API when a comment subtree is deleted.
export interface CommentDeletedEvent {
  postId: string;
  commentId: string;
  deletedIds: string[];
}

// Thin wrapper around the SignalR connection dedicated to forum comments.
// It keeps a single shared connection and lets a component join/leave the
// group for the post it is currently viewing.
@Injectable({ providedIn: 'root' })
export class CommentRealtimeService {
  private connection?: signalR.HubConnection;
  private currentPostId?: string;
  private starting?: Promise<void>;

  // Components subscribe to these to react to realtime comment changes.
  readonly commentCreated$ = new Subject<any>();
  readonly commentUpdated$ = new Subject<any>();
  readonly commentDeleted$ = new Subject<CommentDeletedEvent>();

  // Connect (if needed) and join the group for a post. Leaves any previously
  // joined post first so a connection only ever follows one post at a time.
  async joinPost(postId: string): Promise<void> {
    if (typeof window === 'undefined' || !postId) {
      return;
    }

    try { await this.ensureConnected(); } catch { return; }

    if (this.currentPostId && this.currentPostId !== postId) {
      await this.safeInvoke('LeavePost', this.currentPostId);
    }

    this.currentPostId = postId;
    await this.safeInvoke('JoinPost', postId);
  }

  // Leave the current post group without tearing down the connection.
  async leaveCurrentPost(): Promise<void> {
    if (this.connection && this.currentPostId) {
      await this.safeInvoke('LeavePost', this.currentPostId);
      this.currentPostId = undefined;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection) {
      this.connection = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/comments')
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.None)
        .build();

      this.connection.on('CommentCreated', (comment: any) => this.commentCreated$.next(comment));
      this.connection.on('CommentUpdated', (comment: any) => this.commentUpdated$.next(comment));
      this.connection.on('CommentDeleted', (payload: CommentDeletedEvent) =>
        this.commentDeleted$.next(payload)
      );

      // Re-join the active post group after an automatic reconnect.
      this.connection.onreconnected(async () => {
        if (this.currentPostId) {
          await this.safeInvoke('JoinPost', this.currentPostId);
        }
      });
    }

    if (this.connection.state === signalR.HubConnectionState.Connected) {
      return;
    }

    // Coalesce concurrent start attempts into a single promise.
    if (!this.starting) {
      this.starting = this.connection.start().catch((err) => { console.warn('[SignalR] Could not connect, realtime disabled:', err?.message ?? err); }).finally(() => {
        this.starting = undefined;
      });
    }

    await this.starting;
  }

  private async safeInvoke(method: string, arg: string): Promise<void> {
    try {
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        await this.connection.invoke(method, arg);
      }
    } catch (err) {
      console.error(`SignalR ${method} failed:`, err);
    }
  }
}
