import { Component, OnInit, inject, ElementRef, ViewChild, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProgressService } from '../../../core/services/progress.service';
import { ThemeService } from '../../../core/services/theme.service';
import { Chart } from 'chart.js/auto';
import type { TooltipItem } from 'chart.js';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-user-progress',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './user-progress.html',
  styleUrl: './user-progress.css'
})
export class UserProgressComponent implements OnInit {
  private progressService = inject(ProgressService);
  private cdr = inject(ChangeDetectorRef);
  public themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      // Re-render chart dynamically when theme state changes
      const isDark = this.themeService.isDarkMode();
      if (this.progressData.length > 0) {
        setTimeout(() => this.initRadarChart(), 50);
      }
    });
  }

  // Khai báo canvas động nhận diện sau khi view ổn định
  @ViewChild('radarCanvas', { static: false }) radarCanvas!: ElementRef;
  
  chart: any;
  progressData: any[] = [];
  overallAccuracy: number = 0;
  strongestTopic: any = null;
  weakestTopic: any = null;
  masteredCount: number = 0;
  totalAttemptsSum: number = 0;

  ngOnInit() {
    this.loadProgress();
  }

  loadProgress() {
    console.log('=== PROGRESS: BẮT ĐẦU TẢI PHÂN TÍCH NĂNG LỰC TỪ SWAGGER ===');
    this.progressService.getUserProgress().subscribe({
      next: (res: any) => {
        console.log('Dữ liệu thực tế bóc tách từ API Progress:', res);
        
        // PHÁ VỠ VỎ BỌC DATA ĐỂ TRÍCH XUẤT MẢNG THỰC TẾ
        const actualData = res?.data || res;
        const rawArray = Array.isArray(actualData) ? actualData : [];

        // Map dữ liệu chuẩn hóa thuộc tính chính xác từ Swagger của Nam
        const apiData = rawArray.map((item: any) => {
          const rawAcc = item.accuracy ?? 0;
          // Quy đổi tỷ lệ từ số thập phân (0.85 -> 85%) hoặc số nguyên
          const computedAccuracy = Math.round(rawAcc <= 1 ? rawAcc * 100 : rawAcc);

          return {
            topicId: item.topicId,
            topicName: item.topicName || 'Chủ đề mặc định',
            totalAttempts: item.totalAttempts || 0,
            totalQuestions: item.totalQuestions || 0,
            correctAnswers: item.correctAnswers || 0,
            bestScore: item.bestScore || 0,
            accuracy: computedAccuracy,
            lastPracticed: item.lastPracticedAt ? new Date(item.lastPracticedAt).toLocaleDateString('vi-VN') : 'Chưa làm'
          };
        });

        // Merge dữ liệu local (mock quiz) vào danh sách nếu chưa có trong API (đã ẩn do user cấm localStorage)
        const localData: any[] = [];

        const merged = [...apiData];
        localData.forEach((local: any) => {
          const exists = merged.some(api => api.topicId === local.topicId);
          if (!exists) {
            merged.push(local);
          }
        });

        this.progressData = merged;
        this.calculateOverallStats();
        this.cdr.detectChanges();

        // CHỐT CHẶN PHÒNG THỦ: Trì hoãn nhẹ 60ms để Angular kịp render thẻ <canvas> ra DOM rồi mới vẽ Chart
        setTimeout(() => {
          this.initRadarChart();
        }, 60);
      },
      error: (err) => {
        console.error('Không thể tải tiến độ học tập từ hệ thống:', err);
        // Khi API lỗi, fallback hoàn toàn sang localStorage (đã ẩn do user cấm localStorage)
        const localData: any[] = [];
        this.progressData = localData;
        this.calculateOverallStats();
        this.cdr.detectChanges();
        // Vẫn thử render chart nếu có dữ liệu local
        if (localData.length > 0) {
          setTimeout(() => this.initRadarChart(), 60);
        }
      }
    });
  }

  calculateOverallStats() {
    if (!this.progressData || this.progressData.length === 0) {
      this.overallAccuracy = 0;
      this.strongestTopic = null;
      this.weakestTopic = null;
      this.masteredCount = 0;
      this.totalAttemptsSum = 0;
      return;
    }
    const total = this.progressData.reduce((sum, item) => sum + (item.totalQuestions || 0), 0);
    const correct = this.progressData.reduce((sum, item) => sum + (item.correctAnswers || 0), 0);
    this.overallAccuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Chủ đề mạnh nhất / yếu nhất để đánh giá năng lực trực quan hơn radar đơn thuần
    const sortedByAccuracy = [...this.progressData].sort((a, b) => b.accuracy - a.accuracy);
    this.strongestTopic = sortedByAccuracy[0] || null;
    this.weakestTopic = sortedByAccuracy[sortedByAccuracy.length - 1] || null;

    // Số chủ đề đã đạt mức thông thạo (>= 80%)
    this.masteredCount = this.progressData.filter(item => item.accuracy >= 80).length;

    // Tổng số lượt luyện tập trên toàn bộ chủ đề
    this.totalAttemptsSum = this.progressData.reduce((sum, item) => sum + (item.totalAttempts || 0), 0);
  }

  initRadarChart() {
    // Kiểm tra xem canvas đã được gắn kết thực tế chưa, tránh lỗi sập Runtime
    if (!this.radarCanvas || !this.radarCanvas.nativeElement || this.progressData.length === 0) {
      console.warn('Hệ thống chưa tìm thấy thẻ Canvas để vẽ biểu đồ Radar!');
      return;
    }

    let labels = this.progressData.map(item => item.topicName);
    let accuracyScores = this.progressData.map(item => item.accuracy);

    // Xử lý đồ họa: Thêm các chặng ảo nếu học viên làm quá ít chủ đề để biểu đồ Radar không bị méo móp
    if (labels.length === 1) {
      labels = [labels[0], 'Chặng kết tiếp', 'Chặng mở rộng'];
      accuracyScores = [accuracyScores[0], 0, 0];
    } else if (labels.length === 2) {
      labels = [labels[0], labels[1], 'Chặng bổ trợ'];
      accuracyScores = [accuracyScores[0], accuracyScores[1], 0];
    }

    if (this.chart) {
      this.chart.destroy();
    }

    try {
      const isDark = this.themeService.isDarkMode();
      this.chart = new Chart(this.radarCanvas.nativeElement, {
        type: 'radar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Mức độ thông thạo (%)',
            data: accuracyScores,
            backgroundColor: isDark ? 'rgba(168, 85, 247, 0.12)' : 'rgba(109, 40, 217, 0.08)',
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
              angleLines: { color: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)' },
              grid: { color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
              pointLabels: {
                color: isDark ? '#e2e8f0' : '#0f172a',
                font: { size: 11, family: 'Inter', weight: 'bold' },
                padding: 16
              },
              ticks: {
                backdropColor: 'transparent',
                color: isDark ? '#94a3b8' : '#475569',
                stepSize: 20,
                showLabelBackdrop: false
              },
              suggestedMin: 0,
              suggestedMax: 100
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context: TooltipItem<'radar'>) => ` Độ chính xác: ${context.formattedValue}%`
              }
            }
          }
        }
      });
    } catch (chartError) {
      console.error('Lỗi khởi tạo thư viện đồ họa Chart.js:', chartError);
    }
  }
}