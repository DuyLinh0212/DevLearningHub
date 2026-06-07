import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RoadmapService {
  private http = inject(HttpClient);
  private apiUrl = '/api/roadmaps';

  getAllRoadmaps(): Observable<any[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => res?.data || res || [])
    );
  }

  getRoadmapById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => res?.data || res)
    );
  }

  createRoadmap(data: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, data).pipe(
      map(res => res?.data || res)
    );
  }

  updateRoadmap(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data).pipe(
      map(res => res?.data || res)
    );
  }

  deleteRoadmap(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(res => res?.data || res)
    );
  }

  addTopicToRoadmap(roadmapId: string, topicId: string, orderIndex: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${roadmapId}/topics`, { topicId, orderIndex });
  }

  removeTopicFromRoadmap(roadmapId: string, topicId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${roadmapId}/topics/${topicId}`);
  }

  getRoadmapTopics(roadmapId: string): Observable<any[]> {
  return this.http.get<any>(`/api/roadmaps/${roadmapId}/topics`).pipe(
    map(res => res?.data || res || [])
  );
}
}