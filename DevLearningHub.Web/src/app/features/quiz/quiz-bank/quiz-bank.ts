import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quiz-bank',
  standalone: true,
  imports: [RouterLink, SidebarComponent, CommonModule],
  templateUrl: './quiz-bank.html',
  styleUrl: './quiz-bank.css'
})
export class QuizBankComponent implements OnInit {
  private quizService = inject(QuizService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  quizzes: any[] = [];
  searchText: string = '';
  selectedStatus: string = 'all';

  ngOnInit() {
    this.quizService.getAllQuizzes().subscribe({
      next: (res: any) => {
        const rawData = Array.isArray(res) ? res : (res?.data || []);
        
        this.quizzes = rawData.map((quiz: any) => ({
          id: quiz.id || quiz.Id,
          title: quiz.title || quiz.Title,
          desc: quiz.desc || quiz.description || quiz.Description || 'Chưa có mô tả',
          questions: quiz.questions || quiz.questionCount || quiz.QuestionCount || 0,
          duration: quiz.duration || (quiz.timeLimitSeconds ? Math.round(quiz.timeLimitSeconds / 60) : 15),
          attempts: quiz.attempts || 0,
          statusClass: quiz.statusClass || (quiz.isPublic ? 'public' : 'draft')
        }));
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.quizzes = [];
        this.cdr.detectChanges();
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchText = params['search'];
        this.cdr.detectChanges();
      }
    });
  }

  get filteredQuizzes(): any[] {
    if (!Array.isArray(this.quizzes)) return [];

    return this.quizzes.filter(quiz => {
      const title = (quiz.title || '').toString().toLowerCase();
      const desc = (quiz.desc || '').toString().toLowerCase();
      const statusClass = (quiz.statusClass || 'public').toString().toLowerCase();
      const searchLower = this.searchText.toLowerCase();
      const matchesSearch = title.includes(searchLower) || desc.includes(searchLower);

      if (this.selectedStatus === 'all') {
        return matchesSearch;
      } else if (this.selectedStatus === 'public') {
        return matchesSearch && statusClass === 'public';
      } else if (this.selectedStatus === 'draft') {
        return matchesSearch && statusClass === 'draft';
      }
      return matchesSearch;
    });
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input) {
      this.searchText = input.value;
      this.cdr.detectChanges();
    }
  }

  changeFilter(status: string) {
    this.selectedStatus = status;
    this.cdr.detectChanges();
  }
}