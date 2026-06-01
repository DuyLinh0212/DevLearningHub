import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { DashboardComponent } from './features/dashboard/dashboard';
import { QuizBankComponent } from './features/quiz/quiz-bank/quiz-bank';
import { QuizDetailComponent } from './features/quiz/quiz-detail/quiz-detail';
import { QuizPlayComponent } from './features/quiz/quiz-play/quiz-play';
import { QuizResultComponent } from './features/quiz/quiz-result/quiz-result';
import { quizAccessGuard } from './core/guards/quiz-access.guard';
import { QuizCreateComponent } from './features/quiz/quiz-create/quiz-create';
import { LandingComponent } from './features/landing/landing';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { QuizManagementComponent } from './features/admin/quiz-management/quiz-management';
import { QuestionImportComponent } from './features/admin/question-import/question-import';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'quiz-bank', component: QuizBankComponent },
  { path: 'quiz/:id', component: QuizDetailComponent, canActivate: [quizAccessGuard] },
  { path: 'quiz-play/:id', component: QuizPlayComponent, canActivate: [quizAccessGuard] },
  { path: 'quiz-result/:id', component: QuizResultComponent },
  { path: 'quiz-create', component: QuizCreateComponent },
  { path: 'landing', component: LandingComponent },
  { path: 'admin', component: AdminDashboardComponent },
  { path: 'admin/quiz', component: QuizManagementComponent },
  { path: 'admin/quiz/import', component: QuestionImportComponent },
  { path: '', redirectTo: 'landing', pathMatch: 'full' } 
];
