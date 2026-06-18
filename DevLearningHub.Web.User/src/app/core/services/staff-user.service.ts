import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

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

  /** Load staff accounts from local config + localStorage cache. */
  ensureLoaded(): Observable<void> {
    if (this.loaded) {
      return of(void 0);
    }

    return this.http.get<{ userIds?: string[]; usernames?: string[] }>('assets/config/staff-users.json').pipe(
      catchError(() => of({ userIds: [] as string[], usernames: [] as string[] })),
      tap((config) => {
        (config.userIds || []).forEach(id => {
          if (id) this.staffUserIds.add(id.toLowerCase());
        });
        (config.usernames || []).forEach(username => {
          if (username) this.staffUsernames.add(username.toLowerCase());
        });

        // Đọc thêm từ localStorage (Admin app có thể đã cache ở đây nếu cùng domain)
        this.loadStaffCacheFromStorage();
        this.loaded = true;
      }),
      map(() => void 0),
      catchError(() => {
        this.loaded = true;
        return of(void 0);
      })
    );
  }

  /**
   * Kiểm tra từ role trong author object (nếu BE trả về),
   * hoặc từ staffUserIds/staffUsernames đã nạp.
   */
  isStaffAuthor(author: any): boolean {
    if (!author) return false;

    // Ưu tiên: check roles trực tiếp từ author object (nếu BE trả)
    const roles = this.normalizeRoles(author);
    if (this.hasStaffRole(roles)) return true;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.staffUserIds.has(id)) return true;
    if (username && this.staffUsernames.has(username)) return true;

    return false;
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

  private loadStaffCacheFromStorage() {
    try {
      const raw = localStorage.getItem(STAFF_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      (parsed.userIds || []).forEach((id: string) => {
        if (id) this.staffUserIds.add(id.toLowerCase());
      });
      (parsed.usernames || []).forEach((username: string) => {
        if (username) this.staffUsernames.add(username.toLowerCase());
      });
    } catch {
      // Ignore invalid cache payload.
    }
  }
}
