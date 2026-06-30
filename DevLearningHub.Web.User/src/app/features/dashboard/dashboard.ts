import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { ProblemBankService, ProblemBankSummary, ProblemBankProgress } from '../../core/services/problem-bank.service';

@Component({
	selector: 'app-dashboard',
	standalone: true,
	imports: [RouterLink, CommonModule],
	templateUrl: './dashboard.html',
	styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
	private router = inject(Router);
	private quizService = inject(QuizService);
	private http = inject(HttpClient);
	private cdr = inject(ChangeDetectorRef);
	private problemBankService = inject(ProblemBankService);

	totalRealAttempts = 0;
	quizzesData: any[] = [];

	problemBanks: (ProblemBankSummary & { progress?: ProblemBankProgress })[] = [];
	banksLoading = true;

	userXpPoints = 0;
	totalQuizTaken = 0;
	averageScore = 0;
	userRank = 0;

	stats: any[] = [];
	recommendations: any[] = [];
	activities: any[] = [];
	leaderboard: any[] = [];
	quizStats: any[] = [];
	circumference = 2 * Math.PI * 34;

	ngOnInit() {
		this.loadProblemBanks();
		console.log('=== DASHBOARD: KHỞI ĐỘNG CHUỖI LIÊN HOÀN BỐC TÁCH STATS ===');

		this.quizService.getCurrentUser().subscribe({
			next: (userRes: any) => {
				const userData = userRes?.data || userRes;
				const userId = userData?.id || userData?.Id || userData?.userId || '';

				console.log(`=> Đã tìm thấy mã Học viên hiện tại: ${userId}`);

				forkJoin({
					quizzes: this.quizService.getAllQuizzes(),
					leaderboardRes: this.quizService.getLeaderboard(),
					userStats: userId ? this.http.get<any>(`/api/users/${userId}/stats`) : of(null),
					quizStatsRes: userId ? this.quizService.getUserQuizStats() : of([])
				}).subscribe({
					next: (result: any) => {
						console.log('=== DASHBOARD: TẤT CẢ DỮ LIỆU ĐÃ ĐỒNG BỘ ===', result);

						const rawQuizzes = result.quizzes?.data || result.quizzes;
						this.quizzesData = Array.isArray(rawQuizzes) ? rawQuizzes : [];

						const lbData = result.leaderboardRes?.data || result.leaderboardRes;
						const rawLeaderboard = Array.isArray(lbData) ? lbData : [];
						this.leaderboard = rawLeaderboard.map((u: any, idx: number) => ({
							rank: u.rank ?? (idx + 1),
							name: u.fullName || u.username || 'Học viên',
							username: u.username || 'member',
							avatar: u.avatarUrl || 'assets/images/default-avatar.svg',
							xp: u.xp ?? u.xpPoints ?? 0
						}));

						const statsData = result.userStats?.data || result.userStats;
						if (statsData) {
							console.log('Dữ liệu phân tích năng lực thực tế từ DB:', statsData);
							this.totalQuizTaken = statsData.totalQuizTaken ?? 0;
							this.userXpPoints = statsData.totalXP ?? userData?.xpPoints ?? 0;
							const rawAverageScore = statsData.avgScore ?? 0;
							this.averageScore = rawAverageScore <= 1 ? rawAverageScore * 10 : rawAverageScore;
							this.userRank = statsData.rank ?? 0;
						}

						this.quizStats = result.quizStatsRes || [];

						this.buildDashboardData();
					},
					error: (err) => {
						console.error('Lỗi khi tải tổ hợp dữ liệu Dashboard:', err);
						this.fallbackLoadQuizzes();
					}
				});
			},
			error: (err) => {
				console.error('Không lấy được profile người dùng, kích hoạt fallback:', err);
				this.fallbackLoadQuizzes();
			}
		});
	}

	private fallbackLoadQuizzes() {
		this.quizService.getAllQuizzes().subscribe({
			next: (quizzes: any) => {
				const fallbackData = quizzes?.data || quizzes;
				this.quizzesData = Array.isArray(fallbackData) ? fallbackData : [];
				this.buildDashboardData();
			}
		});
	}

	private buildDashboardData() {
		let sumAttempts = 0;
		this.quizzesData.forEach(q => {
			sumAttempts += (q.attempts ?? q.attemptsCount ?? 0);
		});
		this.totalRealAttempts = sumAttempts;

		let completedMockQuizzes = 0;
		if (Array.isArray(this.quizzesData)) {
			this.quizzesData.forEach(q => {
				if (q.id && q.id.toString().startsWith('mock-') && (q.attempts > 0)) {
					completedMockQuizzes++;
				}
			});
		}
		const localXp = this.quizService.getUserXP();
		const displayXp = this.userXpPoints + localXp;
		const displayCompleted = this.totalQuizTaken + completedMockQuizzes;

		this.stats = [
			{ title: 'Quiz đã hoàn thành', value: String(displayCompleted), icon: 'bi-book', color: 'cyan' },
			{ title: 'Điểm kinh nghiệm', value: String(displayXp), icon: 'bi-gem', color: 'emerald', unit: 'XP' },
			{ title: 'Điểm số trung bình', value: String(this.averageScore.toFixed(1)), icon: 'bi-check-circle-fill', color: 'blue', unit: 'điểm TB' },
			{ title: 'Thứ hạng hệ thống', value: this.userRank > 0 ? '#' + this.userRank : '--', icon: 'bi-trophy-fill', color: 'amber' }
		];

		this.recommendations = this.quizzesData.map(q => {
			const realAttempts = q.attempts ?? q.attemptsCount ?? 0;
			const hasAttempted = realAttempts > 0;
			return {
				id: q.id,
				title: hasAttempted ? 'Ôn tập: ' + q.title : 'Thử thách: ' + q.title,
				questions: q.questionCount || q.questionsCount || 0,
				duration: q.duration || 15,
				btnText: hasAttempted ? 'Tiếp tục' : 'Làm ngay'
			};
		});

		this.activities = this.quizzesData.map(q => {
			const realAttempts = q.attempts ?? q.attemptsCount ?? 0;
			const savedProgress = this.quizService.getQuizProgress(q.id);
			const displayProgress = realAttempts > 0 && savedProgress === 0 ? 100 : savedProgress;
			const hasAttempted = realAttempts > 0;
			return {
				id: q.id,
				title: q.title,
				questions: q.questionCount || q.questionsCount || 0,
				attempts: realAttempts,
				progress: displayProgress,
				duration: q.duration || 15,
				btnText: hasAttempted ? 'Tiếp tục' : 'Làm ngay'
			};
		});

		this.cdr.detectChanges();
	}

	loadProblemBanks() {
		const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
		if (!token) { this.banksLoading = false; return; }

		this.problemBankService.getBanks().subscribe({
			next: (res) => {
				const data = res?.data || res;
				const banks: ProblemBankSummary[] = Array.isArray(data) ? data : [];
				this.problemBanks = banks.map(b => ({ ...b }));
				this.banksLoading = false;
				this.cdr.detectChanges();

				// Load progress for each bank in parallel (max 5 to avoid flooding)
				const slice = this.problemBanks.slice(0, 5);
				slice.forEach((bank, idx) => {
					this.problemBankService.getProgress(bank.id).subscribe({
						next: (pRes) => {
							const prog: ProblemBankProgress = pRes?.data || pRes;
							this.problemBanks[idx] = { ...this.problemBanks[idx], progress: prog };
							this.cdr.detectChanges();
						},
						error: () => {}
					});
				});
			},
			error: () => {
				this.banksLoading = false;
				this.cdr.detectChanges();
			}
		});
	}

	getBankProgressPercent(bank: any): number {
		if (bank.progress) return bank.progress.completionPercent ?? 0;
		return 0;
	}

	handleAction(quizId: string) {
		this.router.navigate(['/quiz', quizId]);
	}

	onGlobalSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input && input.value.trim()) {
			this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value.trim() } });
		}
	}
}
