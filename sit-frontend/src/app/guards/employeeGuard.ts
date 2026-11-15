import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class EmployeeGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate() {
    return this.auth.role$.pipe(
      map(role => {
        if (role === 'employee') {
          return true;
        }

        // If not an employee, send the user back to the dashboard
        this.router.navigate(['/dashboard']);
        return false;
      })
    );
  }
}


