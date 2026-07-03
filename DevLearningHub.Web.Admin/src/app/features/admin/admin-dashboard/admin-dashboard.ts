import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  public mobileMenu = inject(MobileMenuService);

  statsData = {
    users: 0,
    problems: 0,
    quizSets: 0,
    topics: 0
  };

  recentUsers: any[] = [];
  recentPosts: any[] = [];
  recentProblems: any[] = [];

  get adminStats() {
    return [
      { title: 'Thành viên', value: this.statsData.users.toLocaleString(), unit: 'người dùng', icon: 'bi-people', color: 'cyan', link: '/admin/users' },
      { title: 'Bài tập code', value: this.statsData.problems.toLocaleString(), unit: 'bài', icon: 'bi-code-slash', color: 'blue', link: '/admin/problems' },
      { title: 'Bộ đề quiz', value: this.statsData.quizSets.toLocaleString(), unit: 'bộ', icon: 'bi-collection', color: 'emerald', link: '/admin/quiz' },
      { title: 'Chủ đề', value: this.statsData.topics.toLocaleString(), unit: 'tag', icon: 'bi-tags', color: 'amber', link: '/admin/topics' }
    ];
  }

  ngOnInit() {
    if (this.isOnlyModerator()) {
      this.router.navigate(['/admin/moderator-dashboard']);
      return;
    }
    this.loadBackendData();
  }

  private isOnlyModerator(): boolean {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return false;
      const payloadPart = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

      const roles = Array.isArray(roleClaim)
        ? roleClaim.map((r: string) => r.toLowerCase())
        : [ (roleClaim || '').toLowerCase() ];

      return roles.includes('moderator') && !roles.includes('admin');
    } catch (e) {
      return false;
    }
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
        console.error('Lá»—i láº¥y stats User:', err);
      }
    });

    // 2. Fetch Problems
    this.http.get<any[]>('/api/problems').subscribe({
      next: (res: any[]) => {
        const list = Array.isArray(res) ? res : [];
        this.statsData.problems = list.length || 0;
        this.recentProblems = [...list].sort((a: any, b: any) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime()).slice(0, 5);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lá»—i láº¥y stats Problems:', err);
      }
    });

    // 3. Fetch Quiz Sets
    this.http.get<any>('/api/quiz-sets').subscribe({
      next: (res: any) => {
        this.statsData.quizSets = res?.data?.length || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lá»—i láº¥y stats Quiz Sets:', err);
      }
    });

    // 4. Fetch Topics
    this.http.get<any>('/api/topics').subscribe({
      next: (res: any) => {
        this.statsData.topics = res?.data?.length || 0;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lá»—i láº¥y stats Topics:', err);
      }
    });

    // 5. Fetch Recent Posts
    this.http.get<any>('/api/posts?page=1&pageSize=5').subscribe({
      next: (res: any) => {
        const data = res?.data;
        this.recentPosts = data?.items || data || res?.items || [];
        if (!Array.isArray(this.recentPosts)) this.recentPosts = [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi lấy bài viết gần đây:', err);
        this.recentPosts = [];
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

