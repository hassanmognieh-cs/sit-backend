import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logout-confirmation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logout-confirmation.component.html',
  styleUrls: ['./logout-confirmation.component.css']
})
export class LogoutConfirmationComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  confirmLogout() {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/login']);
    });
  }

  cancelLogout() {
    // Go back to previous page or dashboard
    this.router.navigate(['/dashboard']);
  }
}






