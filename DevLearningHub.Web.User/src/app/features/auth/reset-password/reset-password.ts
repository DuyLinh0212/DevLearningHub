import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPasswordComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  token = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMessage = 'Link không hợp lệ. Vui lòng yêu cầu đặt lại mật khẩu lại.';
    }
  }

  onSubmit() {
    if (this.isLoading) return;

    this.errorMessage = '';

    if (!this.newPassword || this.newPassword.length < 6) {
      this.errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự!';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Xác nhận mật khẩu không khớp!';
      return;
    }

    this.isLoading = true;

    this.http.post<any>('/api/auth/reset-password', { token: this.token, newPassword: this.newPassword }).pipe(
      finalize(() => { this.isLoading = false; this.cdr.detectChanges(); })
    ).subscribe({
      next: () => {
        this.successMessage = 'Mật khẩu đã được đặt lại thành công!';
        setTimeout(() => this.router.navigate(['/login']), 2500);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Token không hợp lệ hoặc đã hết hạn.';
        this.cdr.detectChanges();
      }
    });
  }
}
