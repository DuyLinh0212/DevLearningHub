import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit {
  private router = inject(Router);
  isAdminRoute: boolean = false;

  ngOnInit() {
    this.checkCurrentRoute(this.router.url);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.checkCurrentRoute(event.urlAfterRedirects);
    });
  }

  private checkCurrentRoute(url: string) {
    this.isAdminRoute = url.includes('/admin');
  }

  logout() {
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
