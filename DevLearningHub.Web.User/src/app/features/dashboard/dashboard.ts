import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { QuizService } from '../../core/services/quiz.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, SidebarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private router = inject(Router);
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  totalRealAttempts = 0;
  quizzesData: any[] = [];
  
  // Các biến hứng dữ liệu từ API Stats mới của Nam
  userXpPoints = 0;
  totalQuizTaken = 0;
  averageScore = 0;
  userRank = 0;

  stats: any[] = [];
  recommendations: any[] = [];
  activities: any[] = [];
  leaderboard: any[] = [];

  ngOnInit() {
    console.log('=== DASHBOARD: KHỞI ĐỘNG CHUỖI LIÊN HOÀN BỐC TÁCH STATS ===');
    
    // BƯỚC 1: Lấy thông tin cá nhân trước để có ID người dùng
    this.quizService.getCurrentUser().subscribe({
      next: (userRes: any) => {
        const userData = userRes?.data || userRes;
        const userId = userData?.id || userData?.Id || userData?.userId || '';
        
        console.log(`=> Đã tìm thấy mã Học viên hiện tại: ${userId}`);

        // BƯỚC 2: Dùng mã ID vừa tìm được để kích hoạt forkJoin kéo hết dữ liệu còn lại cùng một lúc
        forkJoin({
          quizzes: this.quizService.getAllQuizzes(),
          leaderboardRes: this.quizService.getLeaderboard(),
          // Gọi API stats động dựa theo ID của học viên, nếu lỗi thì fallback mảng trống
          userStats: userId ? this.http.get<any>(`/api/users/${userId}/stats`) : of(null)
        }).subscribe({
          next: (result: any) => {
            console.log('=== DASHBOARD: TẤT CẢ DỮ LIỆU ĐÃ ĐỒNG BỘ ===', result);

            // 1. Xử lý bóc tách Quizzes
            const rawQuizzes = result.quizzes?.data || result.quizzes;
            this.quizzesData = Array.isArray(rawQuizzes) ? rawQuizzes : [];

            // 2. Xử lý bóc tách Bảng xếp hạng
            const lbData = result.leaderboardRes?.data || result.leaderboardRes;
            const rawLeaderboard = Array.isArray(lbData) ? lbData : [];
            this.leaderboard = rawLeaderboard.map((u: any, idx: number) => ({
              rank: u.rank ?? (idx + 1),
              name: u.fullName || u.username || 'Học viên',
              avatar: u.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + (u.username || idx),
              xp: u.xp ?? u.xpPoints ?? 0
            }));

            // 3. XỬ LÝ BÓC TÁCH EM ENDPOINT STATS MỚI TINH CỦA NAM
            const statsData = result.userStats?.data || result.userStats;
            if (statsData) {
              console.log('Dữ liệu phân tích năng lực thực tế từ DB:', statsData);
              this.totalQuizTaken = statsData.totalQuizTaken ?? 0;
              this.userXpPoints = statsData.totalXP ?? userData?.xpPoints ?? 0;
              this.averageScore = statsData.avgScore ?? 0;
              this.userRank = statsData.rank ?? 0;
            }

            // Tiến hành lắp ráp lên giao diện
            this.buildDashboardData();
          },
          error: (err) => {
            console.error('Lỗi khi tải tổ hợp dữ liệu Dashboard:', err);
            this.fallbackLoadQuizzes();
          }
        });
      },
      error: (err) => {
        console.error('Không lấy được profile người dùng, kích hoạt fallback:', err);
        this.fallbackLoadQuizzes();
      }
    });
  }

  private fallbackLoadQuizzes() {
    this.quizService.getAllQuizzes().subscribe({
      next: (quizzes: any) => {
        const fallbackData = quizzes?.data || quizzes;
        this.quizzesData = Array.isArray(fallbackData) ? fallbackData : [];
        this.buildDashboardData();
      }
    });
  }

  private buildDashboardData() {
    let sumAttempts = 0;
    this.quizzesData.forEach(q => {
      sumAttempts += (q.attempts ?? q.attemptsCount ?? 0);
    });
    this.totalRealAttempts = sumAttempts;

    // Tổng số lượng đề thi đang mở trên hệ thống
    const totalPublicQuizzes = this.quizzesData.filter(q => q.isPublic === true || q.statusClass === 'public').length;

    // 🎯 ĐỒNG BỘ 4 CHIẾC HỘP THẦN THÁNH THEO ĐÚNG ĐỐI TƯỢNG TRẢ VỀ CỦA API STATS
    this.stats = [
      { title: 'Quiz đã hoàn thành', value: `${this.totalQuizTaken} / ${totalPublicQuizzes || this.quizzesData.length}`, icon: 'bi-book', color: 'purple' },
      { title: 'Điểm kinh nghiệm', value: `${this.userXpPoints} XP`, icon: 'bi-gem', color: 'green' },
      { title: 'Điểm số trung bình', value: `${this.averageScore.toFixed(1)}đ`, icon: 'bi-check-circle-fill', color: 'blue' },
      { title: 'Thứ hạng hệ thống', value: this.userRank > 0 ? `Hạng ${this.userRank}` : 'Chưa xếp hạng', icon: 'bi-trophy-fill', color: 'orange' }
    ];

    this.recommendations = this.quizzesData.map(q => {
      const realAttempts = q.attempts ?? q.attemptsCount ?? 0;
      const hasAttempted = realAttempts > 0;
      return {
        id: q.id,
        title: hasAttempted ? `Ôn tập: ${q.title}` : `Thử thách: ${q.title}`,
        time: hasAttempted ? 'Hôm nay' : 'Mới cập nhật',
        views: realAttempts,
        btnText: hasAttempted ? 'Tiếp tục' : 'Làm ngay',
        btnClass: hasAttempted ? 'purple' : 'dark'
      };
    });

    this.activities = this.quizzesData.map(q => {
      const realAttempts = q.attempts ?? q.attemptsCount ?? 0;
      return {
        id: q.id,
        title: q.title,
        questions: q.questionCount || q.questionsCount || 0,
        attempts: realAttempts,
        progress: realAttempts > 0 ? 100 : 0
      };
    });

    this.cdr.detectChanges();
  }

  handleAction(quizId: string) {
    this.router.navigate(['/quiz', quizId]);
  }

  onGlobalSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input && input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value.trim() } });
    }
  }
}