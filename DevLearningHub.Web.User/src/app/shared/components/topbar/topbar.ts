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
export class TopbarComponent implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private elementRef = inject(ElementRef);
  public mobileMenu = inject(MobileMenuService);

  private routeSub?: Subscription;

  profile = { displayName: '', avatarUrl: '', xpPoints: 0 };
  userPermissions: string[] = [];
  currentUserId = '';

  isSearchOpen = false;
  isProfileOpen = false;
  searchQuery = '';
  searchLoading = false;
  matchedPages: any[] = [];
  matchedQuizzes: any[] = [];
  matchedPosts: any[] = [];
  showSearchResults = false;

  private profileUpdateHandler = () => this.loadProfile();

  readonly navItems = [
    { label: 'Tổng quan',   path: '/dashboard',          icon: 'bi-grid-1x2' },
    { label: 'Quiz',        path: '/quiz-bank',          icon: 'bi-collection' },
    { label: 'Lộ trình',   path: '/roadmap',            icon: 'bi-bezier2' },
    { label: 'Diễn đàn',   path: '/forum',              icon: 'bi-people' },
    { label: 'Code',        path: '/code',               icon: 'bi-code-slash' },
    { label: 'Bảng xếp hạng', path: '/leaderboard',    icon: 'bi-trophy' },
  ];

  readonly pagesList = [
    { name: 'Tổng quan',       path: '/dashboard',       icon: 'bi bi-grid-1x2' },
    { name: 'Kho Bộ đề',       path: '/quiz-bank',       icon: 'bi bi-collection' },
    { name: 'Lộ trình học',    path: '/roadmap',         icon: 'bi bi-bezier2' },
    { name: 'Phân tích năng lực', path: '/dashboard/progress', icon: 'bi bi-bar-chart-line-fill' },
    { name: 'Code',             path: '/code',            icon: 'bi bi-code-slash' },
    { name: 'Diễn đàn',        path: '/forum',           icon: 'bi bi-people' },
    { name: 'Bảng xếp hạng',   path: '/leaderboard',    icon: 'bi bi-trophy' },
    { name: 'Cài đặt',         path: '/settings',        icon: 'bi bi-gear' },
  ];

  get isMobileOpen() { return this.mobileMenu.isOpen(); }

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
          displayName: u.fullName || u.username || 'Học viên',
          avatarUrl: u.avatarUrl || '',
          xpPoints: u.xpPoints || 0,
        };
        this.userPermissions = u.permissions || [];
        this.currentUserId = (u.id || '').toString().toLowerCase();
        this.cdr.detectChanges();
      }
    });
  }

  toggleSearch() {
    this.isSearchOpen = !this.isSearchOpen;
    this.isProfileOpen = false;
    if (this.isSearchOpen) {
      setTimeout(() => {
        const el = document.getElementById('topbar-search-input');
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

    let pending = 2;
    const done = () => { if (--pending <= 0) { this.searchLoading = false; this.cdr.detectChanges(); } };

    this.http.get<any>('/api/quiz-sets').subscribe({
      next: res => {
        const list: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        this.matchedQuizzes = list.filter((q: any) =>
          q.title?.toLowerCase().includes(query) || q.description?.toLowerCase().includes(query)
        ).slice(0, 5);
        done();
      },
      error: () => { this.matchedQuizzes = []; done(); }
    });

    this.http.get<any>('/api/posts', { params: { search: query } }).subscribe({
      next: res => {
        const data = res?.data || res;
        const items: any[] = data?.items || data || [];
        this.matchedPosts = Array.isArray(items) ? items.slice(0, 5) : [];
        done();
      },
      error: () => { this.matchedPosts = []; done(); }
    });

    this.cdr.detectChanges();
  }

  clearSearch() {
    this.searchQuery = '';
    this.showSearchResults = false;
    this.searchLoading = false;
    this.matchedPages = [];
    this.matchedQuizzes = [];
    this.matchedPosts = [];
    this.cdr.detectChanges();
  }

  getPlainExcerpt(md: string): string {
    if (!md) return '';
    return md.replace(/#+\s+/g, '').replace(/```[\s\S]*?```/g, '').replace(/`([^`]+)`/g, '$1')
             .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim().substring(0, 60) + '...';
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
