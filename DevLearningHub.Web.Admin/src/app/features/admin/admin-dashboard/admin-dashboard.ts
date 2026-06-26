import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);

  statsData = {
    users: 0,
    problems: 0,
    quizSets: 0,
    topics: 0
  };

  recentUsers: any[] = [];
  recentLogs: any[] = [];
  hasLogsError = false;

  get adminStats() {
    return [
      { title: 'Tổng số thành viên', value: this.statsData.users.toLocaleString(), icon: 'bi-people-fill', color: 'purple' },
      { title: 'Tổng số bài tập', value: this.statsData.problems.toLocaleString(), icon: 'bi-cpu-fill', color: 'blue' },
      { title: 'Tổng số đề thi', value: this.statsData.quizSets.toLocaleString(), icon: 'bi-database-fill', color: 'green' },
      { title: 'Tổng số chủ đề', value: this.statsData.topics.toLocaleString(), icon: 'bi-tags-fill', color: 'orange' }
    ];
  }

  ngOnInit() {
    this.loadBackendData();
  }

  private checkAdminRole(): boolean {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return false;
      const payloadPart = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

      if (Array.isArray(roleClaim)) {
        return roleClaim.map((r: string) => r.toLowerCase()).includes('admin') ||
               roleClaim.map((r: string) => r.toLowerCase()).includes('moderator');
      }
      const role = roleClaim?.toLowerCase();
      return role === 'admin' || role === 'moderator';
    } catch (e) {
      return false;
    }
  }

  private loadBackendData() {
    if (!this.checkAdminRole()) return;

    // 1. Fetch Users & Recent Users
    this.http.get<any>('/api/admin/users?pageSize=5').subscribe({
      next: (res: any) => {
        const responseData = res?.data;
        this.statsData.users = responseData?.totalCount || 0;
        this.recentUsers = responseData?.items || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy stats User:', err);
      }
    });

    // 2. Fetch Problems
    this.http.get<any[]>('/api/problems').subscribe({
      next: (res: any[]) => {
        this.statsData.problems = res?.length || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy stats Problems:', err);
      }
    });

    // 3. Fetch Quiz Sets
    this.http.get<any>('/api/quiz-sets').subscribe({
      next: (res: any) => {
        this.statsData.quizSets = res?.data?.length || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy stats Quiz Sets:', err);
      }
    });

    // 4. Fetch Topics
    this.http.get<any>('/api/topics').subscribe({
      next: (res: any) => {
        this.statsData.topics = res?.data?.length || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy stats Topics:', err);
      }
    });

    // 5. Fetch Recent Audit Logs
    this.http.get<any>('/api/admin/audit-logs?pageSize=5').subscribe({
      next: (res: any) => {
        const responseData = res?.data;
        this.recentLogs = responseData?.items || [];
        this.hasLogsError = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy stats Audit Logs:', err);
        this.hasLogsError = true;
        this.recentLogs = [];
        this.cdr.detectChanges();
      }
    });
  }

  formatDateTime(value: string): string {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
}