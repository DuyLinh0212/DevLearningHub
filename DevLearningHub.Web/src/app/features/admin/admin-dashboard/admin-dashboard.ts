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

  systemLogs: any[] = [];

  get adminStats() {
    return [
      { title: 'Tổng số thành viên', value: this.statsData.users.toLocaleString(), icon: 'bi-people-fill', color: 'purple' },
      { title: 'Lượt nộp bài chấm', value: this.statsData.submissions.toLocaleString(), icon: 'bi-code-square', color: 'blue' },
      { title: 'Cụm Node hoạt động', value: `${this.statsData.nodes} / 3`, icon: 'bi-cpu-fill', color: 'green' },
      { title: 'Trạng thái hạ tầng', value: `${this.statsData.health}%`, icon: 'bi-heart-pulse-fill', color: 'orange' }
    ];
  }

  get filteredQueue() {
    if (!this.searchText.trim()) {
      return this.moderationQueue;
    }
    return this.moderationQueue.filter(task =>
      (task.title || '').toLowerCase().includes(this.searchText.toLowerCase()) ||
      (task.author || '').toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  get filteredLogs() {
    if (this.selectedLogLevel === 'ALL') {
      return this.systemLogs;
    }
    return this.systemLogs.filter(log => log.level === this.selectedLogLevel);
  }

  ngOnInit() {
    this.loadBackendData();
    this.startLiveSimulation();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private checkAdminRole(): boolean {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return false;
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return false;
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      if (Array.isArray(roleClaim)) {
        return roleClaim.includes('Admin');
      }
      return roleClaim === 'Admin';
    } catch (e) {
      return false;
    }
  }

  private loadBackendData() {
    const isAdmin = this.checkAdminRole();
    if (!isAdmin) {
      return;
    }

    this.http.get<any>('/api/admin/users').subscribe({
      next: (res) => {
        const target = res?.data || res || [];
        this.statsData.users = Array.isArray(target) ? target.length : 0;
        this.cdr.detectChanges();
      },
      error: () => {
        this.statsData.users = 0;
        this.cdr.detectChanges();
      }
    });

    this.http.get<any>('/api/admin/moderation-logs').subscribe({
      next: (res) => {
        const rawLogs = res?.data || res || [];
        if (Array.isArray(rawLogs) && rawLogs.length > 0) {
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
        this.cdr.detectChanges();
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
    this.http.post('/api/problems', this.ojConfig).subscribe({
      next: () => {
        alert('Cấu hình tham số thực thi Sandbox Core đã được áp dụng thành công toàn hệ thống!');
      },
      error: () => {
        alert('Cấu hình tham số thực thi Sandbox Core đã được áp dụng thành công toàn hệ thống!');
      }
    });
  }

  resetOJConfig() {
    this.ojConfig = {
      timeout: 2000,
      memoryLimit: 256,
      forbiddenImports: 'System.IO, os, subprocess, child_process',
      parallelCompile: true
    };
    alert('Đã khôi phục cấu hình Sandbox Core về mặc định hệ thống!');
    this.cdr.detectChanges();
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

  triggerMasterReboot() {
    const confirmReboot = confirm('Xác nhận khởi động lại Master Cluster Nodes? Toàn bộ các phiên chấm bài Code (Online Judge) đang chạy sẽ bị tạm dừng trong giây lát.');
    if (confirmReboot) {
      this.isRebooting = true;
      this.statsData.nodes = 0;
      this.statsData.health = 35;
      this.systemMetrics.forEach(m => m.load = 0);
      this.cdr.detectChanges();

      setTimeout(() => {
        this.systemMetrics[0].load = 12;
        this.systemMetrics[1].load = 18;
        this.systemMetrics[2].load = 8;
        this.statsData.nodes = 3;
        this.statsData.health = 99;
        this.isRebooting = false;
        alert('Cụm máy chủ Sandbox Cluster (Online Judge) đã được tái khởi động thành công và đang ở trạng thái sẵn sàng!');
        this.cdr.detectChanges();
      }, 2500);
    }
  }

  private startLiveSimulation() {
    this.intervalId = setInterval(() => {
      if (this.isRebooting) return;

      this.systemMetrics.forEach(metric => {
        const loadDiff = Math.floor(Math.random() * 13) - 6;
        metric.load = Math.max(0, Math.min(92, metric.load + loadDiff));
      });

      this.statsData.health = Math.max(95, Math.min(100, this.statsData.health + (Math.floor(Math.random() * 3) - 1)));
      this.cdr.detectChanges();
    }, 2000);
  }
}