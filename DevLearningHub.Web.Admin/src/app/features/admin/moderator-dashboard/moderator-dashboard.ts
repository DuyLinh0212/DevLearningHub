import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';

interface ModerationAction {
  id: string;
  action: string;
  actorUsername: string;
  targetType: string;
  targetId: string;
  detail: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-moderator-dashboard',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './moderator-dashboard.html',
  styleUrl: './moderator-dashboard.css'
})
export class ModeratorDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public mobileMenu = inject(MobileMenuService);
  private authService = inject(AuthService);

  stats = {
    totalPosts: 0,
    totalModerators: 0,
    totalUsers: 0
  };
  recentActions: ModerationAction[] = [];
  isLoading = false;

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.isLoading = true;
    this.cdr.detectChanges();

    // Load total users
    this.http.get<any>('/api/admin/users?page=1&pageSize=1').subscribe({
      next: (res) => {
        const data = res?.data;
        this.stats.totalUsers = data?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải danh sách users:', err.status, err.statusText, err.error);
        this.stats.totalUsers = 0;
        this.cdr.detectChanges();
      }
    });

    // Load total posts (public only)
    this.http.get<any>('/api/posts?page=1&pageSize=1').subscribe({
      next: (res) => {
        const data = res?.data;
        this.stats.totalPosts = data?.totalCount || 0;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải danh sách posts:', err.status, err.statusText, err.error);
        this.stats.totalPosts = 0;
        this.cdr.detectChanges();
      }
    });

    // Load total moderators (users with Moderator role)
    this.http.get<any>('/api/admin/users?page=1&pageSize=100').subscribe({
      next: (res) => {
        const data = res?.data;
        const users = data?.items || [];
        const modCount = users.filter((u: any) => u.roles?.some((r: string) => r.toLowerCase() === 'moderator')).length;
        // If paginated, approximate
        this.stats.totalModerators = data?.totalCount ? Math.max(modCount, data.totalCount) : modCount;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải danh sách moderators:', err.status, err.statusText, err.error);
        this.stats.totalModerators = 0;
        this.cdr.detectChanges();
      }
    });

    // Load recent moderation actions (all logs, filter client-side)
    this.http.get<any>('/api/admin/audit-logs?page=1&pageSize=50').subscribe({
      next: (res) => {
        const data = res?.data;
        const allLogs = data?.items || [];

        // Filter only moderation-related actions (hide/restore)
        const allowedActions = ['hide', 'restore'];
        this.recentActions = allLogs
          .filter((log: any) => allowedActions.includes(log.action))
          .map((log: any) => ({
            id: log.id,
            action: log.action,
            actorUsername: log.actorUsername || 'System',
            targetType: log.targetType,
            targetId: log.targetId,
            detail: log.detail,
            createdAt: log.createdAt
          }));

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Lỗi tải audit logs:', err.status, err.statusText, err.error);
        this.recentActions = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'hide': return 'Ẩn nội dung';
      case 'restore': return 'Hiện nội dung';
      default: return action;
    }
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'hide': return 'bi-eye-slash';
      case 'restore': return 'bi-eye';
      default: return 'bi-activity';
    }
  }

  onAvatarError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img) img.src = 'assets/images/default-avatar.svg';
  }
}
