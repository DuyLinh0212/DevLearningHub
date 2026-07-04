import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login';
import { RegisterComponent } from './features/auth/register/register';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { LandingComponent } from './features/landing/landing';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard';
import { QuizManagementComponent } from './features/admin/quiz-management/quiz-management';
import { RoadmapManagementComponent } from './features/admin/roadmap-management/roadmap-management';
import { TopicManagementComponent } from './features/admin/topic-management/topic-management';
import { TagManagementComponent } from './features/admin/tag-management/tag-management';
import { PostManagementComponent } from './features/admin/post-management/post-management';
import { AdminPostDetailComponent } from './features/admin/post-detail/post-detail';
import { UserManagementComponent } from './features/admin/user-management/user-management';
import { AdminUserProfileComponent } from './features/admin/user-profile/user-profile';
import { ModeratorManagementComponent } from './features/admin/moderator-management/moderator-management';
import { ModeratorDashboardComponent } from './features/admin/moderator-dashboard/moderator-dashboard';
import { AuditLogsComponent } from './features/admin/audit-logs/audit-logs';
import { ProblemManagementComponent } from './features/admin/problem-management/problem-management';
import { TestcaseManagementComponent } from './features/admin/testcase-management/testcase-management';
import { ReportManagementComponent } from './features/admin/report-management/report-management';
import { ModerationQueueComponent } from './features/admin/moderation-queue/moderation-queue';
import { RoleManagementComponent } from './features/admin/role-management/role-management';
import { SettingsComponent } from './features/settings/settings';
import { DashboardComponent } from './features/dashboard/dashboard';
import { adminGuard } from './core/guards/admin.guard';
import { permissionGuard } from './core/guards/permission.guard';
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'landing', component: LandingComponent },
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'admin', component: AdminDashboardComponent, canActivate: [adminGuard] },
      { path: 'admin/quiz', component: QuizManagementComponent, canActivate: [permissionGuard('quiz:edit')] },
      { path: 'admin/roadmap', component: RoadmapManagementComponent, canActivate: [permissionGuard(['roadmap:create', 'roadmap:edit', 'roadmap:delete', 'roadmap:view_progress'])] },
      { path: 'admin/topics', component: TopicManagementComponent, canActivate: [permissionGuard('topic:edit')] },
      { path: 'admin/tags', component: TagManagementComponent, canActivate: [permissionGuard('tag:edit')] },
      { path: 'admin/posts', component: PostManagementComponent, canActivate: [permissionGuard(['post:hide_any', 'post:edit_any', 'post:delete_any'])] },
      { path: 'admin/posts/:id', component: AdminPostDetailComponent, canActivate: [permissionGuard(['post:hide_any', 'post:edit_any', 'post:delete_any'])] },
      { path: 'admin/users', component: UserManagementComponent, canActivate: [permissionGuard('user:view_all')] },
      { path: 'admin/users/:id', component: AdminUserProfileComponent, canActivate: [permissionGuard('user:view_all')] },
      { path: 'admin/moderators', component: ModeratorManagementComponent, canActivate: [adminGuard] },
      { path: 'admin/moderator-dashboard', component: ModeratorDashboardComponent, canActivate: [permissionGuard(['post:review', 'post:hide_any', 'post:delete_any', 'post:edit_any', 'problem:review', 'quiz:review', 'problem_bank:review', 'audit:view'])] },
      { path: 'admin/audit-logs', component: AuditLogsComponent, canActivate: [permissionGuard('audit:view')] },
      { path: 'admin/problems', component: ProblemManagementComponent, canActivate: [permissionGuard('quiz:edit')] },
      { path: 'admin/problems/:id/test-cases', component: TestcaseManagementComponent, canActivate: [permissionGuard('quiz:edit')] },
      { path: 'admin/reports', component: ReportManagementComponent, canActivate: [permissionGuard(['post:hide_any', 'post:delete_any'])] },
      { path: 'admin/moderation', component: ModerationQueueComponent, canActivate: [permissionGuard(['post:review', 'problem:review', 'quiz:review', 'problem_bank:review'])] },
      { path: 'admin/roles', component: RoleManagementComponent, canActivate: [permissionGuard('role:view')] },
      { path: 'settings', component: SettingsComponent, canActivate: [adminGuard] },
    ]
  },
  { path: '', redirectTo: 'landing', pathMatch: 'full' }
];