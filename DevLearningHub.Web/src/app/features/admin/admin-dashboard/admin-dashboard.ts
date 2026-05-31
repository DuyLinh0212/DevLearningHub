import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, SidebarComponent],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  activeTab: string = 'dashboard';
  searchText: string = '';
  selectedLogLevel: string = 'ALL';
  isRebooting: boolean = false;
  isQuickModModalOpen: boolean = false;
  private intervalId: any;

  statsData = {
    users: 1420,
    submissions: 8945,
    nodes: 3,
    health: 98
  };

  moderationQueue = [
    { id: 1, title: 'Đề xuất câu hỏi Linq nâng cao', typeClass: 'purple', typeText: 'Đóng góp', author: 'Nguyễn Hoàng Nam', time: '10 phút trước', icon: 'bi-journal-plus' },
    { id: 2, title: 'Báo cáo bình luận toxic tại bài viết #102', typeClass: 'red', typeText: 'Báo cáo', author: 'Lê Văn Đạt', time: '25 phút trước', icon: 'bi-exclamation-triangle' },
    { id: 3, title: 'Đề xuất bộ đề SQL Server Joins', typeClass: 'purple', typeText: 'Đóng góp', author: 'Trần Minh Thu', time: '1 giờ trước', icon: 'bi-folder-plus' }
  ];

  systemMetrics = [
    { name: 'Sandbox Engine Node 1', load: 42 },
    { name: 'Sandbox Engine Node 2', load: 28 },
    { name: 'Database Cluster Node', load: 19 }
  ];

  techLeads = [
    { name: 'Nguyễn Hoàng Nam', info: 'Đóng góp 14 câu hỏi Backend', xp: 700, img: 'https://i.pravatar.cc/40?img=33' },
    { name: 'Trần Minh Thu', info: 'Giải quyết 8 báo cáo Forum', xp: 400, img: 'https://i.pravatar.cc/40?img=12' }
  ];

  ojConfig = {
    timeout: 2000,
    memoryLimit: 256,
    forbiddenImports: 'System.IO, os, subprocess, child_process',
    parallelCompile: true
  };

  systemLogs = [
    { id: 1, timestamp: '22:55:01', subsystem: 'Sandbox', level: 'INFO', message: 'Sinh viên ngoc_huynh vừa nộp bài giải thuật C# cấu trúc dữ liệu.' },
    { id: 2, timestamp: '22:53:14', subsystem: 'OnlineJudge', level: 'SUCCESS', message: 'Sandbox Node 1 hoàn thành chấm bài phiên #4412: Đạt 100/100 điểm.' },
    { id: 3, timestamp: '22:50:45', subsystem: 'Auth', level: 'WARNING', message: 'Hệ thống phát hiện tài khoản guest_204 cố gắng spam request login.' },
    { id: 4, timestamp: '22:48:22', subsystem: 'Database', level: 'INFO', message: 'Đồng bộ hóa danh mục bộ đề thi trắc nghiệm từ kho dữ liệu tổng hoàn tất.' }
  ];

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
      task.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
      task.author.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  get filteredLogs() {
    if (this.selectedLogLevel === 'ALL') {
      return this.systemLogs;
    }
    return this.systemLogs.filter(log => log.level === this.selectedLogLevel);
  }

  ngOnInit() {
    this.startLiveSimulation();
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  switchTab(tabName: string) {
    this.activeTab = tabName;
  }

  approveTask(id: number) {
    const task = this.moderationQueue.find(t => t.id === id);
    if (task && task.typeText === 'Đóng góp') {
      const lead = this.techLeads.find(l => l.name === task.author);
      if (lead) lead.xp += 50;
    }
    this.moderationQueue = this.moderationQueue.filter(t => t.id !== id);
  }

  rejectTask(id: number) {
    this.moderationQueue = this.moderationQueue.filter(t => t.id !== id);
  }

  saveOJConfig() {
    alert('Cấu hình tham số thực thi Sandbox Core đã được áp dụng thành công toàn hệ thống!');
  }

  resetOJConfig() {
    this.ojConfig = {
      timeout: 2000,
      memoryLimit: 256,
      forbiddenImports: 'System.IO, os, subprocess, child_process',
      parallelCompile: true
    };
    alert('Đã khôi phục cấu hình Sandbox Core về mặc định hệ thống!');
  }

  openQuickModModal() {
    this.isQuickModModalOpen = true;
  }

  closeQuickModModal() {
    this.isQuickModModalOpen = false;
  }

  batchApproveAll() {
    this.moderationQueue.forEach(task => {
      if (task.typeText === 'Đóng góp') {
        const lead = this.techLeads.find(l => l.name === task.author);
        if (lead) lead.xp += 50;
      }
    });
    this.moderationQueue = [];
    this.closeQuickModModal();
    alert('Đã phê duyệt hàng loạt toàn bộ nội dung đóng góp hợp lệ thành công!');
  }

  triggerMasterReboot() {
    const confirmReboot = confirm('Xác nhận khởi động lại Master Cluster Nodes? Toàn bộ các phiên chấm bài Code (Online Judge) đang chạy sẽ bị tạm dừng trong giây lát.');
    if (confirmReboot) {
      this.isRebooting = true;
      this.statsData.nodes = 0;
      this.statsData.health = 35;
      this.systemMetrics.forEach(m => m.load = 0);

      setTimeout(() => {
        this.systemMetrics[0].load = 12;
        this.systemMetrics[1].load = 18;
        this.systemMetrics[2].load = 8;
        this.statsData.nodes = 3;
        this.statsData.health = 99;
        this.isRebooting = false;
        alert('Cụm máy chủ Sandbox Cluster (Online Judge) đã được tái khởi động thành công và đang ở trạng thái sẵn sàng!');
      }, 2500);
    }
  }

  private startLiveSimulation() {
    this.intervalId = setInterval(() => {
      if (this.isRebooting) return;

      this.systemMetrics.forEach(metric => {
        const loadDiff = Math.floor(Math.random() * 13) - 6;
        metric.load = Math.max(10, Math.min(92, metric.load + loadDiff));
      });

      this.statsData.health = Math.max(95, Math.min(100, this.statsData.health + (Math.floor(Math.random() * 3) - 1)));

      if (Math.random() > 0.4) {
        this.statsData.submissions += Math.floor(Math.random() * 3) + 1;
      }

      if (Math.random() > 0.7) {
        this.statsData.users += 1;
      }

      this.generateDynamicLog();

      if (Math.random() > 0.8 && this.moderationQueue.length < 5) {
        this.generateDynamicTask();
      }
    }, 2000);
  }

  private generateDynamicTask() {
    const taskTemplates = [
      { title: 'Đề xuất câu hỏi Đa luồng trong C#', typeClass: 'purple', typeText: 'Đóng góp', author: 'Nguyễn Hoàng Nam', icon: 'bi-journal-plus' },
      { title: 'Đề xuất bài tập Cấu trúc dữ liệu mảng', typeClass: 'purple', typeText: 'Đóng góp', author: 'Trần Minh Thu', icon: 'bi-folder-plus' },
      { title: 'Báo cáo spam link quảng cáo tại Forum', typeClass: 'red', typeText: 'Báo cáo', author: 'Học viên ẩn danh', icon: 'bi-exclamation-triangle' }
    ];
    const picked = taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
    this.moderationQueue.push({
      id: Date.now(),
      ...picked,
      time: 'Vừa xong'
    });
  }

  private generateDynamicLog() {
    const timeString = new Date().toTimeString().split(' ')[0];
    const logTemplates = [
      { sub: 'Auth', lvl: 'INFO', msg: 'Tài khoản thành viên mới vừa đăng ký thành công vào hệ thống.' },
      { sub: 'Quiz', lvl: 'SUCCESS', msg: 'Đã hoàn thành kiểm duyệt và cập nhật cờ hoạt động cho câu hỏi trắc nghiệm mới.' },
      { sub: 'Sandbox', lvl: 'WARNING', msg: 'Thời gian phản hồi (Latency) từ máy chủ Sandbox Node 2 tăng nhẹ.' },
      { sub: 'Database', lvl: 'INFO', msg: 'Hệ thống tự động dọn dẹp bộ nhớ đệm và dữ liệu cache phiên chấm bài hết hạn.' },
      { sub: 'Sandbox', lvl: 'SUCCESS', msg: 'Hệ thống dịch mã nguồn hoàn tất bài nộp cấu trúc dữ liệu giải thuật.' },
      { sub: 'Security', lvl: 'WARNING', msg: 'Phát hiện một phiên kết nối có dấu hiệu brute-force endpoint API.' }
    ];

    const picked = logTemplates[Math.floor(Math.random() * logTemplates.length)];

    this.systemLogs.unshift({
      id: Date.now(),
      timestamp: timeString,
      subsystem: picked.sub,
      level: picked.lvl,
      message: picked.msg
    });

    if (this.systemLogs.length > 25) {
      this.systemLogs.pop();
    }
  }
}
