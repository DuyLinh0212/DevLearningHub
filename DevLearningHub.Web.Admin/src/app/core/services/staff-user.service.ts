import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

const STAFF_ROLES = new Set(['admin', 'moderator']);
const STAFF_CACHE_KEY = 'staff_users_cache';

interface StaffUserInfo {
  id: string;
  username: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root'
})
export class StaffUserService {
  private http = inject(HttpClient);
  private staffUsers = new Map<string, StaffUserInfo>(); // id -> info
  private staffUsernames = new Map<string, StaffUserInfo>(); // username -> info
  private loaded = false;

  ensureLoaded(): Observable<void> {
    if (this.loaded) {
      return of(void 0);
    }

    // 1. Tải trước từ cấu hình local JSON + LocalStorage (fallback khi chưa tải xong/không có quyền)
    return this.http.get<{ userIds?: string[]; usernames?: string[] }>('assets/config/staff-users.json').pipe(
      catchError(() => of({ userIds: [] as string[], usernames: [] as string[] })),
      tap((config) => {
        (config.userIds || []).forEach(id => {
          if (id) {
            const lowerId = id.toLowerCase();
            this.staffUsers.set(lowerId, { id: lowerId, username: '', roles: ['admin'] });
          }
        });
        (config.usernames || []).forEach(username => {
          if (username) {
            const lowerUsername = username.toLowerCase();
            this.staffUsernames.set(lowerUsername, { id: '', username: lowerUsername, roles: ['admin'] });
          }
        });
        this.loadStaffCacheFromStorage();
      }),
      switchMap(() => this.fetchAllAdminUsers().pipe(
        tap(users => {
          users.forEach((user: any) => {
            const roles = this.normalizeRoles(user);
            if (!this.hasStaffRole(roles)) return;

            const id = (user.id || '').toString().toLowerCase();
            const username = (user.username || '').toLowerCase();
            const info: StaffUserInfo = {
              id,
              username,
              roles: roles
            };
            if (id) this.staffUsers.set(id, info);
            if (username) this.staffUsernames.set(username, info);
          });
          this.persistStaffCacheToStorage();
        }),
        catchError(() => of([]))
      )),
      tap(() => {
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
    return this.getStaffInfo(author) !== null;
  }

  isAdminAuthor(author: any): boolean {
    const info = this.getStaffInfo(author);
    return info !== null && info.roles.includes('admin');
  }

  getStaffInfo(author: any): StaffUserInfo | null {
    if (!author) return null;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.staffUsers.has(id)) {
      return this.staffUsers.get(id)!;
    }
    if (username && this.staffUsernames.has(username)) {
      return this.staffUsernames.get(username)!;
    }

    // Fallback: check roles directly on author object
    const roles = this.normalizeRoles(author);
    if (this.hasStaffRole(roles)) {
      return {
        id: id || '',
        username: username || '',
        roles: roles
      };
    }

    return null;
  }

  annotateComments(comments: any[]): any[] {
    return (comments || []).map(comment => ({
      ...comment,
      isStaff: this.isStaffAuthor(comment.author),
      isAdmin: this.isAdminAuthor(comment.author),
      replies: comment.replies?.length
        ? this.annotateComments(comment.replies)
        : (comment.replies || [])
    }));
  }

  annotatePostAuthors(posts: any[]): any[] {
    return (posts || []).map(post => ({
      ...post,
      author: {
        ...post.author,
        isStaff: this.isStaffAuthor(post.author),
        isAdmin: this.isAdminAuthor(post.author)
      }
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
    const userData = Array.from(this.staffUsers.values());
    const usernameData = Array.from(this.staffUsernames.values());

    localStorage.setItem(
      STAFF_CACHE_KEY,
      JSON.stringify({
        users: userData,
        usernames: usernameData
      })
    );
  }

  private loadStaffCacheFromStorage() {
    try {
      const raw = localStorage.getItem(STAFF_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      (parsed.users || parsed.userIds || []).forEach((item: any) => {
        if (typeof item === 'string') {
          const lowerId = item.toLowerCase();
          this.staffUsers.set(lowerId, { id: lowerId, username: '', roles: ['admin'] });
        } else if (item && item.id) {
          const lowerId = item.id.toLowerCase();
          this.staffUsers.set(lowerId, item);
        }
      });
      (parsed.usernames || []).forEach((item: any) => {
        if (typeof item === 'string') {
          const lowerUsername = item.toLowerCase();
          this.staffUsernames.set(lowerUsername, { id: '', username: lowerUsername, roles: ['admin'] });
        } else if (item && item.username) {
          const lowerUsername = item.username.toLowerCase();
          this.staffUsernames.set(lowerUsername, item);
        }
      });
    } catch {
      // Ignore invalid cache payload.
    }
  }
}
