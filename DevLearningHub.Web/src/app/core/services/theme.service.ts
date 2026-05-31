import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(true);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      this.isDarkMode.set(savedTheme !== 'light');
      this.applyTheme();
    }
  }

  toggleTheme() {
    this.isDarkMode.update(dark => !dark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', this.isDarkMode() ? 'dark' : 'light');
      this.applyTheme();
    }
  }

  applyTheme() {
    if (typeof window !== 'undefined') {
      if (this.isDarkMode()) {
        document.documentElement.classList.remove('light-theme');
      } else {
        document.documentElement.classList.add('light-theme');
      }
    }
  }
}
