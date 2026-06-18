import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
  resultMode: string = 'practice';

  userName: string = 'Học viên';
  userAvatar: string = 'assets/images/default-avatar.svg';

  isDataReady = false;

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

  get isExamMode(): boolean {
    return this.resultMode === 'exam';
  }

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    this.resultMode = this.route.snapshot.queryParamMap.get('mode') || 'practice';
    this.quizTitle = sessionStorage.getItem('quiz_title') || 'Kết quả bài kiểm tra';
    this.loadUserInfo();
  }

  loadUserInfo() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.userName = user?.fullName || user?.username || user?.Username || 'Học viên';
        this.userAvatar = user?.avatarUrl || 'assets/images/default-avatar.svg';
        this.loadResult();
      },
      error: () => this.loadResult()
    });
  }

  loadResult() {
    this.quizService.getQuizSessionResult(this.sessionId).subscribe({
      next: (res) => {
        const data = res?.data || res;
        if (!data) return;

        const accuracy = data.accuracy ?? data.Accuracy ?? 0;
        this.summary.percentage = Math.round(accuracy <= 1 ? accuracy * 100 : accuracy);
        this.summary.correctCount = data.score ?? data.Score ?? 0;

        const totalQuestions = data.totalQuestions ?? data.TotalQuestions ?? 0;
        this.summary.wrongCount = totalQuestions > 0 ? (totalQuestions - this.summary.correctCount) : 0;
        this.summary.statusText = this.summary.percentage >= 70 ? 'Hoàn thành xuất sắc' : 'Cần cố gắng hơn';
        this.summary.xpGained = this.summary.correctCount * 50;

        if (typeof window !== 'undefined' && this.sessionId) {
          const xpCreditedKey = `dlh_xp_credited_${this.sessionId}`;
          if (!sessionStorage.getItem(xpCreditedKey)) {
            sessionStorage.setItem(xpCreditedKey, 'true');
            window.dispatchEvent(new CustomEvent('profile-updated'));
          }
        }

        const secs = data.timeTakenSeconds ?? data.TimeLimitSeconds ?? 0;
        this.summary.timeDuration = `${Math.floor(secs / 60)} phút ${secs % 60} giây`;

        if (!this.isExamMode) {
          const savedQuestions: any[] = JSON.parse(sessionStorage.getItem('quiz_questions') || '[]');
          const rawAnswers = data.answers || data.Answers || [];

          this.reviewQuestions = rawAnswers
            .filter((answer: any) => {
              const targetQuestionId = answer.questionId || answer.QuestionId;
              return savedQuestions.some(question => (question.id || question.Id) === targetQuestionId);
            })
            .map((answer: any, index: number) => {
              const targetQuestionId = answer.questionId || answer.QuestionId;
              const question = savedQuestions.find((saved: any) => (saved.id || saved.Id) === targetQuestionId);

              return {
                id: index + 1,
                text: question?.text || 'Câu hỏi',
                isCorrect: answer.isCorrect ?? answer.IsCorrect ?? false,
                userAnswer: question?.options.find((option: any) => option.id === answer.selectedOptionId)?.content || 'Không trả lời',
                correctAnswer: question?.options.find((option: any) => option.id === answer.correctOptionId)?.content || '',
                explanation: answer.explanation || 'Đã đối chiếu.'
              };
            });
        } else {
          this.reviewQuestions = [];
        }

        this.isDataReady = true;
        this.cdr.detectChanges();
      },
      error: () => this.router.navigate(['/quiz-bank'])
    });
  }
}
