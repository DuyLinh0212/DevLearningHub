import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ModerationType = 'post' | 'problem' | 'problem_bank' | 'quiz_set' | 'roadmap';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface ModerationQueueItem {
  type: ModerationType;
  id: string;
  title: string;
  reviewStatus: ReviewStatus;
  authorUsername: string | null;
  authorFullName: string | null;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

@Injectable({ providedIn: 'root' })
export class ModerationService {
  private http = inject(HttpClient);
  private base = '/api/admin/moderation';

  getQueue(type: ModerationType | 'all', status: ReviewStatus = 'pending'): Observable<ModerationQueueItem[]> {
    const params: Record<string, string> = { status };
    if (type !== 'all') params['type'] = type;
    return this.http.get<any>(`${this.base}/queue`, { params }).pipe(
      map((res) => (res?.data ?? res ?? []) as ModerationQueueItem[])
    );
  }

  approve(type: ModerationType, id: string, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${type}/${id}/approve`, { reason: reason ?? null });
  }

  reject(type: ModerationType, id: string, reason?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${type}/${id}/reject`, { reason: reason ?? null });
  }

  private static readonly detailEndpoints: Record<ModerationType, string> = {
    post: '/api/posts',
    problem: '/api/problems',
    problem_bank: '/api/problem-banks',
    quiz_set: '/api/quiz-sets',
    roadmap: '/api/roadmaps',
  };

  getDetail(type: ModerationType, id: string): Observable<any> {
    const base = ModerationService.detailEndpoints[type];
    const suffix = type === 'roadmap' ? '?manageMode=true' : '';
    return this.http.get<any>(`${base}/${id}${suffix}`).pipe(map((res) => res?.data ?? res));
  }

  getLogs(page: number, pageSize: number, type?: ModerationType, action?: string): Observable<{
    items: ModerationLogItem[]; totalCount: number; page: number; pageSize: number;
  }> {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (type) params['type'] = type;
    if (action) params['action'] = action;
    return this.http.get<any>(`${this.base}/logs`, { params }).pipe(
      map((res) => res?.data ?? res ?? { items: [], totalCount: 0, page: 1, pageSize })
    );
  }
}

export interface ModerationLogItem {
  id: string;
  moderatorId: string;
  moderatorUsername: string | null;
  moderatorFullName: string | null;
  targetType: ModerationType;
  targetId: string;
  targetTitle: string | null;
  action: string;
  reason: string | null;
  createdAt: string;
}
