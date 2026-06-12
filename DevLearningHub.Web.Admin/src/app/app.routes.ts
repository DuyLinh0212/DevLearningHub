import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { DashboardComponent } from './features/dashboard/dashboard';
import { LandingComponent } from './features/landing/landing';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { QuizManagementComponent } from './features/admin/quiz-management/quiz-management';
import { QuestionImportComponent } from './features/admin/question-import/question-import';
import { RoadmapManagementComponent } from './features/admin/roadmap-management/roadmap-management';
import { TopicManagementComponent } from './features/admin/topic-management/topic-management';
import { SettingsComponent } from './features/settings/settings';
import { adminGuard } from './core/guards/admin.guard';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'landing', component: LandingComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard]},
  { path: 'admin/quiz', component: QuizManagementComponent },
  { path: 'admin/quiz/import', component: QuestionImportComponent },
  { path: 'admin/roadmap', component: RoadmapManagementComponent },
  { path: 'admin/topics', component: TopicManagementComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '', redirectTo: 'landing', pathMatch: 'full' }
];
