import { Component, OnInit, inject, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressService } from '../../../core/services/progress.service';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-user-progress',
  standalone: true,
  imports: [CommonModule, SidebarComponent],
  templateUrl: './user-progress.html',
  styleUrl: './user-progress.css'
})
export class UserProgressComponent implements OnInit {
  private progressService = inject(ProgressService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('radarCanvas', { static: false }) radarCanvas!: ElementRef;
  
  chart: any;
  progressData: any[] = [];
  overallAccuracy: number = 0;

  ngOnInit() {
    this.loadProgress();
  }

  loadProgress() {
    this.progressService.getUserProgress().subscribe({
      next: (res) => {
        this.progressData = res || [];
        this.calculateOverallStats();
        this.cdr.detectChanges();
        this.initRadarChart();
      },
      error: (err) => {
        console.error('Không thể tải tiến độ học tập:', err);
      }
    });
  }

  calculateOverallStats() {
    if (this.progressData.length === 0) return;
    const total = this.progressData.reduce((sum, item) => sum + item.totalQuestions, 0);
    const correct = this.progressData.reduce((sum, item) => sum + item.correctAnswers, 0);
    this.overallAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  }

  initRadarChart() {
    if (!this.radarCanvas || this.progressData.length === 0) return;

    const labels = this.progressData.map(item => item.topicName);
    const accuracyScores = this.progressData.map(item => 
      item.totalQuestions > 0 ? Math.round((item.correctAnswers / item.totalQuestions) * 100) : 0
    );

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.radarCanvas.nativeElement, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Mức độ thông thạo (%)',
          data: accuracyScores,
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          borderColor: '#a855f7',
          borderWidth: 2,
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#a855f7',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            pointLabels: {
              color: '#e2e8f0',
              font: { size: 12, family: 'Inter', weight: 'bold' }
            },
            ticks: {
              backdropColor: 'transparent',
              color: '#94a3b8',
              stepSize: 20
            },
            suggestedMin: 0,
            suggestedMax: 100
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` Độ chính xác: ${context.formattedValue}%`
            }
          }
        }
      }
    });
  }
}