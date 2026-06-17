import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

const STAFF_ROLES = new Set(['admin', 'moderator']);
const STAFF_CACHE_KEY = 'staff_users_cache';

@Injectable({
  providedIn: 'root'
})
export class StaffUserService {
  private http = inject(HttpClient);
  private staffUserIds = new Set<string>();
  private staffUsernames = new Set<string>();
  private loaded = false;

  /** Load all Admin/Moderator accounts from admin users API. */
  ensureLoaded(): Observable<void> {
    if (this.loaded) {
      return of(void 0);
    }

    return this.fetchAllAdminUsers().pipe(
      tap(users => {
        users.forEach((user: any) => {
          const roles = this.normalizeRoles(user);
          if (!this.hasStaffRole(roles)) return;

          const id = (user.id || '').toString().toLowerCase();
          const username = (user.username || '').toLowerCase();
          if (id) this.staffUserIds.add(id);
          if (username) this.staffUsernames.add(username);
        });
        this.persistStaffCacheToStorage();
        this.loaded = true;
      }),
      map(() => void 0),
      catchError(() => {
        this.loaded = true;
        return of(void 0);
      })
    );
  }

  isStaffAuthor(author: any): boolean {
    if (!author) return false;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.staffUserIds.has(id)) return true;
    if (username && this.staffUsernames.has(username)) return true;

    return this.hasStaffRole(this.normalizeRoles(author));
  }

  annotateComments(comments: any[]): any[] {
    return (comments || []).map(comment => ({
      ...comment,
      isStaff: this.isStaffAuthor(comment.author),
      replies: comment.replies?.length
        ? this.annotateComments(comment.replies)
        : (comment.replies || [])
    }));
  }

  private fetchAllAdminUsers(): Observable<any[]> {
    const pageSize = 100;

    return this.http.get<any>(`/api/admin/users?page=1&pageSize=${pageSize}`).pipe(
      switchMap(firstRes => {
        const data = firstRes?.data || firstRes;
        const firstItems = data?.items || [];
        const totalPages = data?.totalPages || 1;

        if (totalPages <= 1) {
          return of(Array.isArray(firstItems) ? firstItems : []);
        }

        const pageRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
          this.http.get<any>(`/api/admin/users?page=${index + 2}&pageSize=${pageSize}`)
        );

        return forkJoin(pageRequests).pipe(
          map(responses => {
            const restItems = responses.flatMap(res => {
              const pageData = res?.data || res;
              return pageData?.items || [];
            });
            return [...firstItems, ...restItems];
          })
        );
      })
    );
  }

  private normalizeRoles(source: any): string[] {
    if (!source) return [];

    if (Array.isArray(source.roles)) {
      return source.roles.filter((role: unknown) => typeof role === 'string');
    }

    if (typeof source.role === 'string' && source.role.trim()) {
      return [source.role];
    }

    if (typeof source.roles === 'string' && source.roles.trim()) {
      return [source.roles];
    }

    return [];
  }

  private hasStaffRole(roles: string[]): boolean {
    return roles.some(role => STAFF_ROLES.has((role || '').toLowerCase().trim()));
  }

  private persistStaffCacheToStorage() {
    localStorage.setItem(
      STAFF_CACHE_KEY,
      JSON.stringify({
        userIds: Array.from(this.staffUserIds),
        usernames: Array.from(this.staffUsernames)
      })
    );
  }
}
