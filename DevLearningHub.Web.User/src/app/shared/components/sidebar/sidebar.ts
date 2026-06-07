import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  
  // Trạng thái bật tắt Menu trượt trên thiết bị Mobile
  isMobileOpen: boolean = false;

  ngOnInit() {
    // Tự động đóng Sidebar trên Mobile mỗi khi học sinh bấm chuyển trang thành công
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isMobileOpen = false;
      this.cdr.detectChanges();
    });
  }

  toggleMobileSidebar() {
    this.isMobileOpen = !this.isMobileOpen;
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.clear(); // Xóa sạch token và phiên làm việc cũ
    this.router.navigate(['/login']);
  }

  onSidebarSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input && input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value.trim() } });
      input.value = '';
    }
  }
}