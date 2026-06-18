import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { DashboardComponent } from './features/dashboard/dashboard';
import { LandingComponent } from './features/landing/landing';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { QuizManagementComponent } from './features/admin/quiz-management/quiz-management';
import { RoadmapManagementComponent } from './features/admin/roadmap-management/roadmap-management';
import { TopicManagementComponent } from './features/admin/topic-management/topic-management';
import { TagManagementComponent } from './features/admin/tag-management/tag-management';
import { PostManagementComponent } from './features/admin/post-management/post-management';
import { AdminPostDetailComponent } from './features/admin/post-detail/post-detail';
import { UserManagementComponent } from './features/admin/user-management/user-management';
import { AdminUserProfileComponent } from './features/admin/user-profile/user-profile';
import { SettingsComponent } from './features/settings/settings';
import { adminGuard } from './core/guards/admin.guard';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'landing', component: LandingComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard]},
  { path: 'admin/quiz', component: QuizManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/roadmap', component: RoadmapManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/topics', component: TopicManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/tags', component: TagManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/posts', component: PostManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/posts/:id', component: AdminPostDetailComponent, canActivate: [adminGuard] },
  { path: 'admin/users', component: UserManagementComponent, canActivate: [adminGuard] },
  { path: 'admin/users/:id', component: AdminUserProfileComponent, canActivate: [adminGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [adminGuard] },
  { path: '', redirectTo: 'landing', pathMatch: 'full' }
];
