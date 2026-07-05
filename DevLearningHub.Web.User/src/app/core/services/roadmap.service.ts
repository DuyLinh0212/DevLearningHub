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

  addItem(roadmapId: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${roadmapId}/items`, data).pipe(
      map(res => res?.data || res)
    );
  }

  updateItem(roadmapId: string, itemId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${roadmapId}/items/${itemId}`, data).pipe(
      map(res => res?.data || res)
    );
  }

  removeItem(roadmapId: string, itemId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${roadmapId}/items/${itemId}`).pipe(
      map(res => res?.data || res)
    );
  }

  startRoadmap(roadmapId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${roadmapId}/start`, {}).pipe(
      map(res => res?.data || res)
    );
  }

  getMyProgress(roadmapId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${roadmapId}/my-progress`).pipe(
      map(res => res?.data || res)
    );
  }

  completeItem(roadmapId: string, itemId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${roadmapId}/items/${itemId}/complete`, {}).pipe(
      map(res => res?.data || res)
    );
  }
}