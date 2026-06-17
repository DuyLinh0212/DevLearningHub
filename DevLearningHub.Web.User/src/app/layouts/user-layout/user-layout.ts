import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';
import { MobileMenuService } from '../../core/services/mobile-menu.service';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './user-layout.html',
  styleUrl: './user-layout.css'
})
export class UserLayoutComponent {
  public mobileMenu = inject(MobileMenuService);

  toggleSidebar() {
    this.mobileMenu.toggle();
  }
}
