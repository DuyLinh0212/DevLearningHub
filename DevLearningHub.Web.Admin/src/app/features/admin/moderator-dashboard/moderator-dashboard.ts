import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
  imports: [CommonModule],
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
    hiddenPosts: 0,
    pendingReports: 0
  };
  recentActions: ModerationAction[] = [];
  isLoading = false;

  currentUserRoles: string[] = [];
  currentUserId: string = '';
  canViewUsers: boolean = false;
  canModeratePosts: boolean = false;
  canViewAuditLogs: boolean = false;

  ngOnInit() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        const lowerRoles = (user.roles || []).map((r: string) => r.toLowerCase());
        this.currentUserRoles = user.roles || [];
        this.currentUserId = user.id || '';
        
        this.canViewUsers = user.permissions?.includes('user:view_all') || lowerRoles.includes('admin');
        this.canModeratePosts = user.permissions?.includes('post:hide_any') || 
                                user.permissions?.includes('post:delete_any') || 
                                user.permissions?.includes('post:edit_any') || 
                                lowerRoles.includes('admin') || 
                                lowerRoles.includes('moderator');
        this.canViewAuditLogs = user.permissions?.includes('audit:view') || lowerRoles.includes('admin');
        
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Lỗi tải thông tin user:', err);
        this.loadDashboardData();
      }
    });
  }

  loadDashboardData() {
    this.cdr.detectChanges();

    // Load total & hidden posts
    if (this.canModeratePosts) {
      this.http.get<any>('/api/posts?page=1&pageSize=100').subscribe({
        next: (res) => {
          const data = res?.data;
          const items = data?.items || [];
          this.stats.totalPosts = data?.totalCount || items.length;
          this.stats.hiddenPosts = items.filter((p: any) => p.isHidden).length;
          this.stats.pendingReports = 0; // Realistically initialized
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Lỗi tải danh sách posts:', err);
          this.stats.totalPosts = 0;
          this.stats.hiddenPosts = 0;
          this.stats.pendingReports = 0;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.stats.totalPosts = 0;
      this.stats.hiddenPosts = 0;
      this.stats.pendingReports = 0;
    }

    // Load recent moderation actions
    if (this.canViewAuditLogs) {
      this.http.get<any>('/api/admin/audit-logs?page=1&pageSize=50').subscribe({
        next: (res) => {
          const data = res?.data;
          const allLogs = data?.items || [];
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
    } else {
      this.recentActions = [];
      this.isLoading = false;
      this.cdr.detectChanges();
    }
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
