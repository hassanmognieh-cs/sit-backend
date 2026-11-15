import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { WarehouseContextService } from '../services/warehouse-context.service';
import { combineLatest, map, switchMap } from 'rxjs';
import { from, of } from 'rxjs';
import { filter, take } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class WarehouseGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private warehouseContext: WarehouseContextService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
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

        // Check if user is superadmin
        return combineLatest([
          this.auth.role$,
          this.warehouseContext.getCurrentWarehouse()
        ]).pipe(
          take(1),
          map(([role, warehouse]) => {
            // Only superadmin needs warehouse selection
            if (role === 'superadmin') {
              // Allow access to warehouse selection page
              if (state.url === '/warehouse-selection' || state.url.startsWith('/warehouse-selection')) {
                return true;
              }
              // Allow access to warehouses management page (to create warehouses)
              if (state.url.startsWith('/dashboard/warehouses')) {
                return true;
              }
              // Check if warehouse is selected (null = main warehouse is selected)
              const storedId = localStorage.getItem('selectedWarehouseId');
              if (!storedId) {
                // No warehouse selected, redirect to warehouse selection
                this.router.navigate(['/warehouse-selection']);
                return false;
              }
              // If storedId is 'main', warehouse is null (main warehouse) - this is valid
              // If storedId is a warehouse ID, warehouse should not be null
              if (storedId !== 'main' && !warehouse) {
                // Warehouse ID stored but warehouse not loaded - try to load it
                // For now, allow access and let the context service handle it
                return true;
              }
            }
            return true;
          })
        );
      })
    );
  }
}

