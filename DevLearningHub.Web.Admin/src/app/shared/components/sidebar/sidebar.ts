import { Component, inject, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../core/services/theme.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

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
  public themeService = inject(ThemeService);
  private http = inject(HttpClient);
  public mobileMenu = inject(MobileMenuService);
  private elementRef = inject(ElementRef);
  
  /** Getter để template vẫn đọc được isMobileOpen như cũ */
  get isMobileOpen(): boolean { return this.mobileMenu.isOpen(); }

  profile = {
    displayName: 'Quản trị viên',
    username: '',
    email: '',
    avatarUrl: '',
    roles: [] as string[],
    permissions: [] as string[]
  };

  // Trạng thái tìm kiếm toàn cục
  searchQuery: string = '';
  showSearchResults: boolean = false;
  searchLoading: boolean = false;

  matchedPages: any[] = [];
  matchedProblems: any[] = [];
  matchedQuizzes: any[] = [];
  matchedUsers: any[] = [];

  pagesList = [
    { name: 'Bảng điều phối', path: '/admin', icon: 'bi bi-speedometer2' },
    { name: 'Quản lý Đề thi', path: '/admin/quiz', icon: 'bi bi-database-fill' },
    { name: 'Quản lý Bài tập', path: '/admin/problems', icon: 'bi bi-cpu-fill' },
    { name: 'Quản lý Chủ đề', path: '/admin/topics', icon: 'bi bi-tags-fill' },
    { name: 'Quản lý Lộ trình', path: '/admin/roadmap', icon: 'bi bi-signpost-split' },
    { name: 'Quản lý Tag', path: '/admin/tags', icon: 'bi bi-tag-fill' },
    { name: 'Quản lý Bài viết', path: '/admin/posts', icon: 'bi bi-newspaper' },
    { name: 'Phản hồi từ User', path: '/admin/reports', icon: 'bi bi-flag-fill' },
    { name: 'Quản lý Người dùng', path: '/admin/users', icon: 'bi bi-people-fill' },
    { name: 'Quản lý Phân quyền', path: '/admin/roles', icon: 'bi bi-shield-lock' },
    { name: 'Quản lý Moderator', path: '/admin/moderators', icon: 'bi bi-person-badge' },
    { name: 'Dashboard Moderator', path: '/admin/moderator-dashboard', icon: 'bi bi-speedometer2' },
    { name: 'Logs hệ thống', path: '/admin/audit-logs', icon: 'bi bi-terminal-fill' },
    { name: 'Cài đặt', path: '/settings', icon: 'bi bi-gear' }
  ];

  private profileUpdateHandler = () => this.loadUserProfile();

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.mobileMenu.close();
      this.clearSearch();
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

  private parsedToken: any = null;
  private parsedTokenString: string = '';

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
    } catch (e) {
      console.error('Error decoding token in sidebar:', e);
      this.parsedToken = null;
      this.parsedTokenString = '';
      return null;
    }
  }

  hasRole(role: string): boolean {
    if (!role) return false;
    const target = role.toLowerCase();

    const decoded = this.getParsedToken();
    if (decoded) {
      const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      const roles = Array.isArray(roleClaim)
        ? roleClaim.map((r: string) => r.toLowerCase())
        : [roleClaim?.toLowerCase()];
      if (roles.some(r => r === target)) {
        return true;
      }
    }

    return this.profile.roles?.some(r => r.toLowerCase() === target) || false;
  }

  hasPermission(permission: string): boolean {
    if (!permission) return false;
    const target = permission.toLowerCase();

    if (this.profile.permissions?.some(p => p.toLowerCase() === target)) {
      return true;
    }

    const decoded = this.getParsedToken();
    if (!decoded) return false;

    // Admin role = full control
    const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    const roles = Array.isArray(roleClaim)
      ? roleClaim.map((r: string) => r.toLowerCase())
      : [(roleClaim || '').toLowerCase()];
    if (roles.includes('admin')) return true;

    // Read 'permission' claims
    const permClaim = decoded['permission'];
    const permList: string[] = Array.isArray(permClaim)
      ? permClaim
      : (permClaim ? [permClaim] : []);

    return permList.some(p => p.toLowerCase() === target) ||
           permList.some(p => p.toLowerCase() === 'system.full_control');
  }

  loadUserProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) {
          console.warn('No user data from /api/users/me');
          return;
        }

        console.log('User profile loaded:', { roles: user.roles, permissions: user.permissions });

        this.profile = {
          displayName: user.fullName || user.username || 'Quản trị viên',
          username: user.username || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || '',
          roles: user.roles || [],
          permissions: user.permissions || []
        };
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading user profile:', err);
        this.cdr.detectChanges();
      }
    });
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const query = input.value.trim().toLowerCase();
    this.searchQuery = input.value;

    if (!query) {
      this.clearSearch();
      return;
    }

    this.showSearchResults = true;
    this.searchLoading = true;
    this.cdr.detectChanges();

    // 1. Tìm trong Chức năng (Local) - Lọc theo vai trò và quyền hạn
    this.matchedPages = this.pagesList.filter(p => {
      if (!p.name.toLowerCase().includes(query)) return false;
      if (p.path === '/admin') return this.hasRole('Admin');
      if (p.path === '/admin/quiz') return this.hasPermission('quiz:edit');
      if (p.path === '/admin/problems') return this.hasPermission('quiz:edit');
      if (p.path === '/admin/topics') return this.hasPermission('topic:edit');
      if (p.path === '/admin/tags') return this.hasPermission('tag:edit');
      if (p.path === '/admin/posts') return this.hasPermission('post:hide_any') || this.hasPermission('post:edit_any') || this.hasPermission('post:delete_any');
      if (p.path === '/admin/reports') return this.hasPermission('post:hide_any') || this.hasPermission('post:delete_any');
      if (p.path === '/admin/audit-logs') return this.hasPermission('audit:view');
      if (p.path === '/admin/users') return this.hasPermission('user:view_all');
      if (p.path === '/admin/moderators') return this.hasRole('Admin');
      if (p.path === '/admin/moderator-dashboard') return this.hasRole('Moderator') && !this.hasRole('Admin');
      return true; // Cài đặt
    });

    const searchProblems = this.hasRole('Admin') || this.hasPermission('quiz:edit');
    const searchQuizzes = this.hasRole('Admin') || this.hasPermission('quiz:edit');
    const searchUsers = this.hasRole('Admin') || this.hasPermission('user:view_all');

    let activeRequests = 0;
    if (searchProblems) activeRequests++;
    if (searchQuizzes) activeRequests++;
    if (searchUsers) activeRequests++;

    if (activeRequests === 0) {
      this.searchLoading = false;
      this.matchedProblems = [];
      this.matchedQuizzes = [];
      this.matchedUsers = [];
      this.cdr.detectChanges();
      return;
    }

    const checkLoading = () => {
      activeRequests--;
      if (activeRequests <= 0) {
        this.searchLoading = false;
      }
      this.cdr.detectChanges();
    };

    // 2. Tìm trong Bài tập code (BE)
    if (searchProblems) {
      this.http.get<any[]>('/api/problems').subscribe({
        next: (res) => {
          const raw = Array.isArray(res) ? res : [];
          this.matchedProblems = raw.filter(p =>
            p.title?.toLowerCase().includes(query) ||
            p.difficulty?.toLowerCase().includes(query)
          ).slice(0, 5);
          checkLoading();
        },
        error: () => {
          this.matchedProblems = [];
          checkLoading();
        }
      });
    } else {
      this.matchedProblems = [];
    }

    // 3. Tìm trong Đề thi (BE)
    if (searchQuizzes) {
      this.http.get<any>('/api/quiz-sets').subscribe({
        next: (res) => {
          const list = res?.data || res || [];
          const rawList = Array.isArray(list) ? list : [];
          this.matchedQuizzes = rawList.filter(q =>
            q.title?.toLowerCase().includes(query) ||
            q.description?.toLowerCase().includes(query)
          ).slice(0, 5);
          checkLoading();
        },
        error: () => {
          this.matchedQuizzes = [];
          checkLoading();
        }
      });
    } else {
      this.matchedQuizzes = [];
    }

    // 4. Tìm trong Người dùng (BE)
    if (searchUsers) {
      this.http.get<any>('/api/admin/users', { params: { search: query, pageSize: '5' } }).subscribe({
        next: (res) => {
          const data = res?.data;
          const rawItems = data?.items || [];
          this.matchedUsers = Array.isArray(rawItems) ? rawItems : [];
          checkLoading();
        },
        error: () => {
          this.matchedUsers = [];
          checkLoading();
        }
      });
    } else {
      this.matchedUsers = [];
    }
  }

  clearSearch() {
    this.searchQuery = '';
    this.showSearchResults = false;
    this.searchLoading = false;
    this.matchedPages = [];
    this.matchedProblems = [];
    this.matchedQuizzes = [];
    this.matchedUsers = [];
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showSearchResults = false;
      this.cdr.detectChanges();
    }
  }

  toggleMobileSidebar() {
    this.mobileMenu.toggle();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear(); // Xóa sạch token, phiên làm việc cũ và biến quyền hạn
    this.router.navigate(['/login']);
  }
}
