import { Component, inject } from '@angular/core'; 
import { Router } from '@angular/router';          

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent {
  private router = inject(Router);

  logout() {
    this.router.navigate(['/login']);
  }

  stats = [
    { title: 'Quiz đã hoàn thành', value: '12 / 20', icon: 'bi-book', color: 'purple' },
    { title: 'Bài Code đã Pass', value: '34 bài', icon: 'bi-calendar-check', color: 'green' },
    { title: 'Lửa Streak', value: '5 ngày', icon: 'bi-fire', color: 'blue' },
    { title: 'Tỷ lệ Hoàn thành', value: '85%', icon: 'bi-bar-chart-line', color: 'orange' }
  ];

  recommendations = [
    { title: 'Ôn tập: Lập trình Web với .NET 9', time: 'Hôm nay, 2:30 PM', views: 32, btnText: 'Tiếp tục', btnClass: 'purple' },
    { title: 'Thử thách: Khởi tạo Giao diện Angular 20', time: 'Ngày mai, 10:00 AM', views: 28, btnText: 'Làm ngay', btnClass: 'dark' },
    { title: 'Có thể bạn quan tâm: Cấu trúc dữ liệu & Giải thuật', time: '20 Tháng 5, 9:00 AM', views: 45, btnText: 'Khám phá', btnClass: 'dark' }
  ];

  leaderboard = [
    { rank: 1, name: 'Alex John', role: 'C# Developer', xp: 950 },
    { rank: 2, name: 'Emma Watson', role: 'Angular Expert', xp: 920 },
    { rank: 3, name: 'Michael Clark', role: 'Python Master', xp: 910 },
    { rank: 4, name: 'Sophia Green', role: 'Database Admin', xp: 890 },
    { rank: 5, name: 'Lucia Wilde', role: 'Python Developer', xp: 870 }
  ];

  activities = [
    { title: 'Tổng quan Kiến trúc REST API', questions: 15, attempts: 28, progress: 75 },
    { title: 'Làm chủ Angular Signals', questions: 15, attempts: 28, progress: 40 },
    { title: 'Thiết kế Database SQL Server', questions: 15, attempts: 28, progress: 90 }
  ];
}
