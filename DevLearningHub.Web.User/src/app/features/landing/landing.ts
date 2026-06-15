import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent implements OnInit, OnDestroy {
  themeService = inject(ThemeService);
  private quizService = inject(QuizService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  currentSlide: number = 0;
  totalSlides: number = 3;
  autoplayInterval: any;
  featuredQuizzes: any[] = [];

  isLoggedIn: boolean = false;
  currentUser: any = null;

  ngOnInit() {
    this.startAutoplay();
    this.loadFeaturedQuizzes();
    this.checkLoginStatus();
  }

  ngOnDestroy() {
    this.stopAutoplay();
  }

  isTokenValid(token: string | null): boolean {
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payloadPart = parts[1];
      const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
      const exp = decodedPayload.exp;
      if (exp && Date.now() >= exp * 1000) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  checkLoginStatus() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (this.isTokenValid(token)) {
        this.isLoggedIn = true;
        this.quizService.getCurrentUser().subscribe({
          next: (res: any) => {
            this.currentUser = res?.data || res;
            this.cdr.detectChanges();
          },
          error: () => {
            this.isLoggedIn = false;
            this.currentUser = null;
            localStorage.removeItem('accessToken');
            localStorage.removeItem('token');
            this.cdr.detectChanges();
          }
        });
      } else {
        this.isLoggedIn = false;
        this.currentUser = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('token');
      }
    }
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    this.isLoggedIn = false;
    this.currentUser = null;
    this.cdr.detectChanges();
    this.router.navigate(['/login']);
  }

  startAutoplay() {
    this.autoplayInterval = setInterval(() => {
      this.nextSlide();
    }, 6000);
  }

  stopAutoplay() {
    if (this.autoplayInterval) {
      clearInterval(this.autoplayInterval);
    }
  }

  nextSlide() {
    this.currentSlide = (this.currentSlide + 1) % this.totalSlides;
  }

  prevSlide() {
    this.currentSlide = (this.currentSlide - 1 + this.totalSlides) % this.totalSlides;
  }

  setSlide(index: number) {
    this.currentSlide = index;
    this.stopAutoplay();
    this.startAutoplay();
  }

  private loadFeaturedQuizzes() {
    this.quizService.getAllQuizzes(false).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          this.featuredQuizzes = res.slice(0, 3);
        }
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
}
