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
    avatarUrl: ''
  };

  private profileUpdateHandler = () => this.loadUserProfile();

  ngOnInit() {
    this.loadUserProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);

    // Tự động thu hồi Sidebar về vị trí ẩn khi Admin bấm chuyển trang thành công trên điện thoại
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
          displayName: user.fullName || user.username || 'Quản trị viên',
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
    localStorage.clear(); // Xóa sạch token, phiên làm việc cũ và biến quyền hạn
    this.router.navigate(['/login']);
  }
}