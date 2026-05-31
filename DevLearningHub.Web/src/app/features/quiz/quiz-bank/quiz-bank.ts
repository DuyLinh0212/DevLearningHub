import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-quiz-bank',
  standalone: true,
  imports: [RouterLink, SidebarComponent],
  templateUrl: './quiz-bank.html',
  styleUrl: './quiz-bank.css'
})
export class QuizBankComponent implements OnInit {
  private quizService = inject(QuizService);
  private route = inject(ActivatedRoute);

  quizzes: any[] = [];
  searchText: string = '';
  selectedStatus: string = 'all';

  ngOnInit() {
    this.quizzes = this.quizService.getAllQuizzes();

    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchText = params['search'];
      }
    });
  }

  get filteredQuizzes(): any[] {
    return this.quizzes.filter(quiz => {
      const matchesSearch = quiz.title.toLowerCase().includes(this.searchText.toLowerCase()) ||
        quiz.desc.toLowerCase().includes(this.searchText.toLowerCase());

      if (this.selectedStatus === 'all') {
        return matchesSearch;
      } else if (this.selectedStatus === 'public') {
        return matchesSearch && quiz.statusClass === 'public';
      } else if (this.selectedStatus === 'draft') {
        return matchesSearch && quiz.statusClass === 'draft';
      }
      return matchesSearch;
    });
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;
  }

  changeFilter(status: string) {
    this.selectedStatus = status;
  }
}
