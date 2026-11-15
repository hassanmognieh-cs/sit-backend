import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { switchMap, map, filter, take } from 'rxjs/operators';
import { from, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.auth.authInitialized$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => from(this.auth.enforcePostAuthChecks('guard'))),
      map(enforcement => {
        // Signed out (either not logged in OR kicked out by enforcement)
        if (enforcement === 'signed_out') {
          this.router.navigate(['/login']);
          return false;
        }

        // Must change password before accessing anything else
        if (enforcement === 'must_change_password') {
          if (state.url === '/change-password') return true;
          this.router.navigate(['/change-password']);
          return false;
        }

        // Ready
        return true;
      })
    );
  }
}

