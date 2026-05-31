import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, FormsModule, SidebarComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  activeTab: string = 'dashboard';
  searchText: string = '';
  isQuickModModalOpen: boolean = false;
  isRebooting: boolean = false;

  ojConfig = {
    timeout: 2000,
    memoryLimit: 256,
    forbiddenImports: 'System.IO, os, subprocess, child_process',
    parallelCompile: true
  };

  adminStats = [
    { title: 'Thành viên mới (Tuần)', value: '1,248', icon: 'bi-people-fill', color: 'purple' },
    { title: 'OJ Compile (24h)', value: '14,892', icon: 'bi-terminal-fill', color: 'blue' },
    { title: 'Bài viết Forum mới', value: '342', icon: 'bi-chat-left-text-fill', color: 'green' },
    { title: 'Hàng đợi kiểm duyệt', value: '3 tác vụ', icon: 'bi-shield-fill-exclamation', color: 'orange' }
  ];

  moderationQueue = [
    {
      id: '1',
      title: 'Đề xuất bộ đề lý thuyết REST API .NET 9',
      typeClass: 'contribution',
      typeText: 'Đóng góp',
      author: 'Lê Minh Tuấn (Mentor)',
      time: '14 phút trước',
      icon: 'bi-folder-plus'
    },
    {
      id: '2',
      title: 'Báo cáo bình luận toxic, xúc phạm thành viên khác',
      typeClass: 'report',
      typeText: 'Vi phạm',
      author: 'Hệ thống tự động',
      time: '32 phút trước',
      icon: 'bi-exclamation-octagon'
    },
    {
      id: '3',
      title: 'Đóng góp Thử thách Code: Thuật toán Dijkstra tìm đường ngắn nhất',
      typeClass: 'contribution',
      typeText: 'Đóng góp',
      author: 'Hoàng Ngọc Đức (Khóa 21)',
      time: '1 giờ trước',
      icon: 'bi-code-square'
    }
  ];

  systemMetrics = [
    { name: 'Core Sandbox Executor #01', load: 42 },
    { name: 'Core Sandbox Executor #02', load: 88 },
    { name: 'Database Replication Node', load: 24 }
  ];

  systemLogs = [
    { timestamp: '21:14:02', subsystem: 'ONLINE_JUDGE', level: 'SUCCESS', message: 'Sinh viên Huỳnh Văn Ngọc biên dịch thành công bài tập Dijkstra (C#) - 24ms.' },
    { timestamp: '21:10:45', subsystem: 'AUTH_SERVICE', level: 'INFO', message: 'Cấp mới session token thành công cho 124 tài khoản kết nối từ IP HUIT Wifi.' },
    { timestamp: '20:58:12', subsystem: 'FORUM_CORE', level: 'WARN', message: 'Phát hiện từ khóa nhạy cảm trong bài đăng ID #4829 - Đã chuyển trạng thái chờ kiểm duyệt.' },
    { timestamp: '20:45:00', subsystem: 'SANDBOX_ENG', level: 'INFO', message: 'Tự động dọn dẹp và giải phóng bộ nhớ cache Docker Container Node #02.' }
  ];

  ngOnInit() {
    this.updateStatsCount();
  }

  switchTab(tabName: string) {
    this.activeTab = tabName;
  }

  get filteredQueue() {
    return this.moderationQueue.filter(task =>
      task.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
      task.author.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  approveTask(id: string) {
    this.moderationQueue = this.moderationQueue.filter(task => task.id !== id);
    this.updateStatsCount();
    alert('Đã phê duyệt tác vụ thành công!');
  }

  rejectTask(id: string) {
    this.moderationQueue = this.moderationQueue.filter(task => task.id !== id);
    this.updateStatsCount();
    alert('Đã từ chối tác vụ và gửi thông báo phản hồi.');
  }

  saveOJConfig() {
    alert('Cấu hình Sandbox Engine đã được áp đặt xuống các Worker Nodes thành công!');
  }

  triggerMasterReboot() {
    const confirmReboot = confirm('Xác nhận khởi động lại Master Cluster Nodes? Toàn bộ các phiên chấm bài Code (Online Judge) đang chạy sẽ bị tạm dừng trong giây lát.');

    if (confirmReboot) {
      this.isRebooting = true;

      this.systemMetrics.forEach(m => m.load = 0);

      setTimeout(() => {
        this.systemMetrics[0].load = 12; 
        this.systemMetrics[1].load = 18; 
        this.systemMetrics[2].load = 8;

        this.isRebooting = false;
        alert('Cụm máy chủ Sandbox Cluster (Online Judge) đã được tái khởi động thành công và đang ở trạng thái sẵn sàng!');
      }, 2500);
    }
  }

  openQuickModModal() {
    this.isQuickModModalOpen = true;
  }

  closeQuickModModal() {
    this.isQuickModModalOpen = false;
  }

  batchApproveAll() {
    this.moderationQueue = [];
    this.isQuickModModalOpen = false;
    this.updateStatsCount();
    alert('Hệ thống đã tự động phê duyệt hàng loạt toàn bộ tác vụ đóng góp hợp lệ thành công!');
  }

  private updateStatsCount() {
    this.adminStats[3].value = `${this.moderationQueue.length} tác vụ`;
  }


}
