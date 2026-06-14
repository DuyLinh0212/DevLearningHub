import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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

  quizId: string = '';
  quizTitle: string = '';
  quizDesc: string = '';
  quizDuration: number = 0;
  quizQuestionsCount: number = 0;
  quizLevel: string = 'Chưa xác định';
  quizShuffle: boolean = false;
  quizInstantResult: boolean = false;

  selectedExamCount: number = 10;

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.quizId) {
      this.router.navigate(['/quiz-bank']);
      return;
    }

    console.log('=== USER_DETAIL: BẮT ĐẦU TẢI CHI TIẾT BỘ ĐỀ ===');
    this.quizService.getQuiz(this.quizId).subscribe({
      next: (res: any) => {
        // PHÒNG THỦ: Bóc tách lớp vỏ bọc data từ Swagger của Nam
        const quiz = res?.data || res;
        
        if (quiz) {
          console.log('Dữ liệu thô bộ đề nhận từ Swagger:', quiz);
          
          this.quizTitle = quiz.title || 'Không có tiêu đề';
          this.quizDesc = quiz.description || quiz.desc || 'Chưa có mô tả chi tiết từ giảng viên.';
          
          // Đọc chính xác trường không có chữ 's' từ Backend
          this.quizQuestionsCount = quiz.questionCount ?? quiz.questionsCount ?? 0;
          
          // Tính toán số phút từ trường giây timeLimitSeconds
          this.quizDuration = quiz.duration || (quiz.timeLimitSeconds ? Math.floor(quiz.timeLimitSeconds / 60) : 15); 
          
          this.quizShuffle = quiz.shuffle || false;
          this.quizInstantResult = quiz.instantResult || false;

          const rawLevel = (quiz.level || 'beginner').toString().toLowerCase().trim();
          if (rawLevel === 'beginner' || rawLevel === 'easy') {
            this.quizLevel = 'Dễ';
          } else if (rawLevel === 'intermediate' || rawLevel === 'medium') {
            this.quizLevel = 'Trung bình';
          } else {
            this.quizLevel = 'Khó';
          }

          // Cập nhật lại số câu mặc định ban đầu bằng đúng tổng số câu nếu tổng câu nhỏ hơn 10
          if (this.quizQuestionsCount < 10 && this.quizQuestionsCount > 0) {
            this.selectedExamCount = this.quizQuestionsCount;
          }

          console.log(`=== ĐỒNG BỘ THÀNH CÔNG === Số câu: ${this.quizQuestionsCount} | Thời gian: ${this.quizDuration} phút`);
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Lỗi gọi API chi tiết bộ đề:', err);
        this.router.navigate(['/quiz-bank']);
      }
    });
  }

  // ⚡ HÀM STEPPER GIẢM SỐ CÂU (BẮT BUỘC CÓ CHO FILE HTML)
  decreaseExamCount() {
    if (this.selectedExamCount > 1) {
      this.selectedExamCount--;
      this.cdr.detectChanges();
    }
  }

  // ⚡ HÀM STEPPER TĂNG SỐ CÂU (BẮT BUỘC CÓ CHO FILE HTML)
  increaseExamCount() {
    if (this.selectedExamCount < this.quizQuestionsCount) {
      this.selectedExamCount++;
      this.cdr.detectChanges();
    }
  }

  startQuiz(mode: 'practice' | 'exam') {
    const limit = mode === 'exam' ? this.selectedExamCount : this.quizQuestionsCount;
    this.router.navigate(['/quiz-play', this.quizId], {
      queryParams: { mode: mode, limit: limit }
    });
  }

  get isExamCountInvalid(): boolean {
    return this.selectedExamCount > this.quizQuestionsCount || this.selectedExamCount < 1;
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
}