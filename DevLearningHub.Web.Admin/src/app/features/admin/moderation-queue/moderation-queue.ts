import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  ModerationService, ModerationQueueItem, ModerationType, ReviewStatus
} from '../../../core/services/moderation.service';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './moderation-queue.html',
  styleUrl: './moderation-queue.css'
})
export class ModerationQueueComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private auth = inject(AuthService);
  private moderation = inject(ModerationService);

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

  ngOnInit() {
    this.buildTabs();
    if (this.tabs.length > 0) {
      this.activeTab = this.tabs[0].key;
      this.loadQueue();
    }
  }

  private buildTabs() {
    const all: QueueTab[] = [
      { key: 'post', label: 'Bài viết', icon: 'bi-newspaper', permission: 'post:review', count: 0, visible: false },
      { key: 'problem', label: 'Bài code', icon: 'bi-cpu', permission: 'problem:review', count: 0, visible: false },
      { key: 'problem_bank', label: 'Kho bài tập', icon: 'bi-collection', permission: 'problem_bank:review', count: 0, visible: false },
      { key: 'quiz_set', label: 'Bộ quiz', icon: 'bi-patch-question', permission: 'quiz:review', count: 0, visible: false },
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
    this.loadQueue();
  }

  changeStatus(status: ReviewStatus) {
    if (this.statusFilter === status) return;
    this.statusFilter = status;
    this.loadQueue();
  }

  loadQueue() {
    this.isLoading = true;
    this.items = [];
    this.cdr.detectChanges();

    this.moderation.getQueue(this.activeTab, this.statusFilter).subscribe({
      next: (items) => {
        this.items = items;
        const tab = this.tabs.find(t => t.key === this.activeTab);
        if (tab && this.statusFilter === 'pending') tab.count = items.length;
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

  openReview(item: ModerationQueueItem, action: 'approve' | 'reject') {
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
