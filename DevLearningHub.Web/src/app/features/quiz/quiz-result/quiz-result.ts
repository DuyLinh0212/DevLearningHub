import { Component, inject, OnInit } from '@angular/core';
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

  quizId: string = '';
  quizTitle: string = '';

  summary = {
    percentage: 0,
    statusText: '',
    correctCount: 0,
    wrongCount: 0,
    timeDuration: '',
    xpGained: 0,
    rank: 12,
    attempts: 0
  };

  reviewQuestions: any[] = [];

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '1';

    this.quizService.incrementAttempts(this.quizId);
    this.summary.attempts = this.quizService.getAttempts(this.quizId);

    const quizData = this.quizService.getQuiz(this.quizId);
    const userAnswers = this.quizService.getSavedAnswers();

    this.quizTitle = quizData.title;
    this.summary.timeDuration = this.quizService.getSavedTimeSpent();

    let correct = 0;
    let wrong = 0;

    this.reviewQuestions = quizData.questions.map((q: any, idx: number) => {
      const uAns = userAnswers[idx];
      const isCorrect = uAns === q.correctIndex;

      if (isCorrect) correct++;
      else wrong++;

      const prefixes = ['A', 'B', 'C', 'D'];

      return {
        id: q.id,
        text: q.text,
        isCorrect: isCorrect,
        userAnswer: uAns !== null ? `${prefixes[uAns]}. ${q.options[uAns]} — đáp án của bạn` : 'Không trả lời',
        correctAnswer: !isCorrect ? `${prefixes[q.correctIndex]}. ${q.options[q.correctIndex]} — đáp án đúng` : '',
        explanation: this.getExplanationForQuestion(q.id)
      };
    });

    this.summary.correctCount = correct;
    this.summary.wrongCount = wrong;

    const total = quizData.questions.length;
    this.summary.percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    this.summary.statusText = this.summary.percentage >= 70 ? 'Hoàn thành xuất sắc' : 'Cần cố gắng hơn';
    this.summary.xpGained = correct * 50;
  }

  private getExplanationForQuestion(id: number): string {
    const explanations: any = {
      1: 'UseExceptionHandler là Middleware chuẩn quy định xử lý lỗi tập trung toàn hệ thống.',
      2: 'Dependency Injection trong .NET hỗ trợ 3 loại Lifetime: Transient, Scoped và Singleton.',
      3: 'Data Annotation [Key] dùng để chỉ định khóa chính trong EF Core.',
      4: 'signal() là hàm khởi tạo giá trị tín hiệu (signal) trong Angular.',
      5: 'update() được dùng để cập nhật giá trị dựa trên giá trị hiện tại của Signal.'
    };
    return explanations[id] || 'Đang cập nhật giải thích.';
  }

  logout() {
    this.router.navigate(['/login']);
  }
}
