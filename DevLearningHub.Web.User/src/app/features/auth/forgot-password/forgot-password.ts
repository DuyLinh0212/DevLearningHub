import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPasswordComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  email = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  onSubmit() {
    if (this.isLoading) return;

    this.successMessage = '';
    this.errorMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Vui lòng nhập địa chỉ email!';
      return;
    }

    this.isLoading = true;

    this.http.post<any>('/api/auth/forgot-password', { email: this.email.trim() }).pipe(
      finalize(() => { this.isLoading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: () => {
        this.successMessage = 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.';
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Có lỗi xảy ra. Vui lòng thử lại sau.';
        this.cdr.detectChanges();
      }
    });
  }
}
