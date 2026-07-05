import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProblemBankCreator {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ProblemBankSummary {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  topicId: string | null;
  topicName: string | null;
  creator: ProblemBankCreator;
  problemCount: number;
  likeCount: number;
  avgRating: number;
  ratingCount: number;
  myLiked: boolean;
  myRating: number | null;
  createdAt: string;
  updatedAt: string | null;
  reviewStatus?: string;
  reviewNote?: string | null;
}

export interface ProblemBankProblemItem {
  problemId: string;
  title: string;
  difficulty: string;
  isActive: boolean;
  orderIndex: number;
  addedAt: string;
}

export interface ProblemBankDetail extends ProblemBankSummary {
  problems: ProblemBankProblemItem[];
}

export interface ProblemBankProblemAccuracy {
  problemId: string;
  title: string;
  solved: boolean;
  bestAccuracyPercent: number | null;
}

export interface ProblemBankProgress {
  bankId: string;
  totalProblems: number;
  solvedProblems: number;
  completionPercent: number;
  avgAccuracyPercent: number;
  problems: ProblemBankProblemAccuracy[];
}

@Injectable({ providedIn: 'root' })
export class ProblemBankService {
  private http = inject(HttpClient);

  getBanks(createdBy?: string, topicId?: string): Observable<any> {
    const params: Record<string, string> = {};
    if (createdBy) params['createdBy'] = createdBy;
    if (topicId) params['topicId'] = topicId;
    return this.http.get<any>('/api/problem-banks', { params });
  }

  getBank(id: string): Observable<any> {
    return this.http.get<any>(`/api/problem-banks/${id}`);
  }

  createBank(data: { title: string; description?: string; isPublic: boolean; topicId?: string | null }): Observable<any> {
    return this.http.post<any>('/api/problem-banks', data);
  }

  updateBank(id: string, data: { title: string; description?: string; isPublic: boolean; topicId?: string | null }): Observable<any> {
    return this.http.put<any>(`/api/problem-banks/${id}`, data);
  }

  deleteBank(id: string): Observable<any> {
    return this.http.delete<any>(`/api/problem-banks/${id}`);
  }

  addProblem(bankId: string, problemId: string, orderIndex?: number): Observable<any> {
    return this.http.post<any>(`/api/problem-banks/${bankId}/problems`, { problemId, orderIndex });
  }

  removeProblem(bankId: string, problemId: string): Observable<any> {
    return this.http.delete<any>(`/api/problem-banks/${bankId}/problems/${problemId}`);
  }

  getProgress(bankId: string): Observable<any> {
    return this.http.get<any>(`/api/problem-banks/${bankId}/progress`);
  }

  toggleLike(bankId: string): Observable<any> {
    return this.http.post<any>(`/api/problem-banks/${bankId}/like`, {});
  }

  rateBank(bankId: string, rating: number, comment?: string): Observable<any> {
    return this.http.post<any>(`/api/problem-banks/${bankId}/rating`, { rating, comment });
  }

  getRatings(bankId: string, page = 1, pageSize = 20): Observable<any> {
    return this.http.get<any>(`/api/problem-banks/${bankId}/ratings`, {
      params: { page: String(page), pageSize: String(pageSize) }
    });
  }
}
