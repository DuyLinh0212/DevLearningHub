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
    avatarUrl: ''
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
    { name: 'Quản lý Lộ trình', path: '/admin/roadmap', icon: 'bi bi-bezier2' },
    { name: 'Quản lý Chủ đề', path: '/admin/topics', icon: 'bi bi-tags-fill' },
    { name: 'Quản lý Tag', path: '/admin/tags', icon: 'bi bi-tag-fill' },
    { name: 'Quản lý Bài viết', path: '/admin/posts', icon: 'bi bi-newspaper' },
    { name: 'Quản lý Người dùng', path: '/admin/users', icon: 'bi bi-people-fill' },
    { name: 'Logs hệ thống', path: '/admin/audit-logs', icon: 'bi bi-terminal-fill' },
    { name: 'Cài đặt', path: '/settings', icon: 'bi bi-gear' }
  ];

  private profileUpdateHandler = () => this.loadUserProfile();

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    // Tự động thu hồi Sidebar về vị trí ẩn khi Admin bấm chuyển trang thành công trên điện thoại
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

  loadUserProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) return;

        this.profile = {
          displayName: user.username || user.fullName || 'Quản trị viên',
          username: user.username || '',
          email: user.email || '',
          avatarUrl: user.avatarUrl || ''
        };
        this.cdr.detectChanges();
      },
      error: () => {
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

    // 1. Tìm trong Chức năng (Local)
    this.matchedPages = this.pagesList.filter(p => p.name.toLowerCase().includes(query));

    let activeRequests = 3;

    const checkLoading = () => {
      activeRequests--;
      if (activeRequests <= 0) {
        this.searchLoading = false;
      }
      this.cdr.detectChanges();
    };

    // 2. Tìm trong Bài tập code (BE)
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

    // 3. Tìm trong Đề thi (BE)
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

    // 4. Tìm trong Người dùng (BE)
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
