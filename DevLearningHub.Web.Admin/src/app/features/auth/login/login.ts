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
            const responseRoles = target?.user?.roles || target?.user?.Roles || res?.data?.user?.roles || res?.data?.user?.Roles || [];
            const isAdminFromToken = Array.isArray(roleClaim)
              ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin')
              : roleClaim?.toLowerCase() === 'admin';
            const isAdminFromBody = Array.isArray(responseRoles)
              ? responseRoles.map((r: string) => String(r).toLowerCase()).includes('admin')
              : String(responseRoles || '').toLowerCase() === 'admin';
            const isAdmin = isAdminFromToken || isAdminFromBody;            
            
            if (!isAdmin) {
              this.errorMessage = 'Tài khoản này không có quyền Admin. Bạn sẽ được giữ phiên đăng nhập để dùng khu vực user.';
              this.router.navigate(['/dashboard']);
              this.cdr.detectChanges();
              return;
            }

            this.router.navigate(['/admin']);
            
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




