import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-play',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-play.html',
  styleUrl: './quiz-play.css'
})
export class QuizPlayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);
  private cdr = inject(ChangeDetectorRef);

  sessionId: string = '';
  quizId: string = '';
  quizData: any;
  quizTitle: string = '';
  totalQuestions: number = 0;
  questions: any[] = [];
  currentQuestionIndex = 0;
  isConfirmModalOpen = false;
  isExitModalOpen = false;

  selectedAnswers: (any | null)[] = [];
  bookmarkedQuestions: boolean[] = [];

  timeLeft = signal<number>(900);
  timerInterval: any;

  formattedTime = computed(() => {
    const time = this.timeLeft();
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    const pad = (num: number) => num < 10 ? `0${num}` : `${num}`;
    return `${pad(minutes)}:${pad(seconds)}`;
  });

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '1';
    this.quizService.startQuizSession(this.quizId).subscribe({
      next: (res) => {
        setTimeout(() => {
          const target = res?.data || res;
          if (!target) return;

          this.quizData = target;
          this.sessionId = target.sessionId || '';
          this.quizTitle = target.title || '';
          this.totalQuestions = target.totalQuestions || (target.questions ? target.questions.length : 0);
          this.timeLeft.set(target.timeLimitSeconds || 900);

          const rawQuestions = target.questions || [];
          this.questions = rawQuestions.map((q: any) => {
            return {
              id: q.questionId || q.id,
              text: q.content || '',
              level: q.level || 'Beginner',
              points: q.points || 10,
              options: q.options || [],
              correctIndex: -1
            };
          });

          this.selectedAnswers = new Array(this.totalQuestions).fill(null);
          this.bookmarkedQuestions = new Array(this.totalQuestions).fill(false);
          this.startTimer();
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.timeLeft() > 0) {
        this.timeLeft.update((time: number) => time - 1);
        this.cdr.detectChanges();
      } else {
        clearInterval(this.timerInterval);
        this.forceSubmitQuiz();
      }
    }, 1000);
  }

  onAnswerSelect(optionId: string, questionId: string) {
    this.selectedAnswers[this.currentQuestionIndex] = {
      questionId: questionId,
      selectedOptionId: optionId,
      optionId: optionId
    };
    this.cdr.detectChanges();
  }

  toggleBookmark() {
    this.bookmarkedQuestions[this.currentQuestionIndex] = !this.bookmarkedQuestions[this.currentQuestionIndex];
  }

  openConfirmModal() {
    this.isConfirmModalOpen = true;
  }

  closeConfirmModal() {
    this.isConfirmModalOpen = false;
  }

  openExitModal() {
    this.isExitModalOpen = true;
  }

  closeExitModal() {
    this.isExitModalOpen = false;
  }

  confirmExit() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.isExitModalOpen = false;
    this.router.navigate(['/quiz-bank']);
  }

  confirmSubmit() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    const submitPayload = this.questions.map((q, idx) => {
      const ans = this.selectedAnswers[idx];
      return {
        questionId: q.id,
        selectedOptionId: ans ? ans.selectedOptionId : null
      };
    });

    sessionStorage.setItem('quiz_title', this.quizTitle);
    sessionStorage.setItem('quiz_questions', JSON.stringify(
      this.questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options
      }))
    ));

    this.quizService.submitQuizSession(this.sessionId, submitPayload).subscribe({
      next: () => {
        this.isConfirmModalOpen = false;
        this.router.navigate(['/quiz-result', this.sessionId]);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  forceSubmitQuiz() {
    const submitPayload = this.questions.map((q, idx) => {
      const ans = this.selectedAnswers[idx];
      return {
        questionId: q.id,
        selectedOptionId: ans ? ans.selectedOptionId : null
      };
    });

    sessionStorage.setItem('quiz_title', this.quizTitle);
    sessionStorage.setItem('quiz_questions', JSON.stringify(
      this.questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options
      }))
    ));

    this.quizService.submitQuizSession(this.sessionId, submitPayload).subscribe({
      next: () => {
        this.isConfirmModalOpen = false;
        this.router.navigate(['/quiz-result', this.sessionId]);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  get answeredCount(): number {
    return this.selectedAnswers.filter(ans => ans !== null).length;
  }

  get unansweredCount(): number {
    return this.questions.length - this.answeredCount;
  }

  get bookmarkedCount(): number {
    return this.bookmarkedQuestions.filter(b => b).length;
  }

  get completionPercentage(): number {
    if (this.questions.length === 0) return 0;
    return Math.round((this.answeredCount / this.questions.length) * 100);
  }

  getOptionClass(optionId: string): string {
    const currentSelected = this.selectedAnswers[this.currentQuestionIndex];
    return currentSelected && currentSelected.optionId === optionId ? 'selected' : '';
  }

  selectQuestion(index: number) {
    this.currentQuestionIndex = index;
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
    }
  }
}