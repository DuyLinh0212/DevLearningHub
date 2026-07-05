import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

type SidebarItem = {
  name: string;
  path: string;
  icon: string;
  permissions?: string[];
  roles?: string[];
  exact?: boolean;
  badgeKey?: 'moderation';
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit, OnDestroy, AfterViewInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private elementRef = inject(ElementRef);
  public themeService = inject(ThemeService);
  public mobileMenu = inject(MobileMenuService);

  get isMobileOpen(): boolean {
    return this.mobileMenu.isOpen();
  }

  profile = {
    displayName: 'Quản trị viên',
    username: '',
    email: '',
    avatarUrl: '',
    roles: [] as string[],
    permissions: [] as string[]
  };

  moderationPendingCount = 0;

  readonly sections: SidebarSection[] = [
    {
      title: 'Điều phối',
      items: [
        { name: 'Tổng quan', path: '/admin', icon: 'bi bi-grid-1x2', roles: ['Admin'], exact: true },
        { name: 'Kiểm duyệt', path: '/admin/moderation', icon: 'bi bi-shield-check', permissions: ['post:review', 'problem:review', 'quiz:review', 'problem_bank:review', 'roadmap:review'], badgeKey: 'moderation' },
        { name: 'Nhật ký kiểm duyệt', path: '/admin/moderation-log', icon: 'bi bi-journal-text', permissions: ['audit:view'] },
        { name: 'Báo cáo', path: '/admin/reports', icon: 'bi bi-flag', permissions: ['post:hide_any', 'post:delete_any'] }
      ]
    },
    {
      title: 'Nội dung',
      items: [
        { name: 'Bài viết', path: '/admin/posts', icon: 'bi bi-newspaper', permissions: ['post:hide_any', 'post:edit_any', 'post:delete_any'] },
        { name: 'Bài code', path: '/admin/problems', icon: 'bi bi-code-slash', permissions: ['problem:create', 'problem:edit'] },
        { name: 'Bộ đề', path: '/admin/quiz', icon: 'bi bi-collection', permissions: ['quiz:edit'] },
        { name: 'Lộ trình', path: '/admin/roadmap', icon: 'bi bi-signpost-split', permissions: ['roadmap:create', 'roadmap:edit', 'roadmap:delete', 'roadmap:view_progress'] },
        { name: 'Chủ đề', path: '/admin/topics', icon: 'bi bi-tags', permissions: ['topic:edit'] },
        { name: 'Tag', path: '/admin/tags', icon: 'bi bi-tag', permissions: ['tag:edit'] }
      ]
    },
    {
      title: 'Quản lý truy cập',
      items: [
        { name: 'Phân quyền', path: '/admin/roles', icon: 'bi bi-shield-lock', permissions: ['role:view', 'user:view_all'] }
      ]
    },
    {
      title: 'Hệ thống',
      items: [
        { name: 'Nhật ký', path: '/admin/audit-logs', icon: 'bi bi-terminal', permissions: ['audit:view'] },
        { name: 'Cài đặt', path: '/settings', icon: 'bi bi-gear', roles: ['Admin'] }
      ]
    }
  ];

  visibleSections: SidebarSection[] = [];

  private profileUpdateHandler = () => {
    this.loadUserProfile();
  };

  private parsedToken: any = null;
  private parsedTokenString = '';

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.mobileMenu.close();
        this.cdr.detectChanges();
      });
  }

  ngOnDestroy() {
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
    this.saveScrollPosition();
  }

  ngAfterViewInit() {
    this.restoreScrollPosition();
  }

  private getParsedToken(): any {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) {
      this.parsedToken = null;
      this.parsedTokenString = '';
      return null;
    }

    if (token === this.parsedTokenString && this.parsedToken) {
      return this.parsedToken;
    }

    try {
      const payloadPart = token.split('.')[1];
      this.parsedToken = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      this.parsedTokenString = token;
      return this.parsedToken;
    } catch {
      this.parsedToken = null;
      this.parsedTokenString = '';
      return null;
    }
  }

  hasRole(role: string): boolean {
    const target = role.toLowerCase();
    const decoded = this.getParsedToken();
    if (decoded) {
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
      if (roles.some((r: string) => (r || '').toLowerCase() === target)) {
        return true;
      }
    }

    return this.profile.roles.some(r => r.toLowerCase() === target);
  }

  hasPermission(permission: string): boolean {
    const target = permission.toLowerCase();

    if (this.profile.permissions.some(p => p.toLowerCase() === target)) {
      return true;
    }

    const decoded = this.getParsedToken();
    if (!decoded) {
      return false;
    }

    const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
    if (roles.some((r: string) => (r || '').toLowerCase() === 'admin')) {
      return true;
    }

    const permClaim = decoded['permission'];
    const permList: string[] = Array.isArray(permClaim) ? permClaim : (permClaim ? [permClaim] : []);
    return permList.some(p => p.toLowerCase() === target) || permList.some(p => p.toLowerCase() === 'system.full_control');
  }

  hasAnyPermission(permissions: string[] | undefined): boolean {
    if (!permissions || permissions.length === 0) {
      return true;
    }
    return permissions.some(permission => this.hasPermission(permission));
  }

  isVisible(item: SidebarItem): boolean {
    const roleOk = !item.roles || item.roles.some(role => this.hasRole(role));
    const permOk = this.hasAnyPermission(item.permissions);
    return roleOk && permOk;
  }

  badgeValue(item: SidebarItem): number {
    if (item.badgeKey === 'moderation') {
      return this.moderationPendingCount;
    }
    return 0;
  }

  private refreshVisibleSections() {
    this.visibleSections = this.sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => this.isVisible(item))
      }))
      .filter(section => section.items.length > 0);
  }

  loadUserProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) {
      return;
    }

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) {
          return;
        }

        this.profile = {
          displayName: user.fullName || user.username || 'Quan tri vien',
          username: user.username || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || '',
          roles: user.roles || [],
          permissions: user.permissions || []
        };

        this.refreshVisibleSections();
        this.loadModerationPendingCount();
        this.cdr.detectChanges();
      },
      error: () => {
        this.refreshVisibleSections();
        this.cdr.detectChanges();
      }
    });
  }

  private loadModerationPendingCount() {
    if (!this.hasAnyPermission(['post:review', 'problem:review', 'quiz:review', 'problem_bank:review', 'roadmap:review'])) {
      this.moderationPendingCount = 0;
      return;
    }

    this.http.get<any>('/api/admin/moderation/queue', { params: { status: 'pending' } }).subscribe({
      next: (res) => {
        const items = res?.data || res || [];
        this.moderationPendingCount = Array.isArray(items) ? items.length : 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.moderationPendingCount = 0;
        this.cdr.detectChanges();
      }
    });
  }

  saveScrollPosition() {
    if (typeof window !== 'undefined') {
      const menuEl = this.elementRef.nativeElement.querySelector('.sidebar-menu');
      if (menuEl) {
        sessionStorage.setItem('sidebarScrollTop', menuEl.scrollTop.toString());
      }
    }
  }

  restoreScrollPosition() {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const menuEl = this.elementRef.nativeElement.querySelector('.sidebar-menu');
        if (menuEl) {
          menuEl.scrollTop = Number(sessionStorage.getItem('sidebarScrollTop') || 0);
        }
      }, 50);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.cdr.detectChanges();
    }
  }

  toggleMobileSidebar() {
    this.mobileMenu.toggle();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
