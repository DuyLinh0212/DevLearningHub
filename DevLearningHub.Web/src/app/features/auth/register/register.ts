import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterComponent {
  private router = inject(Router);
  private authService = inject(AuthService);

  // Các biến này phải khớp với [(ngModel)] bên file register.html
  fullName = '';
  username = '';
  email = '';
  password = '';
  confirmPassword = '';

  errorMessage = '';
  isLoading = false;

  onRegister() {
    // 1. Kiểm tra dữ liệu rỗng
    if (!this.fullName.trim() || !this.username.trim() || !this.email.trim() || !this.password) {
      this.errorMessage = 'Vui lòng điền đầy đủ thông tin!';
      return;
    }

    // 2. Kiểm tra mật khẩu khớp nhau
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Mật khẩu xác nhận không trùng khớp!';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    // 3. Tạo Payload để gửi lên Backend
    const payload = {
      fullName: this.fullName.trim(),
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password
    };

    // 4. Gọi Service
    this.authService.register(payload).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Đăng ký tài khoản thành công!');
        this.router.navigate(['/login']); // Điều hướng về login
      },
      error: (err) => {
        this.isLoading = false;
        // Bắt lỗi từ Backend trả về
        this.errorMessage = err.error?.message || 'Đăng ký thất bại, thử lại nhé!';
      }
    });
  }
}
