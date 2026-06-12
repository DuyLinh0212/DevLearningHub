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
  role: string = 'Học viên'; // Mặc định vì API /me của Nam không trả về cột role công khai
  avatarUrl: string = '';
  isSaving: boolean = false;

  ngOnInit() {
    this.loadUserProfile();
  }

loadUserProfile() {
  console.log('=== SETTINGS ADMIN: BẮT ĐẦU TẢI HỒ SƠ VÀ GIẢI MÃ TOKEN PHÒNG THỦ ===');
  
  this.http.get<any>('/api/users/me').subscribe({
    next: (res) => {
      const user = res?.data || res;
      if (user) {
        this.email = user.email || '';
        this.avatarUrl = user.avatarUrl || 'assets/images/default-avatar.svg';
        
        const rawRoles = user.roles || [];
        let isAdmin = rawRoles.some((r: string) => r.toLowerCase() === 'admin') || user.role?.toLowerCase() === 'admin';
        
        if (!isAdmin) {
          try {
            const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
            if (token) {
              const payloadPart = token.split('.')[1];
              const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
              
              console.log('=== ĐÃ ĐỌC NGƯỢC PAYLOAD TOKEN THÀNH CÔNG ===', decodedPayload);
              
              const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
              
              if (Array.isArray(roleClaim)) {
                isAdmin = roleClaim.map((r: string) => r.toLowerCase()).includes('admin');
              } else if (roleClaim) {
                isAdmin = roleClaim.toLowerCase() === 'admin';
              }
            }
          } catch (tokenError) {
            console.error('Lỗi giải mã accessToken dưới localStorage:', tokenError);
          }
        }

        this.role = (isAdmin || !user.roles) ? 'Quản trị viên' : 'Học viên';
        
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
      console.error('Không thể lấy thông tin cá nhân Admin từ API:', err);
      this.role = 'Quản trị viên';
      this.cdr.detectChanges();
    }
  });
}

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;

    const combinedFullName = `${this.lastName.trim()} ${this.firstName.trim()}`.trim();

    // PAYLOAD ĐÓNG GÓI CHUẨN ĐÉT THEO SCHEMA PUT /API/USERS/ME (CHỈ CÓ FULLNAME & AVATARURL)
    const updatePayload = {
      fullName: combinedFullName,
      avatarUrl: this.avatarUrl
    };

    console.log('=== SETTINGS: PAYLOAD CẬP NHẬT HỒ SƠ ===', updatePayload);

    this.http.put<any>('/api/users/me', updatePayload).subscribe({
      next: () => {
        this.isSaving = false;
        alert('Cập nhật hồ sơ cá nhân thành công!');
        this.loadUserProfile();
      },
      error: (err) => {
        this.isSaving = false;
        alert(`Lưu cấu hình thất bại! (Mã lỗi hệ thống: ${err.status})`);
        console.error(err);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Dung lượng ảnh đại diện không được vượt quá 2MB!');
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