import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service'; 

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

  username = '';
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (!this.username.trim() && !this.email.trim()) {
      alert('Vui lòng nhập tên đăng nhập hoặc email!');
      return;
    }
    if (!this.password.trim()) {
      alert('Vui lòng nhập mật khẩu!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginPayload = {
      usernameOrEmail: this.email.trim() || this.username.trim(),
      password: this.password
    };

    this.authService.login(loginPayload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const target = res?.data || res;
        const token = target?.accessToken || target?.token || '';
        
        if (token) {
          localStorage.setItem('accessToken', token);
          
          try {
            const payloadPart = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
            const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
            const isAdmin = Array.isArray(roleClaim) 
              ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') 
              : roleClaim?.toLowerCase() === 'admin';            
            alert('Đăng nhập thành công!');
            if (isAdmin) {
              this.router.navigate(['/admin']);
            } else {
              this.router.navigate(['/dashboard']);
            }
          } catch (e) {
            alert('Đăng nhập thành công!');
            this.router.navigate(['/dashboard']);
          }
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Đăng nhập thất bại!';
        alert(this.errorMessage);
      }
    });
  }
}