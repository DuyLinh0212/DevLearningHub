import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service'; 
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
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
    this.showPopup('Quên mật khẩu', 'Vui lòng liên hệ quản lý hệ thống hoặc bộ phận CNTT để được cấp lại mật khẩu truy cập cổng Quản trị!', 'info');
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

            if (!isAdminOrModerator) {
              this.errorMessage = 'Bạn không có quyền truy cập cổng Quản trị!';
              localStorage.removeItem('accessToken');
              this.cdr.detectChanges();
              return;
            }
            const roles = Array.isArray(roleClaim)
              ? roleClaim.map((r: string) => r.toLowerCase())
              : [ (roleClaim || '').toLowerCase() ];

            if (roles.includes('moderator') && !roles.includes('admin')) {
              this.router.navigate(['/admin/moderator-dashboard']);
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




