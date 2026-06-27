import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.css'
})
export class AdminTopbarComponent implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private elementRef = inject(ElementRef);
  public mobileMenu = inject(MobileMenuService);

  private routeSub?: Subscription;

  profile = { displayName: 'Quản trị viên', avatarUrl: '', email: '' };
  currentUserId = '';
  userPermissions: string[] = [];
  userRoles: string[] = [];

  isSearchOpen = false;
  isProfileOpen = false;
  searchQuery = '';
  searchLoading = false;
  matchedPages: any[] = [];
  matchedQuizzes: any[] = [];
  matchedUsers: any[] = [];
  matchedProblems: any[] = [];
  showSearchResults = false;

  private profileUpdateHandler = () => this.loadProfile();

  readonly pagesList = [
    { name: 'Bảng điều phối', path: '/admin', icon: 'bi bi-speedometer2' },
    { name: 'Quản lý Đề thi', path: '/admin/quiz', icon: 'bi bi-database-fill' },
    { name: 'Quản lý Bài tập', path: '/admin/problems', icon: 'bi bi-cpu-fill' },
    { name: 'Quản lý Lộ trình', path: '/admin/roadmap', icon: 'bi bi-bezier2' },
    { name: 'Quản lý Chủ đề', path: '/admin/topics', icon: 'bi bi-tags-fill' },
    { name: 'Quản lý Tag', path: '/admin/tags', icon: 'bi bi-tag-fill' },
    { name: 'Quản lý Bài viết', path: '/admin/posts', icon: 'bi bi-newspaper' },
    { name: 'Quản lý Người dùng', path: '/admin/users', icon: 'bi bi-people-fill' },
    { name: 'Quản lý Moderator', path: '/admin/moderators', icon: 'bi bi-person-badge' },
    { name: 'Logs hệ thống', path: '/admin/audit-logs', icon: 'bi bi-terminal-fill' },
    { name: 'Cài đặt', path: '/settings', icon: 'bi bi-gear' }
  ];

  get isMobileOpen() { return this.mobileMenu.isOpen(); }

  hasRole(role: string): boolean {
    return this.userRoles.some(r => r.toLowerCase() === role.toLowerCase());
  }

  hasPermission(perm: string): boolean {
    return this.userPermissions.includes('system.full_control') || this.userPermissions.includes(perm);
  }

  ngOnInit() {
    this.loadProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);
    this.routeSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      this.isSearchOpen = false;
      this.isProfileOpen = false;
      this.clearSearch();
      this.mobileMenu.close();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
  }

  private loadProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        if (!u) return;
        this.profile = {
          displayName: u.fullName || u.username || 'Quản trị viên',
          avatarUrl: u.avatarUrl || '',
          email: u.email || ''
        };
        this.currentUserId = u.id || u.Id || '';
        this.userPermissions = u.permissions || [];
        this.userRoles = u.roles || [];
        this.cdr.detectChanges();
      }
    });
  }

  toggleSearch() {
    this.isSearchOpen = !this.isSearchOpen;
    this.isProfileOpen = false;
    if (this.isSearchOpen) {
      setTimeout(() => {
        const el = document.getElementById('admin-topbar-search-input');
        el?.focus();
      }, 50);
    } else {
      this.clearSearch();
    }
    this.cdr.detectChanges();
  }

  toggleProfile() {
    this.isProfileOpen = !this.isProfileOpen;
    this.isSearchOpen = false;
    this.cdr.detectChanges();
  }

  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.searchQuery = (event.target as HTMLInputElement).value;

    if (!query) { this.clearSearch(); return; }

    this.showSearchResults = true;
    this.searchLoading = true;
    this.matchedPages = this.pagesList.filter(p => p.name.toLowerCase().includes(query));

    let pending = 3;
    const done = () => { if (--pending <= 0) { this.searchLoading = false; this.cdr.detectChanges(); } };

    this.http.get<any>('/api/quiz-sets').subscribe({
      next: res => {
        const list: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.matchedQuizzes = list.filter((q: any) =>
          q.title?.toLowerCase().includes(query) || q.description?.toLowerCase().includes(query)
        ).slice(0, 4);
        done();
      },
      error: () => { this.matchedQuizzes = []; done(); }
    });

    this.http.get<any>('/api/admin/users', { params: { search: query, pageSize: '4' } }).subscribe({
      next: res => {
        const data = res?.data;
        this.matchedUsers = Array.isArray(data?.items) ? data.items : [];
        done();
      },
      error: () => { this.matchedUsers = []; done(); }
    });

    this.http.get<any[]>('/api/problems').subscribe({
      next: (res) => {
        const raw = Array.isArray(res) ? res : [];
        this.matchedProblems = raw.filter(p =>
          p.title?.toLowerCase().includes(query)
        ).slice(0, 4);
        done();
      },
      error: () => { this.matchedProblems = []; done(); }
    });

    this.cdr.detectChanges();
  }

  clearSearch() {
    this.searchQuery = '';
    this.showSearchResults = false;
    this.searchLoading = false;
    this.matchedPages = [];
    this.matchedQuizzes = [];
    this.matchedUsers = [];
    this.matchedProblems = [];
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(e.target)) {
      if (this.isSearchOpen) { this.isSearchOpen = false; this.clearSearch(); }
      if (this.isProfileOpen) { this.isProfileOpen = false; }
      this.cdr.detectChanges();
    }
  }
}
