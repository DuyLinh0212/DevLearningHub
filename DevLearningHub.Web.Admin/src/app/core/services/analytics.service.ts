import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// ===== Moderator dashboard summary =====
// Matches GET /api/admin/analytics/moderator-dashboard.
export interface ModeratorDashboardSummary {
  pendingReports: number;
  pendingPosts: number;
  pendingProblems: number;
  pendingQuizSets: number;
  pendingProblemBanks: number;
  hiddenPosts: number;
  totalPosts: number;
  totalProblems: number;
  totalQuizSets: number;
  totalProblemBanks: number;
  recentModerationLogs: ModerationLogItem[];
}

export interface ModerationLogItem {
  id: string;
  action: string;
  actorUsername: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

// ===== Quiz set analytics =====
export interface QuizSetAnalytics {
  quizSetId: string;
  title: string;
  totalAttempts: number;
  completedAttempts: number;
  participantCount: number;
  averageScore: number;
  averageAccuracy: number;
  lastAttemptAt: string | null;
}

export interface QuizSetParticipant {
  userId: string;
  username: string;
  fullName: string | null;
  attemptsCount: number;
  completedAttempts: number;
  bestScore: number;
  bestTotalQuestions: number;
  bestAccuracy: number;
  lastAttemptAt: string | null;
}

// ===== Problem bank analytics =====
export interface ProblemBankAnalytics {
  bankId: string;
  title: string;
  problemCount: number;
  participantCount: number;
  averageCompletionPercent: number;
  averageAccuracyPercent: number;
  solvedSubmissionCount: number;
}

export interface ProblemBankParticipant {
  user: { id: string; username: string; fullName: string | null; avatarUrl: string | null };
  solvedCount: number;
  totalProblems: number;
  completionPercent: number;
  avgAccuracyPercent: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private base = '/api/admin/analytics';

  getModeratorDashboard(): Observable<ModeratorDashboardSummary> {
    return this.http.get<any>(`${this.base}/moderator-dashboard`).pipe(
      map((res) => this.normalizeSummary(res?.data ?? res))
    );
  }

  getQuizSetStats(): Observable<QuizSetAnalytics[]> {
    return this.http.get<any>(`${this.base}/quiz-sets`).pipe(
      map((res) => (res?.data ?? res ?? []) as QuizSetAnalytics[])
    );
  }

  getQuizSetParticipants(quizSetId: string): Observable<QuizSetParticipant[]> {
    return this.http.get<any>(`${this.base}/quiz-sets/${quizSetId}/participants`).pipe(
      map((res) => (res?.data ?? res ?? []) as QuizSetParticipant[])
    );
  }

  getProblemBankStats(): Observable<ProblemBankAnalytics[]> {
    return this.http.get<any>(`${this.base}/problem-banks`).pipe(
      map((res) => (res?.data ?? res ?? []) as ProblemBankAnalytics[])
    );
  }

  getProblemBankParticipants(bankId: string): Observable<ProblemBankParticipant[]> {
    return this.http.get<any>(`${this.base}/problem-banks/${bankId}/participants`).pipe(
      map((res) => (res?.data ?? res ?? []) as ProblemBankParticipant[])
    );
  }

  private normalizeSummary(data: any): ModeratorDashboardSummary {
    const empty: ModeratorDashboardSummary = {
      pendingReports: 0, pendingPosts: 0, pendingProblems: 0, pendingQuizSets: 0,
      pendingProblemBanks: 0, hiddenPosts: 0, totalPosts: 0, totalProblems: 0,
      totalQuizSets: 0, totalProblemBanks: 0, recentModerationLogs: [],
    };
    if (!data) return empty;

    return {
      pendingReports: data.pendingReports ?? 0,
      pendingPosts: data.pendingPosts ?? 0,
      pendingProblems: data.pendingProblems ?? 0,
      pendingQuizSets: data.pendingQuizSets ?? 0,
      pendingProblemBanks: data.pendingProblemBanks ?? 0,
      hiddenPosts: data.hiddenPosts ?? 0,
      totalPosts: data.totalPosts ?? 0,
      totalProblems: data.totalProblems ?? 0,
      totalQuizSets: data.totalQuizSets ?? 0,
      totalProblemBanks: data.totalProblemBanks ?? 0,
      recentModerationLogs: (data.recentActivities ?? data.recentModerationLogs ?? []).map((log: any) => ({
        id: log.id,
        action: log.action,
        actorUsername: log.actorUsername || 'System',
        targetType: log.targetType ?? null,
        targetId: log.targetId ?? null,
        detail: log.detail ?? null,
        createdAt: log.createdAt,
      })),
    };
  }
}
