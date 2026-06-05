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

  usernameOrEmail = '';
  password = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    console.log('=== BẮT ĐẦU TIẾN TRÌNH ĐĂNG NHẬP ===');
    console.log('Dữ liệu gõ trên Form:', { usernameOrEmail: this.usernameOrEmail, password: this.password });

    if (!this.usernameOrEmail.trim() || !this.password.trim()) {
      alert('Vui lòng điền đầy đủ thông tin!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginPayload = {
      usernameOrEmail: this.usernameOrEmail.trim(),
      password: this.password
    };

    console.log('Payload cấu trúc chuẩn gửi lên API:', loginPayload);

    this.authService.login(loginPayload).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        console.log('API phản hồi THÀNH CÔNG (Next):', res);
        
        const target = res?.data || res;
        const token = target?.accessToken || target?.token || '';
        
        if (token) {
          localStorage.setItem('accessToken', token);
          console.log('Đã lưu Token vào tài sản máy:', token);
          
          try {
            const payloadPart = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
            console.log('Dữ liệu Token giải mã quyền:', decodedPayload);

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
            console.error('Lỗi giải mã Token:', e);
            this.router.navigate(['/dashboard']);
          }
        } else {
          console.warn('Không tìm thấy chuỗi Token trong data trả về!');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('=== API BÁO LỖI ĐĂNG NHẬP ===', err);
        console.log('Mã lỗi HTTP Status:', err.status);
        console.log('Chi tiết lỗi từ Server trả về:', err.error);
        
        this.errorMessage = err.error?.message || 'Đăng nhập thất bại!';
        alert(this.errorMessage);
      }
    });
  }
}