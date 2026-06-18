import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-quiz-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, CommonModule],
  templateUrl: './quiz-detail.html',
  styleUrl: './quiz-detail.css'
})
export class QuizDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizService = inject(QuizService);
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);

  quizId: string = '';
  quizTitle: string = '';
  quizDesc: string = '';
  quizDuration: number = 0;
  quizQuestionsCount: number = 0;
  quizLevel: string = 'Chưa xác định';
  quizShuffle: boolean = false;
  quizInstantResult: boolean = false;
  quizAllowedCopy: boolean = true;
  currentUserId: string = '';
  quizCreatedBy: string = '';
  quizCreatedById: string = '';
  quizLevelRaw: string = 'beginner';

  selectedExamCount: number = 10;

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.quizId) {
      this.router.navigate(['/quiz-bank']);
      return;
    }

    this.loadCurrentUser();
  }

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.currentUserId = (user?.id || user?.Id || user?.userId || user?.sub || '')
          .toString()
          .toLowerCase();
        this.loadQuizDetails();
      },
      error: () => {
        this.currentUserId = '';
        this.loadQuizDetails();
      }
    });
  }

  loadQuizDetails() {
    this.quizService.getQuiz(this.quizId).subscribe({
      next: (res: any) => {
        const quiz = res?.data || res;

        if (!quiz) {
          return;
        }

        this.quizTitle = quiz.title || 'Không có tiêu đề';
        this.quizDesc = quiz.description || quiz.desc || 'Chưa có mô tả chi tiết từ giảng viên.';
        this.quizCreatedBy = this.getQuizCreatorDisplayName(quiz);
        this.quizCreatedById = this.getQuizCreatorId(quiz);
        this.quizQuestionsCount = quiz.questionCount ?? quiz.questionsCount ?? 0;
        this.quizDuration = quiz.duration || (quiz.timeLimitSeconds ? Math.floor(quiz.timeLimitSeconds / 60) : 15);
        this.quizShuffle = quiz.shuffle || false;
        this.quizInstantResult = quiz.instantResult || false;
        this.quizAllowedCopy = quiz.allowedCopy ?? quiz.AllowedCopy ?? true;

        const rawLevel = (quiz.level || 'beginner').toString().toLowerCase().trim();
        this.quizLevelRaw = rawLevel;
        if (rawLevel === 'beginner' || rawLevel === 'easy') {
          this.quizLevel = 'Dễ';
        } else if (rawLevel === 'intermediate' || rawLevel === 'medium') {
          this.quizLevel = 'Trung bình';
        } else {
          this.quizLevel = 'Khó';
        }

        if (this.quizQuestionsCount < 10 && this.quizQuestionsCount > 0) {
          this.selectedExamCount = this.quizQuestionsCount;
        }

        this.cdr.detectChanges();
      },
      error: () => {
        this.router.navigate(['/quiz-bank']);
      }
    });
  }

  decreaseExamCount() {
    if (this.selectedExamCount > 1) {
      this.selectedExamCount--;
      this.cdr.detectChanges();
    }
  }

  increaseExamCount() {
    if (this.selectedExamCount < this.quizQuestionsCount) {
      this.selectedExamCount++;
      this.cdr.detectChanges();
    }
  }

  startQuiz(mode: 'practice' | 'exam') {
    const limit = mode === 'exam' ? this.selectedExamCount : this.quizQuestionsCount;
    this.router.navigate(['/quiz-play', this.quizId], {
      queryParams: { mode, limit }
    });
  }

  get isExamCountInvalid(): boolean {
    return this.selectedExamCount > this.quizQuestionsCount || this.selectedExamCount < 1;
  }

  get showQuizCreator(): boolean {
    return !!this.quizCreatedBy && !this.compareIds(this.quizCreatedBy, this.currentUserId);
  }

  get isOwner(): boolean {
    return this.compareIds(this.quizCreatedById, this.currentUserId);
  }

  getExamErrorMessage(): string {
    if (this.selectedExamCount > this.quizQuestionsCount) {
      return `Chỉ có tối đa ${this.quizQuestionsCount} câu hỏi trong bộ đề này.`;
    }
    if (this.selectedExamCount < 1) {
      return 'Số câu hỏi phải lớn hơn 0.';
    }
    return '';
  }

  private getQuizCreatorDisplayName(quiz: any): string {
    const fullName = quiz.createdByFullName ?? quiz.CreatedByFullName ?? '';
    if (fullName) {
      return fullName.toString().trim();
    }

    const creator = quiz.createdBy ?? quiz.CreatedBy ?? quiz.userId ?? quiz.UserId ?? '';
    return creator.toString().trim();
  }

  private getQuizCreatorId(quiz: any): string {
    return (quiz.createdBy ?? quiz.CreatedBy ?? quiz.userId ?? quiz.UserId ?? '')
      .toString()
      .trim();
  }

  private compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
  }

  updateAllowedCopy(allowedCopy: boolean) {
    if (!this.compareIds(this.quizCreatedById, this.currentUserId)) {
      return;
    }

    this.http.put<any>(`/api/quiz-sets/${this.quizId}`, {
      title: this.quizTitle,
      description: this.quizDesc,
      mode: 'practice',
      timeLimitSeconds: this.quizDuration * 60,
      isPublic: true,
      allowedCopy: allowedCopy,
      topicId: null,
      level: this.quizLevelRaw
    }).subscribe({
      next: () => {
        this.quizAllowedCopy = allowedCopy;
        alert(allowedCopy ? 'Đã bật quyền sao chép.' : 'Đã tắt quyền sao chép.');
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Không thể cập nhật quyền sao chép.');
      }
    });
  }
}
