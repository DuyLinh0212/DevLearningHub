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
    // Tự động thu hồi Sidebar về vị trí ẩn khi Admin bấm chuyển trang thành công trên điện thoại
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
    localStorage.clear(); // Xóa sạch token, phiên làm việc cũ và biến quyền hạn
    this.router.navigate(['/login']);
  }
}