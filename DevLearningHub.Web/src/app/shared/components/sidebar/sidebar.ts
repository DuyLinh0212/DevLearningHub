import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  private router = inject(Router);

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
