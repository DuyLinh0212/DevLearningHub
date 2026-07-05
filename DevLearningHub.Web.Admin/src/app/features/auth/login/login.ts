import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  usernameOrEmail = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;

  popupMessage = '';
  popupTitle = '';
  popupType = 'info';

  onForgotPassword(event: Event) {
    event.preventDefault();
    this.router.navigate(['/forgot-password']);
  }

  showPopup(title: string, message: string, type: 'success' | 'error' | 'info') {
    this.popupTitle = title;
    this.popupMessage = message;
    this.popupType = type;
    this.cdr.detectChanges();
  }

  closePopup() {
    this.popupMessage = '';
    this.cdr.detectChanges();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (this.isLoading) {
      return;
    }

    if (!this.usernameOrEmail.trim() || !this.password.trim()) {
      this.errorMessage = 'Vui lòng điền đầy đủ thông tin!';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginPayload = {
      usernameOrEmail: this.usernameOrEmail.trim(),
      password: this.password
    };

    this.authService.login(loginPayload).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const target = res?.data || res;
        const token = target?.accessToken || target?.token || res?.accessToken || res?.token || '';
        
        if (token) {
          localStorage.setItem('accessToken', token);
          
          try {
            const payloadPart = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));

            const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
            const isAdminOrModerator = Array.isArray(roleClaim)
              ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') ||
                roleClaim.map((r: string) => r.toLowerCase()).includes('moderator')
              : ['admin', 'moderator'].includes((roleClaim || '').toLowerCase());

            // Also check for admin:access permission (allows non-Admin/Moderator roles to access admin panel)
            const permClaim = decodedPayload['permission'];
            const permList: string[] = Array.isArray(permClaim)
              ? permClaim
              : (permClaim ? [permClaim] : []);
            const hasAdminAccess = permList.some((p: string) =>
              p.toLowerCase() === 'admin:access' || p.toLowerCase() === 'system.full_control'
            );

            if (!isAdminOrModerator && !hasAdminAccess) {
              this.errorMessage = 'Ban khong co quyen truy cap cong Quan tri!';
              localStorage.removeItem('accessToken');
              this.cdr.detectChanges();
              return;
            }
            const roles = Array.isArray(roleClaim)
              ? roleClaim.map((r: string) => r.toLowerCase())
              : [ (roleClaim || '').toLowerCase() ];

            // Admin goes to main admin dashboard.
            if (roles.includes('admin')) {
              this.router.navigate(['/admin']);
              return;
            }

            // Moderator role (legacy) goes to moderator dashboard.
            if (roles.includes('moderator')) {
              this.router.navigate(['/admin/moderator-dashboard']);
              return;
            }

            // Non-admin, non-moderator with admin:access: check if they have review
            // permissions to route them to the appropriate dashboard.
            const reviewPerms = ['post:review', 'problem:review', 'quiz:review', 'problem_bank:review', 'roadmap:review'];
            const hasReviewPerms = reviewPerms.some(rp =>
              permList.some((p: string) => p.toLowerCase() === rp)
            );
            if (hasReviewPerms) {
              this.router.navigate(['/admin/moderation']);
            } else {
              this.router.navigate(['/admin']);
            }
            
          } catch (e) {
            this.errorMessage = 'Không đọc được vai trò từ token. Phiên đăng nhập vẫn được giữ lại.';
            this.router.navigate(['/dashboard']);
            this.cdr.detectChanges();
          }
        } else {
          this.errorMessage = 'Hệ thống không trả về accessToken.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || err.error?.data?.message || 'Đăng nhập thất bại!';
        this.cdr.detectChanges();
      }
    });
  }
}




