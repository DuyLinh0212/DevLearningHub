import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // Import thêm HttpClient
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-result',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './quiz-result.html',
  styleUrl: './quiz-result.css'
})
export class QuizResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  sessionId: string = '';
  quizTitle: string = '';
  
  // Thông tin User
  userName: string = 'Học viên';
  userAvatar: string = 'assets/avatars/default.png';

  isDataReady = false; // Flag chống chớp màn hình

  summary = {
    percentage: 0,
    statusText: '',
    correctCount: 0,
    wrongCount: 0,
    timeDuration: '0 phút 0 giây',
    xpGained: 0,
    rank: 1,
    attempts: 1
  };

  reviewQuestions: any[] = [];

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    this.quizTitle = sessionStorage.getItem('quiz_title') || 'Kết quả bài kiểm tra';

    // 1. Load User Info trước
    this.loadUserInfo();
  }

  loadUserInfo() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        this.userName = u.fullName || u.Username || 'Học viên';
        this.userAvatar = u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username || 'user'}`;
        this.loadResult(); // Gọi tiếp kết quả sau khi có User
      },
      error: () => this.loadResult()
    });
  }

  loadResult() {
    this.quizService.getQuizSessionResult(this.sessionId).subscribe({
      next: (res) => {
        const data = res?.data || res;
        if (!data) return;

        // Xử lý các thông số summary... (Giữ nguyên logic cũ)
        const accuracy = data.accuracy ?? data.Accuracy ?? 0;
        this.summary.percentage = Math.round(accuracy <= 1 ? accuracy * 100 : accuracy);
        this.summary.correctCount = data.score ?? data.Score ?? 0;
        const totalQ = data.totalQuestions ?? data.TotalQuestions ?? 0;
        this.summary.wrongCount = totalQ > 0 ? (totalQ - this.summary.correctCount) : 0;
        this.summary.statusText = this.summary.percentage >= 70 ? 'Hoàn thành xuất sắc' : 'Cần cố gắng hơn';
        this.summary.xpGained = this.summary.correctCount * 50;
        const secs = data.timeTakenSeconds ?? data.TimeLimitSeconds ?? 0;
        this.summary.timeDuration = `${Math.floor(secs / 60)} phút ${secs % 60} giây`;

        // LỌC CÂU HỎI: Chỉ lấy đúng những câu đã lưu trong session
        const savedQuestions: any[] = JSON.parse(sessionStorage.getItem('quiz_questions') || '[]');
        const rawAnswers = data.answers || data.Answers || [];

        this.reviewQuestions = rawAnswers
          .filter((a: any) => {
            const targetQId = a.questionId || a.QuestionId;
            return savedQuestions.some(sq => (sq.id || sq.Id) === targetQId);
          })
          .map((a: any, idx: number) => {
            const targetQId = a.questionId || a.QuestionId;
            const q = savedQuestions.find((sq: any) => (sq.id || sq.Id) === targetQId);
            
            return {
              id: idx + 1,
              text: q?.text || 'Câu hỏi',
              isCorrect: a.isCorrect ?? a.IsCorrect ?? false,
              userAnswer: (q?.options.find((o:any) => o.id === (a.selectedOptionId))?.content) || 'Không trả lời',
              correctAnswer: (q?.options.find((o:any) => o.id === (a.correctOptionId))?.content) || '',
              explanation: a.explanation || 'Đã đối chiếu.'
            };
          });

        this.isDataReady = true; // Bật flag render
        this.cdr.detectChanges();
      },
      error: () => this.router.navigate(['/quiz-bank'])
    });
  }
}