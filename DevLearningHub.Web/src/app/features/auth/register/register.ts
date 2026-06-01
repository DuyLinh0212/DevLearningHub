import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  private router = inject(Router);
  private http = inject(HttpClient);

  fullName = '';
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onRegister() {
    if (!this.fullName.trim() || !this.username.trim() || !this.email.trim() || !this.password.trim()) {
      alert('Vui lòng điền đầy đủ toàn bộ thông tin đăng ký!');
      return;
    }

    if (this.password !== this.confirmPassword) {
      alert('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const registerPayload = {
      username: this.username.trim(),
      email: this.email.trim(),
      password: this.password,
      fullName: this.fullName.trim()
    };

    this.http.post('/api/auth/register', registerPayload).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Đăng ký tài khoản học viên thành công!');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Đăng ký thất bại!';
        alert(this.errorMessage);
      }
    });
  }
}