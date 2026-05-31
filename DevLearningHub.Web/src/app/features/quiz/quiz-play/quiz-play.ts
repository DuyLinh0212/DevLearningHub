import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-play',
  standalone: true,
  imports: [],
  templateUrl: './quiz-play.html',
  styleUrl: './quiz-play.css'
})
export class QuizPlayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);

  quizId: string = '';
  quizData: any;
  quizTitle: string = '';
  totalQuestions: number = 0;
  questions: any[] = [];
  currentQuestionIndex = 0;
  isConfirmModalOpen = false;
  isExitModalOpen = false;

  selectedAnswers: (number | null)[] = [];
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
    this.quizData = this.quizService.getQuiz(this.quizId);

    this.quizTitle = this.quizData.title;
    this.totalQuestions = this.quizData.questions ? this.quizData.questions.length : 0;

    this.timeLeft.set((this.quizData.duration || 15) * 60);

    this.questions = this.quizData.questions ? this.quizData.questions.slice() : [];

    if (this.quizData.shuffle && this.questions.length > 0) {
      this.questions.sort(() => Math.random() - 0.5);
    }

    this.selectedAnswers = new Array(this.totalQuestions).fill(null);
    this.startTimer();
    this.quizService.incrementAttempts(this.quizId);
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
      } else {
        clearInterval(this.timerInterval);
        this.forceSubmitQuiz();
      }
    }, 1000);
  }

  onAnswerSelect(optionIndex: number) {
    this.selectedAnswers[this.currentQuestionIndex] = optionIndex;
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

  private getActualTimeSpent(): string {
    const totalDurationSeconds = (this.quizData?.duration || 15) * 60;
    const totalSec = totalDurationSeconds - this.timeLeft();
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m} phút ${s} giây`;
  }

  confirmSubmit() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.quizService.saveResults(this.selectedAnswers, this.getActualTimeSpent(), this.quizId);
    this.isConfirmModalOpen = false;
    this.router.navigate(['/quiz-result', this.quizId]);
  }

  forceSubmitQuiz() {
    this.quizService.saveResults(this.selectedAnswers, this.getActualTimeSpent(), this.quizId);
    this.isConfirmModalOpen = false;
    this.router.navigate(['/quiz-result', this.quizId]);
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

  getOptionClass(optionIndex: number): string {
    const currentSelected = this.selectedAnswers[this.currentQuestionIndex];
    const isSelected = currentSelected === optionIndex;

    if (!this.quizData?.instantResult) {
      return isSelected ? 'selected' : '';
    }

    if (currentSelected === null) {
      return '';
    }

    const correctIdx = this.questions[this.currentQuestionIndex].correctIndex;

    if (optionIndex === correctIdx) {
      return 'correct';
    }

    if (isSelected && optionIndex !== correctIdx) {
      return 'incorrect';
    }

    return '';
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
