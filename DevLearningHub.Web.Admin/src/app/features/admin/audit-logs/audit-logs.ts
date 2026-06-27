import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

interface AuditLog {
  id: string;
  actorId: string;
  actorUsername?: string;
  actorFullName?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ipAddress?: string;
  createdAt: string;
}

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule,  FormsModule],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.css'
})
export class AuditLogsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  logs: AuditLog[] = [];
  actions: string[] = [];
  isLoading = false;
  loadError = '';

  // Filters
  filterAction = '';
  filterTargetType = '';
  filterFrom = '';
  filterTo = '';

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 1;
  pageNumbers: number[] = [];

  ngOnInit() {
    this.loadActions();
    this.loadLogs();
  }

  loadActions() {
    this.http.get<any>('/api/admin/audit-logs/actions').subscribe({
      next: (res) => {
        this.actions = res?.data || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.actions = [];
      }
    });
  }

  loadLogs() {
    this.isLoading = true;
    this.loadError = '';
    this.cdr.detectChanges();

    const params: string[] = [`page=${this.currentPage}`, `pageSize=${this.pageSize}`];
    if (this.filterAction) params.push(`action=${encodeURIComponent(this.filterAction)}`);
    if (this.filterTargetType) params.push(`targetType=${encodeURIComponent(this.filterTargetType)}`);
    if (this.filterFrom) params.push(`from=${encodeURIComponent(this.filterFrom)}`);
    if (this.filterTo) params.push(`to=${encodeURIComponent(this.filterTo + 'T23:59:59')}`);

    this.http.get<any>(`/api/admin/audit-logs?${params.join('&')}`).subscribe({
      next: (res) => {
        const data = res?.data;
        this.logs = data?.items || [];
        this.totalCount = data?.totalCount || 0;
        this.totalPages = data?.totalPages || Math.ceil(this.totalCount / this.pageSize) || 1;
        this.calculatePageNumbers();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.logs = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loadError = err?.status === 403
          ? 'Bạn không có quyền xem nhật ký hệ thống (cần quyền audit:view).'
          : 'Không thể tải nhật ký hệ thống.';
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
    this.filterAction = '';
    this.filterTargetType = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.currentPage = 1;
    this.loadLogs();
  }

  calculatePageNumbers() {
    this.pageNumbers = [];
    for (let i = 1; i <= this.totalPages; i++) {
      this.pageNumbers.push(i);
    }
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadLogs();
  }

  // Group actions by their prefix (auth / user / quiz...) for a colored badge.
  actionGroup(action: string): string {
    return (action || '').split('.')[0] || 'other';
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
