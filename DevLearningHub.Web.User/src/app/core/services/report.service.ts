import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, switchMap } from 'rxjs';

export type ReportTargetType = 'post' | 'comment' | 'problem' | 'quiz_question';

export interface ReportType {
  id: string;
  name: ReportTargetType | string;
  description?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private http = inject(HttpClient);
  private reportTypes$?: Observable<ReportType[]>;

  getReportTypes(): Observable<ReportType[]> {
    if (!this.reportTypes$) {
      this.reportTypes$ = this.http.get<any>('/api/reports/types').pipe(
        map(res => res?.data || res || []),
        shareReplay(1)
      );
    }

    return this.reportTypes$;
  }

  createReport(typeName: ReportTargetType, targetId: string, description: string): Observable<any> {
    return this.getReportTypes().pipe(
      map(types => {
        const type = types.find(t => t.name === typeName);
        if (!type) {
          throw new Error(`Report type "${typeName}" is not configured.`);
        }
        return type.id;
      }),
      switchMap(reportTypeId => this.http.post<any>('/api/reports', {
        reportTypeId,
        targetId,
        description
      })),
      map(res => res?.data || res)
    );
  }
}
