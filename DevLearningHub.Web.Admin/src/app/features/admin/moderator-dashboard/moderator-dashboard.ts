import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { AuthService } from '../../../core/services/auth.service';
import { AnalyticsService, ModeratorDashboardSummary, ModerationLogItem } from '../../../core/services/analytics.service';

// A KPI card describes one operational metric shown at the top of the dashboard.
interface KpiCard {
  key: string;
  label: string;
  value: number;
  icon: string;
  tone: 'red' | 'amber' | 'blue' | 'purple' | 'green';
  link: string;
  visible: boolean;
}

// A quick action is a shortcut to a management screen.
interface QuickAction {
  label: string;
  description: string;
  icon: string;
  link: string;
  visible: boolean;
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
  private authService = inject(AuthService);
  private analytics = inject(AnalyticsService);
  public mobileMenu = inject(MobileMenuService);

  isLoading = false;

  // Permission flags resolved from the current user profile.
  roles: string[] = [];
  permissions: string[] = [];
  canModeratePosts = false;
  canReviewProblems = false;
  canReviewQuiz = false;
  canViewReports = false;
  canViewAuditLogs = false;

  summary: ModeratorDashboardSummary = {
    pendingReports: 0,
    pendingPosts: 0,
    pendingProblems: 0,
    pendingQuizSets: 0,
    pendingProblemBanks: 0,
    hiddenPosts: 0,
    totalPosts: 0,
    totalProblems: 0,
    totalQuizSets: 0,
    totalProblemBanks: 0,
    recentModerationLogs: [],
  };

  kpiCards: KpiCard[] = [];
  quickActions: QuickAction[] = [];

  // Hidden posts pane (kept from previous dashboard, still useful for moderators).
  hiddenPostsList: any[] = [];
  unhidingPostId: string | null = null;

  ngOnInit() {
    this.loadCurrentUser();
  }

  get hasAnyPermission(): boolean {
    return this.roles.map(r => r.toLowerCase()).includes('admin') ||
      this.canModeratePosts ||
      this.canReviewProblems ||
      this.canReviewQuiz ||
      this.canViewReports ||
      this.canViewAuditLogs;
  }

  private has(perm: string): boolean {
    return this.permissions.includes('system.full_control') || this.permissions.includes(perm);
  }

  loadCurrentUser() {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.applyPermissions(user.roles || [], user.permissions || []);
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Không tải được thông tin người dùng:', err);
        this.applyPermissions([], []);
        this.loadDashboardData();
      }
    });
  }

  private applyPermissions(roles: string[], permissions: string[]) {
    this.roles = roles;
    this.permissions = permissions;
    const isAdmin = roles.map(r => r.toLowerCase()).includes('admin');

    this.canModeratePosts = isAdmin || this.has('post:review') || this.has('post:hide_any') ||
      this.has('post:delete_any') || this.has('post:edit_any');
    this.canReviewProblems = isAdmin || this.has('problem:review');
    this.canReviewQuiz = isAdmin || this.has('quiz:review');
    this.canViewReports = isAdmin || this.has('post:review') || this.has('post:delete_any');
    this.canViewAuditLogs = isAdmin || this.has('audit:view');
  }

  loadDashboardData() {
    this.analytics.getModeratorDashboard().subscribe({
      next: (summary) => {
        this.summary = summary;
        this.buildKpiCards();
        this.buildQuickActions();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buildKpiCards();
        this.buildQuickActions();
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });

    // Hidden posts list is fetched separately so the pane can offer inline restore.
    if (this.canModeratePosts) {
      this.http.get<any>('/api/posts?page=1&pageSize=100').subscribe({
        next: (res) => {
          const items = res?.data?.items || [];
          this.hiddenPostsList = items.filter((p: any) => p.isHidden);
          this.cdr.detectChanges();
        },
        error: () => {
          this.hiddenPostsList = [];
          this.cdr.detectChanges();
        }
      });
    }
  }

  private buildKpiCards() {
    const cards: KpiCard[] = [
      {
        key: 'reports', label: 'Báo cáo chờ xử lý', value: this.summary.pendingReports,
        icon: 'bi-flag-fill', tone: 'red', link: '/admin/reports', visible: this.canViewReports
      },
      {
        key: 'posts', label: 'Bài viết chờ duyệt', value: this.summary.pendingPosts,
        icon: 'bi-file-earmark-text-fill', tone: 'amber', link: '/admin/posts', visible: this.canModeratePosts
      },
      {
        key: 'problems', label: 'Bài code chờ duyệt', value: this.summary.pendingProblems,
        icon: 'bi-cpu-fill', tone: 'purple', link: '/admin/problems', visible: this.canReviewProblems
      },
      {
        key: 'quiz', label: 'Bộ quiz chờ duyệt', value: this.summary.pendingQuizSets,
        icon: 'bi-patch-question-fill', tone: 'blue', link: '/admin/quiz', visible: this.canReviewQuiz
      },
      {
        key: 'hidden', label: 'Bài viết đang ẩn', value: this.summary.hiddenPosts,
        icon: 'bi-eye-slash-fill', tone: 'green', link: '/admin/posts', visible: this.canModeratePosts
      },
    ];
    this.kpiCards = cards.filter(c => c.visible);
  }

  private buildQuickActions() {
    this.quickActions = [
      {
        label: 'Kiểm duyệt bài viết', description: 'Ẩn, hiện, xử lý bài đăng diễn đàn',
        icon: 'bi-newspaper', link: '/admin/posts', visible: this.canModeratePosts
      },
      {
        label: 'Xử lý báo cáo', description: 'Duyệt các báo cáo từ người dùng',
        icon: 'bi-flag', link: '/admin/reports', visible: this.canViewReports
      },
      {
        label: 'Kho bài tập', description: 'Quản lý và duyệt bài code',
        icon: 'bi-cpu', link: '/admin/problems', visible: this.canReviewProblems
      },
      {
        label: 'Bộ quiz', description: 'Quản lý và duyệt bộ câu hỏi',
        icon: 'bi-patch-question', link: '/admin/quiz', visible: this.canReviewQuiz
      },
      {
        label: 'Nhật ký hệ thống', description: 'Xem lịch sử thao tác kiểm duyệt',
        icon: 'bi-clock-history', link: '/admin/audit-logs', visible: this.canViewAuditLogs
      },
    ].filter(a => a.visible);
  }

  unhidePost(postId: string, event: Event) {
    event.stopPropagation();
    const reason = prompt('Nhập lý do hiện lại bài viết:');
    if (reason === null) return;
    this.unhidingPostId = postId;
    this.cdr.detectChanges();

    this.http.post<any>(`/api/posts/${postId}/moderate`, { reason: reason.trim(), hidden: false }).subscribe({
      next: () => {
        this.unhidingPostId = null;
        this.loadDashboardData();
      },
      error: (err) => {
        console.error('Không thể hiện lại bài viết:', err);
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
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'hide': return 'Ẩn nội dung';
      case 'restore': return 'Hiện nội dung';
      case 'approve': return 'Duyệt nội dung';
      case 'reject': return 'Từ chối nội dung';
      default: return action;
    }
  }

  getActionIcon(action: string): string {
    switch (action) {
      case 'hide': return 'bi-eye-slash';
      case 'restore': return 'bi-eye';
      case 'approve': return 'bi-check-circle';
      case 'reject': return 'bi-x-circle';
      default: return 'bi-activity';
    }
  }

  trackByLog(_index: number, log: ModerationLogItem) {
    return log.id;
  }
}
