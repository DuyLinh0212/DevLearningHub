import { Component, inject, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
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
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  public mobileMenu = inject(MobileMenuService);
  private routeSub?: Subscription;

  get isMobileOpen(): boolean { return this.mobileMenu.isOpen(); }

  userPermissions: string[] = [];

  hasPermission(perm: string): boolean {
    return this.userPermissions.includes('system.full_control') || this.userPermissions.includes(perm);
  }

  ngOnInit() {
    this.loadPermissions();
    this.routeSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      this.mobileMenu.close();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  toggleMobileSidebar() {
    this.mobileMenu.toggle();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }

  private loadPermissions() {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        this.userPermissions = u?.permissions || [];
        this.cdr.detectChanges();
      }
    });
  }
}
