import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-report-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report-management.html',
  styleUrl: './report-management.css'
})
export class ReportManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  reports: any[] = [];
  reportTypes: any[] = [];
  isLoading = false;

  filterStatus = '';
  filterType = '';
  currentPage = 1;
  pageSize = 20;
  totalPages = 1;
  totalCount = 0;

  resolvingId: string | null = null;
  resolveStatus = 'resolved';

  ngOnInit() {
    this.loadReportTypes();
    this.loadReports();
  }

  loadReportTypes() {
    this.http.get<any>('/api/reports/types').subscribe({
      next: (res) => {
        this.reportTypes = res?.data || [];
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  loadReports() {
    this.isLoading = true;
    this.cdr.detectChanges();

    const params: Record<string, string> = {
      page: String(this.currentPage),
      pageSize: String(this.pageSize)
    };
    if (this.filterStatus) params['status'] = this.filterStatus;
    if (this.filterType) params['type'] = this.filterType;

    this.http.get<any>('/api/reports', { params }).subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.reports = data?.items || [];
        this.totalCount = data?.totalCount ?? 0;
        this.totalPages = data?.totalPages ?? 1;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    this.currentPage = 1;
    this.loadReports();
  }

  goPage(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
    this.loadReports();
  }

  startResolve(reportId: string, currentStatus: string) {
    this.resolvingId = reportId;
    this.resolveStatus = currentStatus === 'pending' ? 'resolved' : 'dismissed';
    this.cdr.detectChanges();
  }

  cancelResolve() {
    this.resolvingId = null;
    this.cdr.detectChanges();
  }

  confirmResolve(reportId: string) {
    this.http.put<any>(`/api/reports/${reportId}/resolve`, { status: this.resolveStatus }).subscribe({
      next: (res) => {
        const report = this.reports.find(r => r.id === reportId);
        if (report) {
          report.status = this.resolveStatus;
          report.resolvedAt = new Date().toISOString();
        }
        this.resolvingId = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể cập nhật báo cáo.');
      }
    });
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'reviewed': return 'Đã xem';
      case 'resolved': return 'Đã giải quyết';
      case 'dismissed': return 'Bác bỏ';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'reviewed': return 'Đã xem';
      case 'resolved': return 'Đã giải quyết';
      case 'dismissed': return 'Bác bỏ';
      default: return '';
    }
  }

  getTypeLabel(typeName: string): string {
    switch (typeName) {
      case 'post': return 'Bài viết';
      case 'comment': return 'Bình luận';
      case 'problem': return 'Bài tập Code';
      case 'quiz_question': return 'Câu hỏi Quiz';
      default: return typeName;
    }
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }

  get pageNumbers(): number[] {
    const range = 3;
    const start = Math.max(1, this.currentPage - range);
    const end = Math.min(this.totalPages, this.currentPage + range);
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }
}

