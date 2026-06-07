import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { QuizService } from '../../core/services/quiz.service';
import { forkJoin } from 'rxjs';

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
  private cdr = inject(ChangeDetectorRef);

  totalRealAttempts = 0;
  quizzesData: any[] = [];
  userXpPoints = 0;

  stats: any[] = [];
  recommendations: any[] = [];
  activities: any[] = [];
  leaderboard: any[] = [];

  ngOnInit() {
    forkJoin({
      quizzes: this.quizService.getAllQuizzes(),
      leaderboardRes: this.quizService.getLeaderboard(),
      userProfile: this.quizService.getCurrentUser()
    }).subscribe({
      next: (result) => {
        this.quizzesData = result.quizzes || [];
        
        const userData = result.userProfile?.data || result.userProfile;
        this.userXpPoints = userData?.xpPoints ?? userData?.XpPoints ?? 0;

        const lbData = result.leaderboardRes?.data || result.leaderboardRes || [];
        const rawLeaderboard = Array.isArray(lbData) ? lbData : [];
        
        this.leaderboard = rawLeaderboard.map((u: any, idx: number) => ({
          rank: u.rank ?? u.Rank ?? (idx + 1),
          name: u.fullName || u.FullName || u.username || u.Username || 'Học viên',
          role: u.role || u.Role || 'Web Developer',
          xp: u.xpPoints ?? u.XpPoints ?? u.xp ?? u.Xp ?? 0
        }));

        this.buildDashboardData();
      },
      error: (err) => {
        console.error(err);
        this.quizService.getAllQuizzes().subscribe({
          next: (quizzes) => {
            this.quizzesData = quizzes || [];
            this.buildDashboardData();
          }
        });
      }
    });
  }

  private buildDashboardData() {
    let sumAttempts = 0;
    let completedCount = 0;

    this.quizzesData.forEach(q => {
      const realAttempts = q.attempts || 0;
      sumAttempts += realAttempts;
      if (realAttempts > 0) {
        completedCount++;
      }
    });
    this.totalRealAttempts = sumAttempts;

    const totalPublicQuizzes = this.quizzesData.filter(q => q.statusClass === 'public').length;
    const realStreak = this.quizService.getStreak();

    this.stats = [
      { title: 'Quiz đã hoàn thành', value: `${completedCount} / ${totalPublicQuizzes}`, icon: 'bi-book', color: 'purple' },
      { title: 'Điểm kinh nghiệm', value: `${this.userXpPoints} XP`, icon: 'bi-calendar-check', color: 'green' },
      { title: 'Tổng lượt làm Quiz', value: `${this.totalRealAttempts} lượt`, icon: 'bi-fire', color: 'blue' },
      { title: 'Lửa Streak', value: `${realStreak} ngày`, icon: 'bi-fire', color: 'orange' }
    ];

    this.recommendations = this.quizzesData
      .filter(q => q.statusClass === 'public')
      .map(q => {
        const hasAttempted = q.attempts > 0;
        return {
          id: q.id,
          title: hasAttempted ? `Ôn tập: ${q.title}` : `Thử thách: ${q.title}`,
          time: hasAttempted ? 'Hôm nay' : 'Mới cập nhật',
          views: q.attempts || 0,
          btnText: hasAttempted ? 'Tiếp tục' : 'Làm ngay',
          btnClass: hasAttempted ? 'purple' : 'dark'
        };
      });

    this.activities = this.quizzesData.map(q => {
      return {
        id: q.id,
        title: q.title,
        questions: q.questions || 0,
        attempts: q.attempts || 0,
        progress: q.attempts > 0 ? 100 : 0
      };
    });

    this.cdr.detectChanges();
  }

  handleAction(quizId: string) {
    this.router.navigate(['/quiz-play', quizId]);
  }

  onGlobalSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value } });
    }
  }
}