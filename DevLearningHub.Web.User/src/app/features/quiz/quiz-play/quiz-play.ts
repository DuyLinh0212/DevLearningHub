import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ReportService } from '../../../core/services/report.service';

@Component({
  selector: 'app-quiz-play',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './quiz-play.html',
  styleUrl: './quiz-play.css'
})
export class QuizPlayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private reportService = inject(ReportService);

  sessionId: string = '';
  quizId: string = '';
  quizTitle: string = '';

  quizMode: string = 'practice';
  questionLimit: number = 0;

  totalQuestions: number = 0;
  originalTotalQuestions: number = 0; // Tổng câu gốc của bộ đề (không bị limit bởi thi thử)
  questions: any[] = [];
  currentQuestionIndex = 0;

  isConfirmModalOpen = false;
  isExitModalOpen = false;
  isReportModalOpen = false;
  reportDescription = '';
  noQuestionsError = false;

  selectedAnswers: (any | null)[] = [];
  bookmarkedQuestions: boolean[] = [];

  userFullName: string = 'Học viên';
  userAvatar: string = 'assets/images/default-avatar.svg';

  timeLeft = signal<number>(900);
  timerInterval: any;

  formattedTime = computed(() => {
    if (this.quizMode === 'practice') {
      return '∞';
    }
    const time = this.timeLeft();
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';
    this.quizMode = this.route.snapshot.queryParamMap.get('mode') || 'practice';
    this.questionLimit = Number(this.route.snapshot.queryParamMap.get('limit') || 0);

    if (!this.quizId) {
      this.router.navigate(['/quiz-bank']);
      return;
    }

    this.loadUserProfile();
  }

  loadUserProfile() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const u = res?.data || res;
        if (u) {
          this.userFullName = u.fullName || u.username || 'Học viên';
          this.userAvatar = u.avatarUrl || 'assets/images/default-avatar.svg';
        }
        this.initializeQuizSession();
      },
      error: () => this.initializeQuizSession()
    });
  }

  initializeQuizSession() {
    console.log(`=== PHÒNG THI: KHỞI TẠO PHIÊN VỚI CHẾ ĐỘ = ${this.quizMode.toUpperCase()} ===`);

    this.quizService.startQuizSession(this.quizId).subscribe({
      next: (res) => {
        const target = res?.data || res;
        if (!target) return;

        this.sessionId = target.sessionId || '';
        this.quizTitle = target.title || '';

        const sessionEndTimeKey = `dlh_quiz_end_time_${this.sessionId}`;
        let savedEndTime = sessionStorage.getItem(sessionEndTimeKey);
        let absoluteEndTime: number;

        if (savedEndTime) {
          absoluteEndTime = parseInt(savedEndTime, 10);
        } else {
          const durationSeconds = target.timeLimitSeconds || 900;
          absoluteEndTime = Date.now() + (durationSeconds * 1000);
          sessionStorage.setItem(sessionEndTimeKey, absoluteEndTime.toString());
        }

        let rawQuestions = target.questions || [];

        if (this.quizMode === 'exam' && rawQuestions.length > 0) {
          for (let i = rawQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawQuestions[i], rawQuestions[j]] = [rawQuestions[j], rawQuestions[i]];
          }
          if (this.questionLimit > 0 && this.questionLimit < rawQuestions.length) {
            rawQuestions = rawQuestions.slice(0, this.questionLimit);
          }
        }

        this.questions = rawQuestions.map((q: any) => ({
          id: q.questionId || q.id,
          text: q.content || q.text || 'Nội dung câu hỏi đang được mã hóa...',
          level: q.level || 'Beginner',
          points: q.points || 10,
          options: (q.options || []).map((o: any) => ({
            id: o.id,
            content: o.content || o.text
          }))
        }));

        this.totalQuestions = this.questions.length;
        // Lưu tổng câu gốc từ session (trước khi bị slice bởi limit thi thử)
        this.originalTotalQuestions = (target.questions?.length || this.totalQuestions);
        this.selectedAnswers = new Array(this.totalQuestions).fill(null);
        this.bookmarkedQuestions = new Array(this.totalQuestions).fill(false);

        if (this.quizMode === 'exam') {
          this.startAntiCheatTimer(absoluteEndTime);
        } else {
          console.log('Chế độ Luyện tập: Hủy bỏ giới hạn đồng hồ đếm ngược.');
          sessionStorage.removeItem(sessionEndTimeKey); // Dọn sạch rác bộ nhớ phòng hờ
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.error?.message?.includes('no questions')) {
          this.noQuestionsError = true;
        } else {
          this.router.navigate(['/quiz-bank']);
        }
        this.cdr.detectChanges();
      }
    });
  }

  startAntiCheatTimer(absoluteEndTime: number) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const updateTimer = () => {
      const now = Date.now();
      const distance = Math.max(0, Math.floor((absoluteEndTime - now) / 1000));

      this.timeLeft.set(distance);
      this.cdr.detectChanges();

      if (distance <= 0) {
        clearInterval(this.timerInterval);
        console.warn('=== ĐỒNG HỒ HẾT GIỜ: KÍCH HOẠT LỆNH ÉP THU BÀI TỰ ĐỘNG ===');
        this.forceSubmitQuiz();
      }
    };

    updateTimer();
    this.timerInterval = setInterval(updateTimer, 1000);
  }

  onAnswerSelect(optionId: string, questionId: string) {
    this.selectedAnswers[this.currentQuestionIndex] = {
      questionId: questionId,
      optionId: optionId
    };
    this.cdr.detectChanges();
  }

  toggleBookmark() {
    this.bookmarkedQuestions[this.currentQuestionIndex] = !this.bookmarkedQuestions[this.currentQuestionIndex];
  }

  openConfirmModal() { this.isConfirmModalOpen = true; }
  closeConfirmModal() { this.isConfirmModalOpen = false; }
  openExitModal() { this.isExitModalOpen = true; }
  closeExitModal() { this.isExitModalOpen = false; }
  openReportModal() { this.isReportModalOpen = true; }
  closeReportModal() { this.isReportModalOpen = false; this.reportDescription = ''; }
  submitReport() {
    const currentQuestion = this.questions[this.currentQuestionIndex];
    const targetId = currentQuestion?.id;
    const description = this.reportDescription.trim();

    if (!description) { alert('Vui lòng mô tả lỗi bạn gặp phải.'); return; }
    if (!targetId) { alert('Không xác định được câu hỏi cần báo lỗi.'); return; }

    const enrichedDescription = [
      `Bộ đề: ${this.quizTitle || this.quizId}`,
      `Câu hỏi số: ${this.currentQuestionIndex + 1}`,
      description
    ].join('\n');

    this.reportService.createReport('quiz_question', targetId, enrichedDescription).subscribe({
      next: () => { alert('Cảm ơn bạn! Báo cáo đã được gửi đến người tạo câu hỏi để xem xét.'); this.closeReportModal(); },
      error: (err) => { alert(err?.error?.message || 'Không thể gửi báo cáo. Vui lòng thử lại sau.'); }
    });
  }

  confirmExit() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.router.navigate(['/quiz-bank']);
  }

  confirmSubmit() { this.executeSubmission(); }
  forceSubmitQuiz() { this.executeSubmission(); }

  private executeSubmission() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const submitPayload = this.questions.map((q, idx) => {
      const ans = this.selectedAnswers[idx];
      return {
        questionId: q.id,
        selectedOptionId: ans ? ans.optionId : null // Gửi đúng optionId lên API kiểm tra của Nam
      };
    });

    console.log('=== PHÒNG THI: PAYLOAD NỘP BÀI LÊN SERVER ===', submitPayload);

    sessionStorage.setItem('quiz_title', this.quizTitle);
    if (this.quizMode === 'exam') {
      sessionStorage.removeItem('quiz_questions');
    } else {
      sessionStorage.setItem('quiz_questions', JSON.stringify(this.questions));
    }

    this.quizService.submitQuizSession(this.sessionId, submitPayload).subscribe({
      next: () => {
        sessionStorage.removeItem(`dlh_quiz_end_time_${this.sessionId}`);
        // Cập nhật số lượt làm bài vào localStorage để dashboard và quiz-bank có thể hiển đúng
        this.quizService.incrementAttempts(this.quizId);
        // Lưu tiến độ thực: số câu đã trả lời / tổng câu gốc của bộ đề
        const answered = this.selectedAnswers.filter(a => a !== null).length;
        this.quizService.saveQuizProgress(this.quizId, answered, this.originalTotalQuestions);
        this.isConfirmModalOpen = false;
        this.router.navigate(['/quiz-result', this.sessionId], {
          queryParams: { mode: this.quizMode }
        });
      },
      error: (err) => {
        console.error('Lỗi nộp bài trắc nghiệm:', err);
        alert('Hệ thống mất kết nối mạng cục bộ! Đang nỗ lực nộp lại bài...');
      }
    });
  }

  get answeredCount(): number { return this.selectedAnswers.filter(ans => ans !== null).length; }
  get unansweredCount(): number { return this.questions.length - this.answeredCount; }
  get bookmarkedCount(): number { return this.bookmarkedQuestions.filter(b => b).length; }
  get completionPercentage(): number { return this.questions.length === 0 ? 0 : Math.round((this.answeredCount / this.questions.length) * 100); }
  getOptionClass(optionId: string): string { const cur = this.selectedAnswers[this.currentQuestionIndex]; return cur && cur.optionId === optionId ? 'selected' : ''; }

  selectQuestion(index: number) { this.currentQuestionIndex = index; }
  prevQuestion() { if (this.currentQuestionIndex > 0) this.currentQuestionIndex--; }
  nextQuestion() { if (this.currentQuestionIndex < this.questions.length - 1) this.currentQuestionIndex++; }

  @HostListener('document:keydown', ['$event'])
  onKeyboardNav(event: KeyboardEvent) {
    // Không bắt phím khi modal đang mở, hoặc user đang nhập vào ô input/textarea
    if (this.isConfirmModalOpen || this.isExitModalOpen || this.isReportModalOpen) return;
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevQuestion();
      this.cdr.detectChanges();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextQuestion();
      this.cdr.detectChanges();
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }
}
