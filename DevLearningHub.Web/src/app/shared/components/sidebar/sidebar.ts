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
  isAdminRoute: boolean = false;
  isUserAdmin: boolean = false;

  ngOnInit() {
    this.checkCurrentRoute(this.router.url);
    this.checkUserRole();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkCurrentRoute(event.urlAfterRedirects);
      this.checkUserRole();
    });
  }

  private checkCurrentRoute(url: string) {
    this.isAdminRoute = url.includes('/admin');
  }

  private checkUserRole() {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (token) {
        try {
          const payloadPart = token.split('.')[1];
          const decodedPayload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
          const roleClaim = decodedPayload['role'] || decodedPayload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          
          this.isUserAdmin = Array.isArray(roleClaim) 
            ? roleClaim.map((r: string) => r.toLowerCase()).includes('admin') 
            : roleClaim?.toLowerCase() === 'admin';
            
        } catch (e) {
          this.isUserAdmin = false;
        }
      } else {
        this.isUserAdmin = false;
      }
    }
    this.cdr.detectChanges();
  }

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    this.router.navigate(['/login']);
  }

  onSidebarSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value.trim()) {
      this.router.navigate(['/quiz-bank'], { queryParams: { search: input.value } });
      input.value = '';
    }
  }
}