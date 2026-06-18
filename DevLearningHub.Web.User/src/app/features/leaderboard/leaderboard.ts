import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.css'
})
export class LeaderboardComponent implements OnInit {
  private quizService = inject(QuizService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentUserId = '';
  currentUser: any = null;
  leaderboard: any[] = [];
  highlightUser: any = null;
  isLoading = true;
  notFound = false;

  ngOnInit() {
    this.http.get<any>('/api/users/me').subscribe({
      next: (res) => {
        const user = res?.data || res;
        this.currentUser = {
          id: (user?.id || user?.Id || user?.userId || user?.sub || '').toString().toLowerCase(),
          username: (user?.username || user?.Username || '').toString().toLowerCase(),
          email: (user?.email || user?.Email || '').toString().toLowerCase(),
          fullName: (user?.fullName || user?.FullName || '').toString().toLowerCase()
        };
        this.currentUserId = this.currentUser.id;
        this.loadLeaderboard();
      },
      error: () => this.loadLeaderboard()
    });
  }

  loadLeaderboard() {
    this.isLoading = true;
    this.quizService.getLeaderboard().subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        const raw = Array.isArray(data) ? data : [];
        this.leaderboard = raw.map((u: any, idx: number) => {
          const id = (u.id || u.userId || u.userID || u.Id || '').toString();
          const username = (u.username || u.Username || '').toString();
          const email = (u.email || u.Email || '').toString();
          const fullName = (u.fullName || u.FullName || '').toString();
          const isSelf = this.isCurrentUser(id, username, email, fullName);
          return {
            id,
            rank: u.rank ?? (idx + 1),
            name: u.fullName || u.username || 'Học viên',
            username,
            email,
            fullName,
            avatar: u.avatarUrl || 'assets/images/default-avatar.svg',
            xp: u.xp ?? u.xpPoints ?? 0,
            quizTaken: u.totalQuizTaken ?? u.quizTaken ?? 0,
            avgScore: u.avgScore ?? u.averageScore ?? 0,
            totalUpvotes: u.totalUpvotes ?? 0,
            totalComments: u.totalComments ?? 0,
            isSelf
          };
        });

        this.highlightUser = this.leaderboard.find(u => this.compareIds(u.id, this.currentUserId)) || null;
        if (!this.highlightUser) {
          this.highlightUser = this.leaderboard.find(u => u.isSelf) || null;
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.leaderboard = [];
        this.notFound = true;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openUser(user: any) {
    const targetId = this.resolveUserTargetId(user);
    if (!targetId) return;
    this.router.navigate(['/user', targetId]);
  }

  viewMyProfile() {
    const targetId = this.resolveUserTargetId(this.highlightUser || { isSelf: true, id: this.currentUserId });
    if (!targetId) return;
    this.router.navigate(['/user', targetId]);
  }

  get podium() {
    return [this.leaderboard[0], this.leaderboard[1], this.leaderboard[2]].filter(Boolean);
  }

  private compareIds(id1: any, id2: any): boolean {
    if (!id1 || !id2) return false;
    return id1.toString().toLowerCase().trim() === id2.toString().toLowerCase().trim();
  }

  private isCurrentUser(id: string, username: string, email: string, fullName: string): boolean {
    const current = this.currentUser;
    if (!current) return false;
    return Boolean(
      this.compareIds(id, current.id) ||
      (username && username.toLowerCase().trim() === current.username) ||
      (email && email.toLowerCase().trim() === current.email) ||
      (fullName && fullName.toLowerCase().trim() === current.fullName)
    );
  }

  private resolveUserTargetId(user: any): string {
    if (!user) return '';
    if (user.id) return user.id.toString();
    if (user.isSelf && this.currentUserId) return this.currentUserId;
    return '';
  }
}
