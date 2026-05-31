import { Component, inject, OnInit } from '@angular/core';
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

  quizId: string = '';
  quizTitle: string = '';
  quizDesc: string = '';
  quizDuration: number = 0;
  quizQuestionsCount: number = 0;

  ngOnInit() {
    this.quizId = this.route.snapshot.paramMap.get('id') || '1';

    const quizData = this.quizService.getQuiz(this.quizId);
    this.quizTitle = quizData.title;
    this.quizDesc = quizData.desc || 'Mô tả bộ đề đang được cập nhật.';
    this.quizDuration = quizData.duration || 15;
    this.quizQuestionsCount = quizData.questions ? quizData.questions.length : 0;
  }
}
