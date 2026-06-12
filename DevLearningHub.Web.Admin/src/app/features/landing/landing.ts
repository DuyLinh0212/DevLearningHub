import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
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

  currentSlide: number = 0;
  totalSlides: number = 3;
  autoplayInterval: any;
  featuredQuizzes: any[] = [];

  ngOnInit() {
    this.startAutoplay();
    this.loadFeaturedQuizzes();
  }

  ngOnDestroy() {
    this.stopAutoplay();
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
