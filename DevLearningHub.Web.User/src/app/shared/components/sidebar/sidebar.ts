import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private routeSubscription?: Subscription;
  private profileUpdateHandler = () => this.loadUserProfile();

  isMobileOpen: boolean = false;
  profile = {
    displayName: 'Học viên',
    email: '',
    avatarUrl: '',
    xpPoints: 0
  };

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    this.routeSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isMobileOpen = false;
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

  onSidebarSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input && input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value.trim() } });
      input.value = '';
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
