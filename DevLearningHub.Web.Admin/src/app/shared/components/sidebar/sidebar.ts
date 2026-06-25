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
  
  /** Getter Ä‘á»ƒ template váº«n Ä‘á»c Ä‘Æ°á»£c isMobileOpen nhÆ° cÅ© */
  get isMobileOpen(): boolean { return this.mobileMenu.isOpen(); }

  profile = {
    displayName: 'Quản trị viên',
    username: '',
    email: '',
    avatarUrl: ''
  };

  private profileUpdateHandler = () => this.loadUserProfile();

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    // Tá»± Ä‘á»™ng thu há»“i Sidebar vá» vá»‹ trÃ­ áº©n khi Admin báº¥m chuyá»ƒn trang thÃ nh cÃ´ng trÃªn Ä‘iá»‡n thoáº¡i
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

  toggleMobileSidebar() {
    this.mobileMenu.toggle();
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear(); // XÃ³a sáº¡ch token, phiÃªn lÃ m viá»‡c cÅ© vÃ  biáº¿n quyá»n háº¡n
    this.router.navigate(['/login']);
  }
}
