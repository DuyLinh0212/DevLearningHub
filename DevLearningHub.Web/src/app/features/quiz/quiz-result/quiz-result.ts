import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-result',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quiz-result.html',
  styleUrl: './quiz-result.css'
})
export class QuizResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);
  private cdr = inject(ChangeDetectorRef);

  sessionId: string = '';
  quizId: string = '';
  quizTitle: string = '';

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

    this.quizService.getQuizSessionResult(this.sessionId).subscribe({
      next: (res) => {
        const data = res?.data || res;
        if (!data) return;

        this.quizId = data.quizSetId || '';
        this.summary.percentage = Math.round((data.accuracy ?? 0) * 100);
        this.summary.correctCount = data.score ?? 0;
        this.summary.wrongCount = (data.totalQuestions ?? 0) - this.summary.correctCount;
        this.summary.statusText = this.summary.percentage >= 70 ? 'Hoàn thành xuất sắc' : 'Cần cố gắng hơn';
        this.summary.xpGained = this.summary.correctCount * 50;

        const secs = data.timeTakenSeconds ?? 0;
        this.summary.timeDuration = `${Math.floor(secs / 60)} phút ${secs % 60} giây`;

        const savedQuestions: any[] = JSON.parse(sessionStorage.getItem('quiz_questions') || '[]');

        this.reviewQuestions = (data.answers ?? []).map((a: any, idx: number) => {
          const q = savedQuestions.find((sq: any) => sq.id === a.questionId);
          const questionText = q?.text || `Câu hỏi ${idx + 1}`;
          const explanation = q?.explanation || 'Hệ thống ghi nhận và đối chiếu kết quả tự động.';

          const selectedOption = q?.options?.find((o: any) => o.id === a.selectedOptionId);
          const correctOption = q?.options?.find((o: any) => o.id === a.correctOptionId);

          return {
            id: idx + 1,
            text: questionText,
            isCorrect: a.isCorrect,
            userAnswer: selectedOption?.content
              ? `${selectedOption.content} — đáp án của bạn`
              : 'Không trả lời',
            correctAnswer: !a.isCorrect && correctOption?.content
              ? `${correctOption.content} — đáp án đúng`
              : '',
            explanation
          };
        });

        this.quizService.addUserXP(this.summary.xpGained);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.router.navigate(['/quiz-bank']);
      }
    });
  }

  logout() {
    this.router.navigate(['/login']);
  }
}