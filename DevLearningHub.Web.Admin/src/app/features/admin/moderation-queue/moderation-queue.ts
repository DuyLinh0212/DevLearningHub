import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  ModerationService, ModerationQueueItem, ModerationType, ReviewStatus
} from '../../../core/services/moderation.service';
import { NotificationRealtimeService } from '../../../core/services/notification-realtime.service';
import { Subscription, interval } from 'rxjs';

interface QueueTab {
  key: ModerationType;
  label: string;
  icon: string;
  permission: string;
  count: number;
  visible: boolean;
}

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './moderation-queue.html',
  styleUrl: './moderation-queue.css'
})
export class ModerationQueueComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);
  private moderation = inject(ModerationService);
  private notifRealtime = inject(NotificationRealtimeService);

  tabs: QueueTab[] = [];
  activeTab: ModerationType = 'post';
  statusFilter: ReviewStatus = 'pending';

  items: ModerationQueueItem[] = [];
  isLoading = false;

  // Reason modal state.
  reviewTarget: ModerationQueueItem | null = null;
  reviewAction: 'approve' | 'reject' = 'approve';
  reviewReason = '';
  submitting = false;

  // Detail view state.
  detailTarget: ModerationQueueItem | null = null;
  detailContent: any = null;
  detailLoading = false;
  detailError = '';

  private pollSub?: Subscription;
  private queueChangedSub?: Subscription;

  ngOnInit() {
    this.buildTabs();
    if (this.tabs.length > 0) {
      this.activeTab = this.tabs[0].key;
      this.startPolling();
    }
    this.queueChangedSub = this.notifRealtime.moderationQueueChanged$.subscribe(() => {
      if (this.statusFilter === 'pending' && !this.submitting) {
        this.loadQueueSilent();
      }
    });
  }

  ngOnDestroy() {
    this.stopPolling();
    this.queueChangedSub?.unsubscribe();
  }

  startPolling() {
    this.stopPolling();
    this.pollSub = interval(5000).subscribe(() => {
      if (this.statusFilter === 'pending' && !this.submitting) {
        this.loadQueueSilent();
      }
    });
    this.loadQueue(); // Initial load with spinner
  }

  stopPolling() {
    if (this.pollSub) {
      this.pollSub.unsubscribe();
      this.pollSub = undefined;
    }
  }

  private buildTabs() {
    const all: QueueTab[] = [
      { key: 'post', label: 'Bài viết', icon: 'bi-newspaper', permission: 'post:review', count: 0, visible: false },
      { key: 'problem', label: 'Bài code', icon: 'bi-cpu', permission: 'problem:review', count: 0, visible: false },
      { key: 'problem_bank', label: 'Kho bài tập', icon: 'bi-collection', permission: 'problem_bank:review', count: 0, visible: false },
      { key: 'quiz_set', label: 'Bộ quiz', icon: 'bi-patch-question', permission: 'quiz:review', count: 0, visible: false },
      { key: 'roadmap', label: 'Lộ trình', icon: 'bi-signpost-split', permission: 'roadmap:review', count: 0, visible: false },
    ];
    for (const tab of all) {
      tab.visible = this.auth.hasPermission(tab.permission);
    }
    this.tabs = all.filter(t => t.visible);
  }

  get hasAnyAccess(): boolean {
    return this.tabs.length > 0;
  }

  get activeTabCanReview(): boolean {
    const tab = this.tabs.find(t => t.key === this.activeTab);
    return tab ? this.auth.hasPermission(tab.permission) : false;
  }

  selectTab(key: ModerationType) {
    if (this.activeTab === key) return;
    this.activeTab = key;
    this.startPolling(); // Restart polling for the new tab
  }

  changeStatus(status: ReviewStatus) {
    if (this.statusFilter === status) return;
    this.statusFilter = status;
    
    // Only poll automatically if viewing the pending queue
    if (status === 'pending') {
      this.startPolling();
    } else {
      this.stopPolling();
      this.loadQueue();
    }
  }

  loadQueue() {
    this.isLoading = true;
    this.items = [];
    this.cdr.detectChanges();

    this.moderation.getQueue('all', this.statusFilter).subscribe({
      next: (allItems) => {
        if (this.statusFilter === 'pending') {
          for (const tab of this.tabs) {
            tab.count = allItems.filter(i => i.type === tab.key).length;
          }
        }
        this.items = allItems.filter(i => i.type === this.activeTab);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.items = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadQueueSilent() {
    this.moderation.getQueue('all', this.statusFilter).subscribe({
      next: (allItems) => {
        if (this.statusFilter === 'pending') {
          for (const tab of this.tabs) {
            tab.count = allItems.filter(i => i.type === tab.key).length;
          }
        }
        
        const activeItems = allItems.filter(i => i.type === this.activeTab);
        // Only update if there's a difference to avoid UI flicker
        if (JSON.stringify(this.items.map(i => i.id)) !== JSON.stringify(activeItems.map(i => i.id))) {
          this.items = activeItems;
        }
        this.cdr.detectChanges();
      },
      error: () => {} // Silent fail
    });
  }

  viewDetail(item: ModerationQueueItem) {
    this.detailTarget = item;
    this.detailContent = null;
    this.detailError = '';
    this.detailLoading = true;
    this.cdr.detectChanges();

    this.moderation.getDetail(item.type, item.id).subscribe({
      next: (content) => {
        this.detailContent = content;
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detailError = 'Không thể tải nội dung chi tiết.';
        this.detailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail() {
    this.detailTarget = null;
    this.detailContent = null;
    this.detailError = '';
    this.cdr.detectChanges();
  }

  openReview(item: ModerationQueueItem, action: 'approve' | 'reject') {
    this.detailTarget = null;
    this.detailContent = null;
    this.reviewTarget = item;
    this.reviewAction = action;
    this.reviewReason = '';
    this.cdr.detectChanges();
  }

  cancelReview() {
    this.reviewTarget = null;
    this.reviewReason = '';
    this.cdr.detectChanges();
  }

  confirmReview() {
    if (!this.reviewTarget || this.submitting) return;

    // A rejection should carry a reason so the author understands the decision.
    if (this.reviewAction === 'reject' && !this.reviewReason.trim()) {
      alert('Vui lòng nhập lý do từ chối.');
      return;
    }

    this.submitting = true;
    this.cdr.detectChanges();

    const { type, id } = this.reviewTarget;
    const reason = this.reviewReason.trim() || undefined;
    const request$ = this.reviewAction === 'approve'
      ? this.moderation.approve(type, id, reason)
      : this.moderation.reject(type, id, reason);

    request$.subscribe({
      next: () => {
        this.items = this.items.filter(i => i.id !== id);
        const tab = this.tabs.find(t => t.key === type);
        if (tab && tab.count > 0 && this.statusFilter === 'pending') tab.count -= 1;
        this.submitting = false;
        this.reviewTarget = null;
        this.reviewReason = '';
        if (this.detailTarget?.id === id) this.closeDetail();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.submitting = false;
        alert(err?.error?.message || 'Thao tác kiểm duyệt thất bại.');
        this.cdr.detectChanges();
      }
    });
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ duyệt';
      case 'approved': return 'Đã duyệt';
      case 'rejected': return 'Từ chối';
      default: return status;
    }
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }
}
