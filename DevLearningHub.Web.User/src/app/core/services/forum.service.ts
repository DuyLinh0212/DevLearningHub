import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private http = inject(HttpClient);
  private postsUrl = '/api/posts';
  private commentsUrl = '/api/comments';
  private tagsUrl = '/api/tags';

  // --- POSTS ---
  getPosts(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    tag?: string,
    authorId?: string
  ): Observable<any> {
    // Nạp cả trường 'page' vào query string gửi lên API Backend
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    if (tag && tag.trim()) {
      params = params.set('tag', tag.trim());
    }
    if (authorId) {
      params = params.set('authorId', authorId);
    }

    return this.http.get<any>(this.postsUrl, { params }).pipe(
      map(res => res?.data || res)
    );
  }

  getPost(id: string): Observable<any> {
    return this.http.get<any>(`${this.postsUrl}/${id}`).pipe(
      map(res => res?.data || res)
    );
  }

  createPost(payload: { title: string; bodyMarkdown: string; imageUrl?: string; tagIds?: string[] }): Observable<any> {
    return this.http.post<any>(this.postsUrl, payload).pipe(
      map(res => res?.data || res)
    );
  }

  updatePost(id: string, payload: { title: string; bodyMarkdown: string; imageUrl?: string; tagIds?: string[] }): Observable<any> {
    return this.http.put<any>(`${this.postsUrl}/${id}`, payload).pipe(
      map(res => res?.data || res)
    );
  }

  deletePost(id: string): Observable<any> {
    return this.http.delete<any>(`${this.postsUrl}/${id}`).pipe(
      map(res => res?.data || res)
    );
  }

  uploadPostImage(id: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(`${this.postsUrl}/${id}/image`, formData).pipe(
      map(res => res?.data || res)
    );
  }

  votePost(id: string, voteType: 'up' | 'down'): Observable<any> {
    return this.http.post<any>(`${this.postsUrl}/${id}/vote`, { voteType }).pipe(
      map(res => res?.data || res)
    );
  }

  // --- COMMENTS ---
  getComments(postId: string): Observable<any> {
    return this.http.get<any>(`${this.postsUrl}/${postId}/comments`).pipe(
      map(res => res?.data || res)
    );
  }

  addComment(postId: string, payload: { bodyMarkdown: string; parentId?: string }): Observable<any> {
    return this.http.post<any>(`${this.postsUrl}/${postId}/comments`, payload).pipe(
      map(res => res?.data || res)
    );
  }

  updateComment(commentId: string, payload: { bodyMarkdown: string }): Observable<any> {
    return this.http.put<any>(`${this.commentsUrl}/${commentId}`, payload).pipe(
      map(res => res?.data || res)
    );
  }

  deleteComment(commentId: string): Observable<any> {
    return this.http.delete<any>(`${this.commentsUrl}/${commentId}`).pipe(
      map(res => res?.data || res)
    );
  }

  voteComment(commentId: string, voteType: 'up' | 'down'): Observable<any> {
    return this.http.post<any>(`${this.commentsUrl}/${commentId}/vote`, { voteType }).pipe(
      map(res => res?.data || res)
    );
  }

  acceptComment(commentId: string): Observable<any> {
    return this.http.post<any>(`${this.commentsUrl}/${commentId}/accept`, {}).pipe(
      map(res => res?.data || res)
    );
  }

  // --- TAGS ---
  getTags(): Observable<any> {
    return this.http.get<any>(this.tagsUrl).pipe(
      map(res => res?.data || res)
    );
  }
}
