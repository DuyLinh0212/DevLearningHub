import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-quiz-detail',
  standalone: true,
  imports: [RouterLink, SidebarComponent],
  templateUrl: './quiz-detail.html',
  styleUrl: './quiz-detail.css'
  })
export class QuizDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
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

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.quizId) {
      console.error('Không tìm thấy mã bộ đề Quiz ID trên đường dẫn URL!');
      return;
    }

    this.quizService.getQuiz(this.quizId).subscribe({
      next: (res: any) => {
        
        const target = res?.data || res;
        
        if (target) {
          this.quizTitle = target.title || target.Title || 'Không có tiêu đề';
          this.quizDesc = target.description || target.Description || target.desc || target.Desc || 'Chưa có mô tả.';
          
          if (target.questionCount !== undefined) {
            this.quizQuestionsCount = target.questionCount;
          } else if (target.QuestionCount !== undefined) {
            this.quizQuestionsCount = target.QuestionCount;
          } else if (Array.isArray(target.questions)) {
            this.quizQuestionsCount = target.questions.length;
          } else {
            this.quizQuestionsCount = 0;
          }
          
          if (target.duration !== undefined) {
            this.quizDuration = target.duration;
          } else {
            const seconds = target.timeLimitSeconds || target.TimeLimitSeconds || 0;
            this.quizDuration = seconds > 0 ? Math.round(seconds / 60) : 15;
          }

          this.quizShuffle = target.shuffle !== undefined ? target.shuffle : (target.Shuffle || false);
          this.quizInstantResult = target.instantResult !== undefined ? target.instantResult : (target.InstantResult || false);
          
          const rawLevel = (target.level || target.Level || 'beginner').toString().toLowerCase();
          if (rawLevel === 'beginner' || rawLevel === 'easy') {
            this.quizLevel = 'Dễ';
          } else if (rawLevel === 'medium') {
            this.quizLevel = 'Trung bình';
          } else {
            this.quizLevel = 'Khó';
          }

          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Lỗi hệ thống khi gọi API Detail:', err);
      }
    });
  }
}