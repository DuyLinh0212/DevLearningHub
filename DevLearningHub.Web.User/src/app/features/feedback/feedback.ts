import { Component, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-feedback', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './feedback.html', styleUrl: './feedback.css'
})
export class FeedbackComponent implements OnInit {
  private http = inject(HttpClient); private cdr = inject(ChangeDetectorRef);
  subject = ''; body = ''; items: any[] = []; loading = false; saving = false; error = '';
  ngOnInit() { this.load(); }
  load() { this.loading = true; this.http.get<any>('/api/feedback/mine').subscribe({ next: r => { this.items = r?.data || r || []; this.loading = false; this.cdr.detectChanges(); }, error: () => { this.error = 'Không thể tải yêu cầu.'; this.loading = false; this.cdr.detectChanges(); } }); }
  submit() {
    if (!this.subject.trim() || !this.body.trim()) return;
    this.saving = true; this.http.post('/api/feedback', { subject: this.subject.trim(), body: this.body.trim() }).subscribe({
      next: () => { this.subject = ''; this.body = ''; this.saving = false; this.load(); },
      error: () => { this.error = 'Gửi yêu cầu thất bại.'; this.saving = false; this.cdr.detectChanges(); }
    });
  }
}
