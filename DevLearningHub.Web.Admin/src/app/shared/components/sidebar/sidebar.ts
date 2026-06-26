import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public themeService = inject(ThemeService);
  private http = inject(HttpClient);
  public mobileMenu = inject(MobileMenuService);
  
  /** Getter để template vẫn đọc được isMobileOpen như cũ */
  get isMobileOpen(): boolean { return this.mobileMenu.isOpen(); }

  profile = {
    displayName: 'Quản trị viên',
    email: '',
    avatarUrl: '',
    roles: [] as string[],
    permissions: [] as string[]
  };

  private profileUpdateHandler = () => this.loadUserProfile();

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.mobileMenu.close();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
  }

  hasRole(role: string): boolean {
    if (!role) return false;
    const target = role.toLowerCase();

    // First: check from token (fast, always available after login)
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (token) {
      try {
        const payloadPart = token.split('.')[1];
        const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
        const roleClaim = decoded['role'] || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
        const roles = Array.isArray(roleClaim)
          ? roleClaim.map((r: string) => r.toLowerCase())
          : [roleClaim?.toLowerCase()];
        if (roles.some(r => r === target)) {
          return true;
        }
      } catch (e) {
        console.error('Error decoding token in hasRole:', e);
      }
    }

    // Fallback: check from profile (after API load)
    return this.profile.roles?.some(r => r.toLowerCase() === target) || false;
  }

  hasPermission(permission: string): boolean {
    if (!permission) return false;
    const target = permission.toLowerCase();

    // Check from profile permissions (loaded from API)
    if (this.profile.permissions?.some(p => p.toLowerCase() === target)) {
      return true;
    }

    // Fallback: check token
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return false;

    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const permissions = decoded['permissions'] || [];
      if (Array.isArray(permissions)) {
        return permissions.some(p => p.toLowerCase() === target) ||
               permissions.includes('system.full_control');
      }
    } catch (e) {
      console.error('Error checking permission:', e);
    }
    return false;
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

  toggleMobileSidebar() {
    this.mobileMenu.toggle();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear(); // Xóa sạch token, phiên làm việc cũ và biến quyền hạn
    this.router.navigate(['/login']);
  }
}