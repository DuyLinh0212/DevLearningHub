import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  activeTab: string = 'dashboard';
  searchText: string = '';
  selectedLogLevel: string = 'ALL';
  isRebooting: boolean = false;
  isQuickModModalOpen: boolean = false;
  private intervalId: any;

  statsData = {
    users: 0,
    submissions: 0,
    nodes: 3,
    health: 100
  };

  moderationQueue: any[] = [];
  usersList: any[] = [];
  systemLogs: any[] = [];

  systemMetrics = [
    { name: 'Sandbox Engine Node 1', load: 0 },
    { name: 'Sandbox Engine Node 2', load: 0 },
    { name: 'Database Cluster Node', load: 0 }
  ];

  techLeads: any[] = [];

  ojConfig = {
    timeout: 2000,
    memoryLimit: 256,
    forbiddenImports: 'System.IO, os, subprocess, child_process',
    parallelCompile: true
  };

  get adminStats() {
    return [
      { title: 'Tổng số thành viên', value: this.statsData.users.toLocaleString(), icon: 'bi-people-fill', color: 'purple' },
      { title: 'Lượt nộp bài chấm', value: this.statsData.submissions.toLocaleString(), icon: 'bi-code-square', color: 'blue' },
      { title: 'Cụm Node hoạt động', value: `${this.statsData.nodes} / 3`, icon: 'bi-cpu-fill', color: 'green' },
      { title: 'Trạng thái hạ tầng', value: `${this.statsData.health}%`, icon: 'bi-heart-pulse-fill', color: 'orange' }
    ];
  }

  get filteredQueue() {
    if (!this.searchText.trim()) return this.moderationQueue;
    return this.moderationQueue.filter(task =>
      (task.title || '').toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  get filteredLogs() {
    if (this.selectedLogLevel === 'ALL') return this.systemLogs;
    return this.systemLogs.filter(log => log.level === this.selectedLogLevel);
  }

  ngOnInit() {
    this.loadBackendData();
    this.startLiveSimulation();
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private checkAdminRole(): boolean {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return false;
      const payloadPart = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      
      if (Array.isArray(roleClaim)) {
        return roleClaim.map((r: string) => r.toLowerCase()).includes('admin');
      }
      return roleClaim?.toLowerCase() === 'admin';
    } catch (e) {
      return false;
    }
  }

private loadBackendData() {
  if (!this.checkAdminRole()) return;

  this.http.get<any>('/api/admin/users').subscribe({
    next: (res: any) => {
      console.log('=== DỮ LIỆU USER TỪ API ADMIN ===', res);
      
      const responseData = res?.data;
      const items = responseData?.items || [];

      this.usersList = items.map((u: any) => ({
        id: u.id,
        fullName: u.fullName || 'Chưa cập nhật',
        username: u.username || 'N/A',
        email: u.email || 'N/A',
        role: u.roles && u.roles.length > 0 ? u.roles[0] : 'User',
        isActive: u.isActive ?? true
      }));
      
      this.statsData.users = responseData?.totalCount || this.usersList.length;
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Lỗi lấy danh sách User:', err);
      this.usersList = [];
      this.cdr.detectChanges();
    }
  });

    this.http.get<any>('/api/admin/moderation-logs').subscribe({
      next: (res) => {
        const rawLogs = res?.data || res || [];
        if (Array.isArray(rawLogs)) {
          this.systemLogs = rawLogs.map((log: any) => ({
            id: log.id,
            timestamp: log.createdAt ? new Date(log.createdAt).toTimeString().split(' ')[0] : '00:00:00',
            subsystem: log.targetType || 'System',
            level: log.action === 'LOCK' ? 'WARNING' : 'INFO',
            message: log.reason || log.action || 'Sự kiện cấu hình'
          }));
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.systemLogs = [];
        this.cdr.detectChanges();
      }
    });
  }

  updateUserRole(userId: any, currentRole: string) {
    const nextRole = currentRole.toLowerCase() === 'admin' ? 'User' : 'Admin';
    const payload = { Role: nextRole };

    this.http.put(`/api/admin/users/${userId}/role`, payload).subscribe({
      next: () => {
        const user = this.usersList.find(u => u.id === userId);
        if (user) {
          user.role = nextRole;
          user.roles = [nextRole];
        }
        alert('Cập nhật quyền hạn thành viên thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('API Error details:', err);
        alert('Không thể cập nhật quyền do xung đột phân quyền hệ thống!');
      }
    });
  }

  toggleUserActiveStatus(userId: any) {
    const user = this.usersList.find(u => u.id === userId);
    if (!user) return;

    const actionEndpoint = user.isActive ? 'lock' : 'unlock';
    const bodyPayload = user.isActive ? { reason: 'Locked by Admin' } : null;

    this.http.patch(`/api/admin/users/${userId}/${actionEndpoint}`, bodyPayload).subscribe({
      next: () => {
        user.isActive = !user.isActive;
        alert('Cập nhật trạng thái hoạt động thành công!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        alert('Thao tác thất bại! Tài khoản Admin của cậu đang tự khóa chính mình hoặc sai định dạng GUID.');
      }
    });
  }

  switchTab(tabName: string) {
    this.activeTab = tabName;
    this.cdr.detectChanges();
  }

  approveTask(id: number) {
    this.moderationQueue = this.moderationQueue.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  rejectTask(id: number) {
    this.moderationQueue = this.moderationQueue.filter(t => t.id !== id);
    this.cdr.detectChanges();
  }

  saveOJConfig() {
    this.http.post('/api/problems/config', this.ojConfig).subscribe({
      next: () => alert('Cấu hình đã áp dụng thành công!'),
      error: () => alert('Lỗi kết nối API cấu hình Sandbox.')
    });
  }

  resetOJConfig() {
    this.ojConfig = { timeout: 2000, memoryLimit: 256, forbiddenImports: 'System.IO', parallelCompile: true };
    this.cdr.detectChanges();
  }

  triggerMasterReboot() {
    if (confirm('Khởi động lại Cluster Engine?')) {
      this.isRebooting = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.isRebooting = false; this.cdr.detectChanges(); }, 2000);
    }
  }

  private startLiveSimulation() {
    this.intervalId = setInterval(() => {
      if (this.isRebooting) return;
      this.systemMetrics.forEach(m => m.load = Math.max(10, Math.min(90, m.load + Math.floor(Math.random() * 11) - 5)));
      this.cdr.detectChanges();
    }, 2000);
  }

  openQuickModModal() {
    this.isQuickModModalOpen = true;
    this.cdr.detectChanges();
  }

  closeQuickModModal() {
    this.isQuickModModalOpen = false;
    this.cdr.detectChanges();
  }

  batchApproveAll() {
    this.moderationQueue = [];
    this.closeQuickModModal();
    alert('Đã phê duyệt hàng loạt toàn bộ nội dung đóng góp hợp lệ thành công!');
    this.cdr.detectChanges();
  }
}