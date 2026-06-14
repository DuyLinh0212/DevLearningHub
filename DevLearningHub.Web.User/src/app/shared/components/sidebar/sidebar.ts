import { Component, inject, OnDestroy, OnInit, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private elementRef = inject(ElementRef);
  private routeSubscription?: Subscription;
  private profileUpdateHandler = () => this.loadUserProfile();

  isMobileOpen: boolean = false;
  profile = {
    displayName: 'Học viên',
    email: '',
    avatarUrl: '',
    xpPoints: 0
  };

  // Trạng thái tìm kiếm toàn cục
  searchQuery: string = '';
  showSearchResults: boolean = false;
  searchLoading: boolean = false;
  
  matchedPages: any[] = [];
  matchedQuizzes: any[] = [];
  matchedPosts: any[] = [];

  pagesList = [
    { name: 'Tổng quan', path: '/dashboard', icon: 'bi bi-grid-1x2' },
    { name: 'Kho Bộ đề', path: '/quiz-bank', icon: 'bi bi-collection' },
    { name: 'Lộ trình học', path: '/roadmap', icon: 'bi bi-bezier2' },
    { name: 'Phân tích năng lực', path: '/dashboard/progress', icon: 'bi bi-bar-chart-line-fill' },
    { name: 'Code', path: '/code', icon: 'bi bi-code-slash' },
    { name: 'Diễn đàn', path: '/forum', icon: 'bi bi-people' },
    { name: 'Bảng xếp hạng', path: '/leaderboard', icon: 'bi bi-star' },
    { name: 'Thông báo', path: '/notifications', icon: 'bi bi-bell' },
    { name: 'Cài đặt', path: '/settings', icon: 'bi bi-gear' }
  ];

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    this.routeSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isMobileOpen = false;
      this.clearSearch();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.routeSubscription?.unsubscribe();
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
  }

  toggleMobileSidebar() {
    this.isMobileOpen = !this.isMobileOpen;
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
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

    // 1. Tìm trong Chức năng
    this.matchedPages = this.pagesList.filter(p => p.name.toLowerCase().includes(query));

    let activeRequests = 2;

    // 2. Tìm trong Bộ đề
    this.http.get<any>('/api/quiz-sets').subscribe({
      next: (res) => {
        const list = res?.data || res || [];
        const rawList = Array.isArray(list) ? list : [];
        this.matchedQuizzes = rawList.filter((q: any) =>
          q.title?.toLowerCase().includes(query) ||
          q.description?.toLowerCase().includes(query)
        ).slice(0, 5);
        
        activeRequests--;
        if (activeRequests <= 0) this.searchLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.matchedQuizzes = [];
        activeRequests--;
        if (activeRequests <= 0) this.searchLoading = false;
        this.cdr.detectChanges();
      }
    });

    // 3. Tìm trong Diễn đàn
    this.http.get<any>('/api/posts', { params: { search: query } }).subscribe({
      next: (res) => {
        const data = res?.data || res;
        const rawItems = data?.items || data || [];
        this.matchedPosts = Array.isArray(rawItems) ? rawItems.slice(0, 5) : [];
        
        activeRequests--;
        if (activeRequests <= 0) this.searchLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.matchedPosts = [];
        activeRequests--;
        if (activeRequests <= 0) this.searchLoading = false;
        this.cdr.detectChanges();
      }
    });
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

  getPlainExcerpt(markdown: string): string {
    if (!markdown) return '';
    const clean = markdown
      .replace(/#+\s+/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .trim();
    if (clean.length > 60) {
      return clean.substring(0, 60) + '...';
    }
    return clean;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.showSearchResults = false;
      this.cdr.detectChanges();
    }
  }

  private loadUserProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;

    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (!user) return;

        this.profile = {
          displayName: user.fullName || user.username || 'Học viên',
          email: user.email || '',
          avatarUrl: user.avatarUrl || '',
          xpPoints: user.xpPoints || 0
        };
        this.loadUserStats(user.id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  private loadUserStats(userId: string) {
    if (!userId) return;

    this.http.get<any>(`/api/users/${userId}/stats`).subscribe({
      next: (res) => {
        const stats = res?.data || res;
        this.profile = {
          ...this.profile,
          xpPoints: stats?.totalXP ?? this.profile.xpPoints
        };
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }
}
