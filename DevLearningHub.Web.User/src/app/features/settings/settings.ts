import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})
export class SettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  firstName: string = '';
  lastName: string = '';
  email: string = '';
  role: string = 'Học viên';
  avatarUrl: string = '';
  xpPoints: number = 0; // Thêm biến hứng điểm XP cho Học viên
  isSaving: boolean = false;

  ngOnInit() {
    this.loadUserProfile();
  }

loadUserProfile() {
  console.log('=== SETTINGS USER: TẢI HỒ SƠ HỌC VIÊN VÀ GIẢI MÃ TOKEN PHÒNG THỦ ===');
  
  this.http.get<any>('/api/users/me').subscribe({
    next: (res) => {
      const user = res?.data || res;
      if (user) {
        this.email = user.email || '';
        this.avatarUrl = user.avatarUrl || 'assets/images/default-avatar.svg';
        this.xpPoints = user.xpPoints || 0;
        
        const rawRoles = user.roles || [];
        let isAdmin = rawRoles.some((r: string) => r.toLowerCase() === 'admin') || user.role?.toLowerCase() === 'admin';
        
        if (!isAdmin) {
          try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
            if (token) {
              const payloadPart = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
              
              const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
              if (Array.isArray(roleClaim)) {
                isAdmin = roleClaim.map((r: string) => r.toLowerCase()).includes('admin');
              } else if (roleClaim) {
                isAdmin = roleClaim.toLowerCase() === 'admin';
              }
            }
          } catch (tokenError) {
            console.error('Lỗi giải mã token dưới local phân hệ User:', tokenError);
          }
        }

        this.role = isAdmin ? 'Quản trị viên' : 'Học viên';
        
        if (user.fullName) {
          const fullName = user.fullName.trim();
          const nameParts = fullName.split(' ');
          this.firstName = nameParts.pop() || '';
          this.lastName = nameParts.join(' ');
        }
        
        this.cdr.detectChanges();
      }
    },
    error: (err) => {
      console.error('Không thể tải hồ sơ Học viên từ API:', err);
      this.role = 'Học viên';
      this.cdr.detectChanges();
    }
  });
}

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;

    const combinedFullName = `${this.lastName.trim()} ${this.firstName.trim()}`.trim();

    const updatePayload = {
      fullName: combinedFullName,
      avatarUrl: this.avatarUrl
    };

    this.http.put<any>('/api/users/me', updatePayload).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Cập nhật hồ sơ thành công!');
        this.loadUserProfile();
      },
      error: (err) => {
        this.isSaving = false;
        alert(`Lưu thất bại! (Mã lỗi: ${err.status})`);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Dung lượng ảnh không được vượt quá 2MB!');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarUrl = e.target.result;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }
}