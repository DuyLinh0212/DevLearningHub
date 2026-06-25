import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-quiz-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-edit.html',
  styleUrl: './quiz-edit.css'
})
export class QuizEditComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  quizId!: string;
  quizData: any = {};
  currentUser: any = {};
  isCreator: boolean = false;
  isSaving: boolean = false;

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '';
    this.getCurrentUser();
  }

  getCurrentUser() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        this.currentUser = res?.data || res;
        this.loadQuizDetails();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

loadQuizDetails() {
  this.http.get<any>(`/api/quiz-sets/${this.quizId}`).subscribe({
    next: (res) => {
      const data = res?.data || res;
      this.quizData = data;
      
      const creatorId = (data.createdBy || data.userId || '').toString().toLowerCase();
      const currentId = (this.currentUser.id || '').toString().toLowerCase();
      
      this.isCreator = (creatorId === currentId);
      
      if (!this.isCreator) {
        alert('Bạn không có quyền chỉnh sửa bộ đề này!');
        this.router.navigate(['/quiz-bank']);
      }
      this.cdr.detectChanges();
    },
    error: (err) => console.error(err)
  });
}

  saveQuiz() {
  if (this.isSaving) return;
  this.isSaving = true;

  const payload = {
    title: this.quizData.title,
    description: this.quizData.description,
    mode: this.quizData.mode || 'practice',
    timeLimitSeconds: (this.quizData.duration || 15) * 60,
    isPublic: this.quizData.isPublic ?? true,
    allowedCopy: this.quizData.allowedCopy ?? true,
    topicId: this.quizData.topicId || null,
    level: this.quizData.level || 'beginner'
  };

  this.http.put<any>(`/api/quiz-sets/${this.quizId}`, payload).subscribe({
    next: () => {
      this.isSaving = false;
      alert('Cập nhật thành công!');
      this.router.navigate(['/quiz-bank']);
    },
    error: (err) => {
      this.isSaving = false;
      alert('Cập nhật thất bại, check log F12!');
      console.error(err);
    }
  });
}
}
