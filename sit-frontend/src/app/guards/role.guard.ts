import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { combineLatest, map, switchMap } from 'rxjs';
import { from, of } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const allowedRoles = route.data?.['roles'] as string[] | undefined;

    return this.auth.authInitialized$.pipe(
      filter(Boolean),
      take(1),
      switchMap(() => from(this.auth.enforcePostAuthChecks('guard'))),
      switchMap(enforcement => {
        if (enforcement === 'signed_out') {
          this.router.navigate(['/login']);
          return of(false);
        }

        if (enforcement === 'must_change_password') {
          if (state.url === '/change-password') return of(true);
          this.router.navigate(['/change-password']);
          return of(false);
        }

        // enforcement === 'ready' -> proceed to role checks
        return combineLatest([this.auth.user$, this.auth.role$]).pipe(
          map(([user, role]) => {
            if (!user) {
              this.router.navigate(['/login']);
              return false;
            }

            if (!allowedRoles || allowedRoles.length === 0) {
              return true;
            }

            // SuperAdmin bypasses all role restrictions
            if (role === 'superadmin') {
              return true;
            }

            if (role && allowedRoles.includes(role)) {
              return true;
            }

            this.router.navigate(['/dashboard']);
            return false;
          })
        );
      })
    );
  }
}
