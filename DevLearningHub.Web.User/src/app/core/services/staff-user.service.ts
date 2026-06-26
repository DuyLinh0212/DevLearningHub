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
  
  // Flat Sets for backward compatibility and fallback
  private staffUserIds = new Set<string>();
  private staffUsernames = new Set<string>();
  
  // Specific role sets
  private adminUserIds = new Set<string>();
  private adminUsernames = new Set<string>();
  private moderatorUserIds = new Set<string>();
  private moderatorUsernames = new Set<string>();
  
  private loaded = false;

  /** Load staff accounts from local config + localStorage cache. */
  ensureLoaded(): Observable<void> {
    if (this.loaded) {
      return of(void 0);
    }

    return this.http.get<any>('assets/config/staff-users.json').pipe(
      catchError(() => of({ userIds: [] as string[], usernames: [] as string[] })),
      tap((config) => {
        // Flat lists fallback
        (config.userIds || []).forEach((id: string) => {
          if (id) this.staffUserIds.add(id.toLowerCase());
        });
        (config.usernames || []).forEach((username: string) => {
          if (username) this.staffUsernames.add(username.toLowerCase());
        });

        // Specific Admins list
        if (config.admins) {
          (config.admins.userIds || []).forEach((id: string) => {
            if (id) {
              const lowerId = id.toLowerCase();
              this.adminUserIds.add(lowerId);
              this.staffUserIds.add(lowerId);
            }
          });
          (config.admins.usernames || []).forEach((username: string) => {
            if (username) {
              const lowerUsername = username.toLowerCase();
              this.adminUsernames.add(lowerUsername);
              this.staffUsernames.add(lowerUsername);
            }
          });
        }

        // Specific Moderators list
        if (config.moderators) {
          (config.moderators.userIds || []).forEach((id: string) => {
            if (id) {
              const lowerId = id.toLowerCase();
              this.moderatorUserIds.add(lowerId);
              this.staffUserIds.add(lowerId);
            }
          });
          (config.moderators.usernames || []).forEach((username: string) => {
            if (username) {
              const lowerUsername = username.toLowerCase();
              this.moderatorUsernames.add(lowerUsername);
              this.staffUsernames.add(lowerUsername);
            }
          });
        }

        // Load more from LocalStorage cache
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

  isStaffAuthor(author: any): boolean {
    if (!author) return false;

    // Check roles directly from author object if backend returns them
    const roles = this.normalizeRoles(author);
    if (this.hasStaffRole(roles)) return true;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.staffUserIds.has(id)) return true;
    if (username && this.staffUsernames.has(username)) return true;

    return false;
  }

  isAdminAuthor(author: any): boolean {
    if (!author) return false;

    const roles = this.normalizeRoles(author);
    if (roles.includes('admin')) return true;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.adminUserIds.has(id)) return true;
    if (username && this.adminUsernames.has(username)) return true;

    return false;
  }

  isModeratorAuthor(author: any): boolean {
    if (!author) return false;

    const roles = this.normalizeRoles(author);
    if (roles.includes('moderator')) return true;

    const id = (author.id || '').toString().toLowerCase();
    const username = (author.username || '').toLowerCase();

    if (id && this.moderatorUserIds.has(id)) return true;
    if (username && this.moderatorUsernames.has(username)) return true;

    return false;
  }

  annotateComments(comments: any[]): any[] {
    return (comments || []).map(comment => ({
      ...comment,
      isStaff: this.isStaffAuthor(comment.author),
      isAdmin: this.isAdminAuthor(comment.author),
      isModerator: this.isModeratorAuthor(comment.author),
      replies: comment.replies?.length
        ? this.annotateComments(comment.replies)
        : (comment.replies || [])
    }));
  }

  private normalizeRoles(source: any): string[] {
    if (!source) return [];

    if (Array.isArray(source.roles)) {
      return source.roles.filter((role: unknown) => typeof role === 'string').map((r: string) => r.toLowerCase());
    }

    if (typeof source.role === 'string' && source.role.trim()) {
      return [source.role.toLowerCase()];
    }

    if (typeof source.roles === 'string' && source.roles.trim()) {
      return [source.roles.toLowerCase()];
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
      // Support string array format
      (parsed.userIds || []).forEach((id: string) => {
        if (id) this.staffUserIds.add(id.toLowerCase());
      });
      (parsed.usernames || []).forEach((username: string) => {
        if (username) this.staffUsernames.add(username.toLowerCase());
      });

      // Support Map/Object-based format with roles
      const usersList = parsed.users || [];
      const usernamesList = parsed.usernames || [];

      usersList.forEach((user: any) => {
        if (user && user.id) {
          const lowerId = user.id.toLowerCase();
          this.staffUserIds.add(lowerId);
          if (user.roles?.map((r: string) => r.toLowerCase()).includes('admin')) {
            this.adminUserIds.add(lowerId);
          } else if (user.roles?.map((r: string) => r.toLowerCase()).includes('moderator')) {
            this.moderatorUserIds.add(lowerId);
          }
        }
      });

      usernamesList.forEach((user: any) => {
        if (user && user.username) {
          const lowerName = user.username.toLowerCase();
          this.staffUsernames.add(lowerName);
          if (user.roles?.map((r: string) => r.toLowerCase()).includes('admin')) {
            this.adminUsernames.add(lowerName);
          } else if (user.roles?.map((r: string) => r.toLowerCase()).includes('moderator')) {
            this.moderatorUsernames.add(lowerName);
          }
        }
      });
    } catch {
      // Ignore invalid cache payload.
    }
  }
}
