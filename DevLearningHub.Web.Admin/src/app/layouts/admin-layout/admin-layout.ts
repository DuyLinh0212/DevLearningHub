import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminTopbarComponent } from '../../shared/components/topbar/topbar';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, AdminTopbarComponent],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css'
})
export class AdminLayoutComponent {}
