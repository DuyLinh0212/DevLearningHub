import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ModerationService, ModerationLogItem, ModerationType } from '../../../core/services/moderation.service';

@Component({
  selector: 'app-moderation-log',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './moderation-log.html',
  styleUrl: './moderation-log.css'
})
export class ModerationLogComponent implements OnInit {
  private moderation = inject(ModerationService);
  private cdr = inject(ChangeDetectorRef);

  logs: ModerationLogItem[] = [];
  isLoading = false;
  loadError = '';

  filterType: ModerationType | '' = '';
  filterAction = '';

  currentPage = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 1;
  pageNumbers: number[] = [];

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.isLoading = true;
    this.loadError = '';
    this.cdr.detectChanges();

    this.moderation.getLogs(
      this.currentPage,
      this.pageSize,
      this.filterType || undefined,
      this.filterAction || undefined
    ).subscribe({
      next: (res) => {
        this.logs = res.items || [];
        this.totalCount = res.totalCount || 0;
        this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));
        this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logs = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loadError = err?.status === 403
          ? 'Bạn không có quyền xem nhật ký kiểm duyệt (cần quyền audit:view).'
          : 'Không thể tải nhật ký kiểm duyệt.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadLogs();
  }

  resetFilters() {
    this.filterType = '';
    this.filterAction = '';
    this.currentPage = 1;
    this.loadLogs();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadLogs();
  }

  typeLabel(type: string): string {
    switch (type) {
      case 'post': return 'Bài viết';
      case 'problem': return 'Bài code';
      case 'problem_bank': return 'Kho bài tập';
      case 'quiz_set': return 'Bộ quiz';
      case 'roadmap': return 'Lộ trình';
      default: return type;
    }
  }

  actionLabel(action: string): string {
    return action === 'approve' ? 'Duyệt' : action === 'reject' ? 'Từ chối' : action;
  }

  formatDateTime(value: string): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}
