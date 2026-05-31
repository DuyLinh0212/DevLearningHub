import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { QuizService } from '../../core/services/quiz.service';

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

  totalRealAttempts = 0;
  quizzesData: any[] = [];

  stats: any[] = [];
  recommendations: any[] = [];
  activities: any[] = [];
  leaderboard: any[] = [];

  ngOnInit() {
    this.quizzesData = this.quizService.getAllQuizzes();

    let sumAttempts = 0;
    let completedCount = 0;

    this.quizzesData.forEach(q => {
      sumAttempts += q.attempts;
      if (q.attempts > 0) {
        completedCount++;
      }
    });
    this.totalRealAttempts = sumAttempts;

    const totalPublicQuizzes = this.quizzesData.filter(q => q.statusClass === 'public').length;
    const completionRate = totalPublicQuizzes > 0 ? Math.round((completedCount / totalPublicQuizzes) * 100) : 0;
    const realStreak = this.quizService.getStreak();

    this.stats = [
      { title: 'Quiz đã hoàn thành', value: `${completedCount} / ${totalPublicQuizzes}`, icon: 'bi-book', color: 'purple' },
      { title: 'Bài Code đã Pass', value: '12 bài', icon: 'bi-calendar-check', color: 'green' },
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
          views: q.attempts,
          btnText: hasAttempted ? 'Tiếp tục' : 'Làm ngay',
          btnClass: hasAttempted ? 'purple' : 'dark'
        };
      });

    this.activities = this.quizzesData.map(q => {
      let mockProgress = 0;
      if (q.id === '1') mockProgress = q.attempts > 0 ? 100 : 0;
      if (q.id === '2') mockProgress = q.attempts > 0 ? 50 : 0;

      return {
        id: q.id,
        title: q.title,
        questions: q.questions,
        attempts: q.attempts,
        progress: mockProgress
      };
    });

    const studentRealXP = this.quizService.getUserXP();

    const systemCompetitors = [
      { name: 'Alex John', role: 'C# Developer', xp: 950 },
      { name: 'Emma Watson', role: 'Angular Expert', xp: 920 },
      { name: 'Michael Clark', role: 'Python Master', xp: 710 },
      { name: 'Sophia Green', role: 'Database Admin', xp: 680 },
      { name: 'Lucia Wilde', role: 'Web Developer', xp: 550 },
      { name: 'Ngọc Huỳnh', role: 'Web Developer', xp: studentRealXP }
    ];

    systemCompetitors.sort((a, b) => b.xp - a.xp);

    this.leaderboard = systemCompetitors.slice(0, 5).map((user, index) => ({
      rank: index + 1,
      name: user.name,
      role: user.role,
      xp: user.xp
    }));
  }

  handleAction(quizId: string) {
    this.router.navigate(['/quiz', quizId]);
  }

  onGlobalSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value } });
    }
  }
}
