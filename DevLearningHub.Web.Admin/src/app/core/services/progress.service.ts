import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProgressService {
  private http = inject(HttpClient);
  private apiUrl = '/api/users/me/progress';

  getUserProgress(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }
}