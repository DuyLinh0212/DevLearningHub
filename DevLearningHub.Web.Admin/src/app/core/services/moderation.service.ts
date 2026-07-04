import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type ModerationType = 'post' | 'problem' | 'problem_bank' | 'quiz_set';
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
}
