import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { DashboardComponent } from './features/dashboard/dashboard';
import { QuizBankComponent } from './features/quiz/quiz-bank/quiz-bank';
import { QuizCreateComponent } from './features/quiz/quiz-create/quiz-create';
import { QuizDetailComponent } from './features/quiz/quiz-detail/quiz-detail';
import { QuizPlayComponent } from './features/quiz/quiz-play/quiz-play';
import { QuizResultComponent } from './features/quiz/quiz-result/quiz-result';
import { quizAccessGuard } from './core/guards/quiz-access.guard';
import { LandingComponent } from './features/landing/landing';
import { RoadmapViewComponent } from './features/roadmap/roadmap-view/roadmap-view';
import { UserProgressComponent } from './features/user/user-progress/user-progress';
import { SettingsComponent } from './features/settings/settings';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'quiz-bank', component: QuizBankComponent },
  { path: 'quiz-create', component: QuizCreateComponent },
  { path: 'quiz/:id', component: QuizDetailComponent, canActivate: [quizAccessGuard] },
  { path: 'quiz-play/:id', component: QuizPlayComponent, canActivate: [quizAccessGuard] },
  { path: 'quiz-result/:id', component: QuizResultComponent },
  { path: 'landing', component: LandingComponent },
  { path: 'roadmap', component: RoadmapViewComponent },
  { path: 'dashboard/progress', component: UserProgressComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '', redirectTo: 'landing', pathMatch: 'full' }
];