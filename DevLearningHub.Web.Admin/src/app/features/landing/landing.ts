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
  dashboardLink: string = '/dashboard';

  ngOnInit() {
    this.checkLoginStatus();
    this.startAutoplay();
    this.loadFeaturedQuizzes();
  }

  ngOnDestroy() {
    this.stopAutoplay();
  }

  checkLoginStatus() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (token) {
        this.isLoggedIn = true;
        
        try {
          const payloadPart = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
          const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          
          const isAdmin = Array.isArray(roleClaim) 
            ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') 
            : roleClaim?.toLowerCase() === 'admin';
          
          if (isAdmin) {
            this.dashboardLink = '/admin';
          } else {
            this.dashboardLink = '/dashboard';
          }
        } catch (e) {
          this.dashboardLink = '/dashboard';
        }

        this.quizService.getCurrentUser().subscribe({
          next: (res: any) => {
            this.currentUser = res?.data || res;
            this.cdr.detectChanges();
          },
          error: () => {
            this.isLoggedIn = false;
            this.currentUser = null;
            this.cdr.detectChanges();
          }
        });
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
