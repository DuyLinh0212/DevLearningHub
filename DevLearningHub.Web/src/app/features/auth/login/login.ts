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

  username: string = '';
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;

  onLogin() {
    if ((!this.username.trim() && !this.email.trim()) || !this.password.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin đăng nhập!');
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
        
        const token = res.token || res.data?.token;
        if (token) {
          localStorage.setItem('accessToken', token);
        }
        
        alert('Đăng nhập thành công!');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản!';
        alert(this.errorMessage);
      }
    });
  }
}