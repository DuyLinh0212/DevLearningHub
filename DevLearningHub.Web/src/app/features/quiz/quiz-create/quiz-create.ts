import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { QuizService } from '../../../core/services/quiz.service';

@Component({
  selector: 'app-quiz-create',
  standalone: true,
  imports: [RouterLink, FormsModule, SidebarComponent],
  templateUrl: './quiz-create.html',
  styleUrl: './quiz-create.css'
})
export class QuizCreateComponent implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private quizService = inject(QuizService);

  currentStep: number = 1;
  isPreviewModalOpen: boolean = false;
  editingQuizId: string | null = null; // Biến lưu ID nếu ở chế độ sửa

  topics: string[] = [
    'Lập trình Backend',
    'Lập trình Frontend',
    'Cơ sở dữ liệu',
    'Kiểm thử phần mềm',
    'An toàn thông tin'
  ];

  quizMeta = {
    title: '',
    desc: '',
    topic: 'Lập trình Backend',
    level: 'Trung bình',
    duration: 15,
    passRate: 70,
    shuffle: true,
    instantResult: true
  };

  questions: any[] = [
    {
      points: 10,
      type: 'single',
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0
    }
  ];

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['id']) {
        this.editingQuizId = params['id'];
        this.quizService.getQuiz(this.editingQuizId!).subscribe({
          next: (existingData) => {
            if (existingData) {
              this.quizMeta = {
                title: existingData.title,
                desc: existingData.desc,
                topic: existingData.topic || 'Lập trình Backend',
                level: existingData.level || 'Trung bình',
                duration: existingData.duration,
                passRate: existingData.passRate || 70,
                shuffle: existingData.shuffle !== undefined ? existingData.shuffle : true,
                instantResult: existingData.instantResult !== undefined ? existingData.instantResult : true
              };

              if (existingData.questions && existingData.questions.length > 0) {
                this.questions = existingData.questions.map((q: any) => ({
                  points: q.points,
                  type: q.type || 'single',
                  text: q.text,
                  options: [...q.options],
                  correctIndex: q.correctIndex
                }));
              }
            }
          },
          error: (err) => {
            console.error(err);
          }
        });
      }
    });
  }

  nextStep() {
    if (this.quizMeta.title.trim()) {
      this.currentStep = 2;
    }
  }

  prevStep() {
    this.currentStep = 1;
  }

  addQuestion() {
    this.questions.push({
      points: 10,
      type: 'single',
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0
    });
  }

  removeQuestion(index: number) {
    if (this.questions.length > 1) {
      this.questions.splice(index, 1);
    }
  }

  setCorrectAnswer(qIdx: number, oIdx: number) {
    this.questions[qIdx].correctIndex = oIdx;
  }

  openPreview() {
    if (this.quizMeta.title.trim()) {
      this.isPreviewModalOpen = true;
    }
  }

  closePreview() {
    this.isPreviewModalOpen = false;
  }

  saveDraft() {
    if (this.quizMeta.title.trim()) {
      this.quizService.addCustomQuiz(this.quizMeta, this.questions, true, this.editingQuizId || undefined).subscribe({
        next: () => {
          this.router.navigate(['/quiz-bank']);
        },
        error: (err) => {
          console.error(err);
        }
      });
      return;
    }
    this.router.navigate(['/quiz-bank']);
  }

  completeQuiz() {
    if (this.quizMeta.title.trim()) {
      this.quizService.addCustomQuiz(this.quizMeta, this.questions, false, this.editingQuizId || undefined).subscribe({
        next: () => {
          this.router.navigate(['/quiz-bank']);
        },
        error: (err) => {
          console.error(err);
        }
      });
      return;
    }
    this.router.navigate(['/quiz-bank']);
  }
}
