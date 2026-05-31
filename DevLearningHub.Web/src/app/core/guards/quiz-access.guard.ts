import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { QuizService } from '../services/quiz.service';

export const quizAccessGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const quizService = inject(QuizService);
  const quizId = route.paramMap.get('id');

  if (!quizId) {
    router.navigate(['/quiz-bank']);
    return false;
  }

  const quiz = quizService.getQuiz(quizId);
  if (quiz && quiz.statusClass === 'public') {
    return true;
  }

  router.navigate(['/quiz-bank']);
  return false;
};
