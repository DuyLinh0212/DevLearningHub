import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { QuizService } from '../services/quiz.service';
import { map, catchError, of } from 'rxjs';

export const quizAccessGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const quizService = inject(QuizService);
  const quizId = route.paramMap.get('id');

  if (!quizId) {
    router.navigate(['/quiz-bank']);
    return false;
  }

  return quizService.getQuiz(quizId).pipe(
    map(quiz => {
      if (quiz && quiz.statusClass === 'public') {
        return true;
      }
      router.navigate(['/quiz-bank']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/quiz-bank']);
      return of(false);
    })
  );
};
