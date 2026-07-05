import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-review-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visibleStatus) {
      <span class="status-chip" [ngClass]="statusClass">{{ statusLabel }}</span>
    }
  `,
  styleUrl: './review-status-badge.css'
})
export class ReviewStatusBadgeComponent {
  @Input() status: string | null | undefined = '';

  get visibleStatus(): string {
    return (this.status || '').toLowerCase();
  }

  get statusLabel(): string {
    switch (this.visibleStatus) {
      case 'approved':
        return 'Đã duyệt';
      case 'rejected':
        return 'Bị từ chối';
      case 'pending':
        return 'Chờ duyệt';
      default:
        return '';
    }
  }

  get statusClass(): string {
    switch (this.visibleStatus) {
      case 'approved':
        return 'is-approved';
      case 'rejected':
        return 'is-rejected';
      case 'pending':
        return 'is-pending';
      default:
        return '';
    }
  }
}
