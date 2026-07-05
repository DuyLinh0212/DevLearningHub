import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';
import { MobileMenuService } from '../../../core/services/mobile-menu.service';
import { NotificationService, NotificationItem } from '../../../core/services/notification.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
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
  public notificationService = inject(NotificationService);

  private routeSub?: Subscription;
  private notifRealtimeSub?: Subscription;

  profile = { displayName: '', avatarUrl: '', xpPoints: 0 };
  currentUserId = '';

  toastNotif: NotificationItem | null = null;
  private toastTimer?: ReturnType<typeof setTimeout>;

  isSearchOpen = false;
  isProfileOpen = false;
  isNotifOpen = false;
  searchQuery = '';
  searchLoading = false;
  matchedPages: any[] = [];
  matchedQuizzes: any[] = [];
  matchedPosts: any[] = [];
  showSearchResults = false;

  notifications: NotificationItem[] = [];
  selectedNotif: NotificationItem | null = null;
  notifLoading = false;
  notifError = false;
  notifPage = 1;
  notifTotalPages = 1;

  showSessionExpiredBanner = false;

  private profileUpdateHandler = () => this.loadProfile();
  private sessionExpiredHandler = () => {
    this.showSessionExpiredBanner = true;
    this.cdr.detectChanges();
  };

  readonly navItems = [
    { label: 'Tổng quan',   path: '/dashboard',          icon: 'bi-grid-1x2' },
    { label: 'Quiz',        path: '/quiz-bank',          icon: 'bi-collection' },    { label: 'Diễn đàn',   path: '/forum',              icon: 'bi-people' },
    { label: 'Code',        path: '/code',               icon: 'bi-code-slash' },
    { label: 'Bảng xếp hạng', path: '/leaderboard',    icon: 'bi-trophy' },
  ];

  readonly pagesList = [
    { name: 'Tổng quan',       path: '/dashboard',       icon: 'bi bi-grid-1x2' },
    { name: 'Kho Bộ đề',       path: '/quiz-bank',       icon: 'bi bi-collection' },    { name: 'Phân tích năng lực', path: '/dashboard/progress', icon: 'bi bi-bar-chart-line-fill' },
    { name: 'Code',             path: '/code',            icon: 'bi bi-code-slash' },
    { name: 'Diễn đàn',        path: '/forum',           icon: 'bi bi-people' },
    { name: 'Bảng xếp hạng',   path: '/leaderboard',    icon: 'bi bi-trophy' },
    { name: 'Cài đặt',         path: '/settings',        icon: 'bi bi-gear' },
  ];

  get isMobileOpen() { return this.mobileMenu.isOpen(); }

  ngOnInit() {
    this.loadProfile();
    this.notificationService.loadUnreadCount();
    this.notificationService.connectRealtime();
    this.notifRealtimeSub = this.notificationService.newNotification$.subscribe(notif => {
      this.showToast(notif);
      if (this.isNotifOpen) {
        this.notifications = [
          notif,
          ...this.notifications.filter(existing => existing.id !== notif.id)
        ];
      }
      this.cdr.detectChanges();
    });
    window.addEventListener('profile-updated', this.profileUpdateHandler);
    window.addEventListener('session-expired', this.sessionExpiredHandler);
    this.routeSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      this.isSearchOpen = false;
      this.isProfileOpen = false;
      this.isNotifOpen = false;
      this.selectedNotif = null;
      this.clearSearch();
      this.mobileMenu.close();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.notifRealtimeSub?.unsubscribe();
    clearTimeout(this.toastTimer);
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
    window.removeEventListener('session-expired', this.sessionExpiredHandler);
  }

  showToast(notif: NotificationItem) {
    this.toastNotif = notif;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastNotif = null;
      this.cdr.detectChanges();
    }, 5000);
  }

  dismissToast() {
    clearTimeout(this.toastTimer);
    this.toastNotif = null;
    this.cdr.detectChanges();
  }

  private loadProfile() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        if (!u) return;
        this.profile = {
          displayName: u.fullName || u.username || 'Hoc vien',
          avatarUrl: u.avatarUrl || '',
          xpPoints: u.xpPoints || 0,
        };
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
    this.isNotifOpen = false;
    this.cdr.detectChanges();
  }

  toggleNotif() {
    this.isNotifOpen = !this.isNotifOpen;
    this.isProfileOpen = false;
    this.isSearchOpen = false;
    if (this.isNotifOpen) {
      this.selectedNotif = null;
      this.loadNotifications();
    }
    this.cdr.detectChanges();
  }

  loadNotifications() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.notifLoading = true;
    this.notifError = false;
    this.cdr.detectChanges();
    this.notificationService.getNotifications(1, 20).subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.notifications = data?.items || [];
        this.selectedNotif = null;
        this.notifTotalPages = data?.totalPages ?? 1;
        this.notifPage = 1;
        const unread = data?.unreadCount ?? 0;
        this.notificationService.unreadCount.set(unread);
        this.notifLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Topbar] Failed to load notifications:', err);
        this.notifications = [];
        this.notifLoading = false;
        this.notifError = true;
        this.cdr.detectChanges();
      }
    });
  }

  markNotifRead(notif: NotificationItem, event: Event) {
    event.stopPropagation();
    if (notif.isRead) return;
    this.notificationService.markAsRead(notif.id).subscribe({
      next: () => {
        notif.isRead = true;
        this.cdr.detectChanges();
      }
    });
  }

  openNotifDetail(notif: NotificationItem, event?: Event) {
    event?.stopPropagation();
    this.selectedNotif = this.selectedNotif?.id === notif.id ? null : notif;

    if (!notif.isRead) {
      this.notificationService.markAsRead(notif.id).subscribe({
        next: () => {
          notif.isRead = true;
          this.cdr.detectChanges();
        }
      });
    }

    this.cdr.detectChanges();
  }

  openNotifTarget(notif: NotificationItem, event: Event) {
    event.stopPropagation();
    const commands = this.getNotifRoute(notif);
    if (!commands) return;

    this.isNotifOpen = false;
    this.selectedNotif = null;
    this.router.navigate(commands);
  }

  markAllNotifRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
        this.selectedNotif = null;
        this.cdr.detectChanges();
      }
    });
  }

  deleteNotif(notif: NotificationItem, event: Event) {
    event.stopPropagation();
    this.notificationService.deleteNotification(notif.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notif.id);
        this.cdr.detectChanges();
      }
    });
  }

  getNotifIcon(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'comment': return 'bi-chat-left-text';
      case 'comment_reply': return 'bi-chat-left-text';
      case 'post_comment': return 'bi-chat-left-text';
      case 'content_reported': return 'bi-flag-fill';
      case 'post_deleted': return 'bi-trash-fill';
      case 'comment_deleted': return 'bi-trash-fill';
      case 'quiz_deleted': return 'bi-journal-x';
      case 'problem_deleted': return 'bi-code-square';
      case 'like': return 'bi-heart-fill';
      case 'follow': return 'bi-person-plus-fill';
      case 'submission': return 'bi-code-slash';
      case 'achievement': return 'bi-trophy-fill';
      default: return 'bi-bell-fill';
    }
  }

  canOpenNotifTarget(notif: NotificationItem): boolean {
    return !!this.getNotifRoute(notif);
  }

  private getNotifRoute(notif: NotificationItem): any[] | null {
    if (!notif.refId || !notif.refType) return null;

    switch (notif.refType.toLowerCase()) {
      case 'post':
      case 'comment':
        return ['/forum/post', notif.refId];
      case 'problem':
        return ['/code', notif.refId];
      case 'quiz_set':
        return ['/quiz', notif.refId];
      case 'question':
        return ['/quiz-create'];
      default:
        return null;
    }
  }

  getRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
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
      if (this.isNotifOpen) { this.isNotifOpen = false; }
      this.cdr.detectChanges();
    }
  }
}
