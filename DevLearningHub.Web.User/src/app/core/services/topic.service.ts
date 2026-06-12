import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TopicService {
  private http = inject(HttpClient);
  private apiUrl = '/api/topics';

  getAllTopics(): Observable<any[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => res?.data || res || [])
    );
  }

  getTopicById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => res?.data || res)
    );
  }

  createTopic(data: { name: string, description?: string, icon?: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  updateTopic(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  deleteTopic(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  toggleTopicStatus(id: string, isActive: boolean): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/status`, { isActive });
  }
}