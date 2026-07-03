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
    this.showPopup('Quên mật khẩu', 'Vui lòng liên hệ Admin của hệ thống để được hỗ trợ cấp lại mật khẩu!', 'info');
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
    this.cdr.detectChanges();
  }

  onLogin() {
    if (this.isLoading) {
      return;
    }

    console.log('=== BẮT ĐẦU TIẾN TRÌNH ĐĂNG NHẬP PHÂN HỆ USER ===');
    this.errorMessage = '';

    if (!this.usernameOrEmail.trim() || !this.password.trim()) {
      this.errorMessage = 'Vui lòng điền đầy đủ tên đăng nhập/email và mật khẩu!';
      return;
    }

    this.isLoading = true;

    const loginPayload = {
      usernameOrEmail: this.usernameOrEmail.trim(),
      password: this.password
    };

    console.log('Payload gửi lên api/auth/login:', loginPayload);

    this.authService.login(loginPayload).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        console.log('API phản hồi thành công:', res);
        
        const target = res?.data || res;
        const token = target?.accessToken || target?.token || '';
        
        if (token) {
          localStorage.setItem('accessToken', token);
          
          try {
            const payloadPart = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
            console.log('Dữ liệu Token sau giải mã:', decodedPayload);

            const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
            const roles = Array.isArray(roleClaim)
              ? roleClaim.map((r: string) => (r || '').toLowerCase())
              : [(roleClaim || '').toLowerCase()];

            const isStaff = roles.includes('admin') || roles.includes('moderator');

            if (isStaff) {
              const roleLabel = roles.includes('admin') ? 'Quản trị viên' : 'Kiểm duyệt viên';
              console.warn(`Phát hiện tài khoản ${roleLabel} cố truy cập phân hệ Học sinh!`);
              this.errorMessage = `Tài khoản ${roleLabel} không được phép truy cập cổng Học sinh. Vui lòng dùng cổng Quản trị!`;
              this.isLoading = false;

              localStorage.removeItem('accessToken');
              this.cdr.detectChanges();
              return;
            }
            this.router.navigate(['/dashboard']);
          } catch (e) {
            console.error('Lỗi phân tích quyền Token:', e);
            this.router.navigate(['/dashboard']);
          }
        } else {
          this.errorMessage = 'Đăng nhập thành công nhưng hệ thống không trả về Token định danh!';
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('=== API BÁO LỖI ĐĂNG NHẬP ===', err);
        
        this.errorMessage = err.error?.message || err.error?.Message || 'Tài khoản hoặc mật khẩu không chính xác!';
        this.cdr.detectChanges();
      }
    });
  }
}
