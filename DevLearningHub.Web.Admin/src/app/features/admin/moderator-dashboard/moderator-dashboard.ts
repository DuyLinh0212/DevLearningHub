import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterLink],
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
    totalProblems: 0,
    totalRoadmaps: 0,
    pendingReports: 0
  };
  recentActions: ModerationAction[] = [];
  isLoading = false;

  currentUserRoles: string[] = [];
  currentUserId: string = '';
  userPermissions: string[] = [];
  canViewUsers: boolean = false;
  canModeratePosts: boolean = false;
  canViewAuditLogs: boolean = false;

  hiddenPostsList: any[] = [];
  recentProblems: any[] = [];
  recentRoadmaps: any[] = [];
  unhidingPostId: string | null = null;

  ngOnInit() {
    this.loadCurrentUser();
  }

  get hasAnyPermission(): boolean {
    const lowerRoles = this.currentUserRoles.map(r => r.toLowerCase());
    return lowerRoles.includes('admin') || 
           this.canViewUsers || 
           this.canModeratePosts || 
           this.canViewAuditLogs || 
           this.hasPermission('quiz:edit') || 
           this.hasPermission('roadmap:edit') || 
           this.hasPermission('topic:edit') || 
           this.hasPermission('tag:edit');
  }

  hasPermission(perm: string): boolean {
    return this.userPermissions.includes('system.full_control') || this.userPermissions.includes(perm);
  }

  loadCurrentUser() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        const lowerRoles = (user.roles || []).map((r: string) => r.toLowerCase());
        this.currentUserRoles = user.roles || [];
        this.currentUserId = user.id || '';
        this.userPermissions = user.permissions || [];
        
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
          this.hiddenPostsList = items.filter((p: any) => p.isHidden);
          this.stats.hiddenPosts = this.hiddenPostsList.length;
          this.stats.pendingReports = 0; // Simulated reports
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Lỗi tải danh sách posts:', err);
          this.stats.totalPosts = 0;
          this.stats.hiddenPosts = 0;
          this.hiddenPostsList = [];
          this.cdr.detectChanges();
        }
      });
    }

    // Load total & recent problems
    if (this.hasPermission('quiz:edit')) {
      this.http.get<any[]>('/api/problems').subscribe({
        next: (res: any[]) => {
          const list = res || [];
          this.stats.totalProblems = list.length;
          this.recentProblems = list.slice(0, 5);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Lỗi tải bài tập:', err);
          this.stats.totalProblems = 0;
          this.recentProblems = [];
          this.cdr.detectChanges();
        }
      });
    }

    // Load total & recent roadmaps
    if (this.hasPermission('roadmap:edit')) {
      this.http.get<any>('/api/roadmaps').subscribe({
        next: (res: any) => {
          const list = res?.data || res || [];
          this.stats.totalRoadmaps = list.length;
          this.recentRoadmaps = list.slice(0, 5);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Lỗi tải lộ trình:', err);
          this.stats.totalRoadmaps = 0;
          this.recentRoadmaps = [];
          this.cdr.detectChanges();
        }
      });
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

  unhidePost(postId: string, event: Event) {
    event.stopPropagation();
    const reason = prompt('Nhập lý do hiện lại bài viết:');
    if (reason === null) return;
    this.unhidingPostId = postId;
    this.cdr.detectChanges();

    this.http.post<any>(`/api/posts/${postId}/moderate`, { reason: reason.trim(), hidden: false }).subscribe({
      next: () => {
        alert('Đã hiện lại bài đăng thành công.');
        this.unhidingPostId = null;
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Lỗi hiện bài viết:', err);
        alert('Không thể hiện lại bài viết.');
        this.unhidingPostId = null;
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
