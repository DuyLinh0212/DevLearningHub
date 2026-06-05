import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizService } from '../../../core/services/quiz.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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
  private http = inject(HttpClient);

  quizzes: any[] = [];
  searchText: string = '';
  selectedStatus: string = 'all';
  currentUserId: string = '';

  ngOnInit() {
    this.loadCurrentUser();
  }

  loadCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        if (user) {
          this.currentUserId = (user.id || user.Id || user.userId || user.sub || '').toString().toLowerCase();
        }
        this.loadQuizzes();
      },
      error: (err) => {
        console.error(err);
        this.loadQuizzes();
      }
    });
  }

  loadQuizzes() {
    this.quizService.getAllQuizzes().subscribe({
      next: (res: any) => {
        const rawData = Array.isArray(res) ? res : (res?.data || []);
        
        this.quizzes = rawData.map((quiz: any) => {
          let creator = '';
          const rawCreator = quiz.createdBy || quiz.CreatedBy || 
                             quiz.userId || quiz.UserId || 
                             quiz.creatorId || quiz.CreatorId || 
                             quiz.authorId || quiz.AuthorId ||
                             quiz.ownerId || quiz.OwnerId;

          if (rawCreator) {
            if (typeof rawCreator === 'string') {
              creator = rawCreator.toLowerCase();
            } else if (typeof rawCreator === 'object') {
              creator = (rawCreator.id || rawCreator.Id || rawCreator.userId || rawCreator.UserId || '').toString().toLowerCase();
            }
          }

          if (!creator && quiz.user) {
            creator = (quiz.user.id || quiz.user.Id || '').toString().toLowerCase();
          }

          return {
            id: quiz.id || quiz.Id,
            title: quiz.title || quiz.Title,
            desc: quiz.desc || quiz.description || quiz.Description || 'Chưa có mô tả',
            
            questions: quiz.questionCount !== undefined ? quiz.questionCount : (quiz.questionsCount || 0),
            attempts: quiz.attempts !== undefined ? quiz.attempts : 0,
            
            statusClass: quiz.statusClass || (quiz.status === 'Đã phát hành' || quiz.isPublic ? 'public' : 'draft'),
            status: quiz.status || (quiz.isPublic ? 'Đã phát hành' : 'Bản nháp'),
            updated: quiz.updated || quiz.updatedAt || 'Vừa xong',
            createdBy: creator
          };
        });
        
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

  compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
  }
}