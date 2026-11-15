import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';

/**
 * Simple service to store the logged-in user's warehouseId from their profile.
 * Gets it once from /users/{auth.uid} and stores in memory.
 * No localStorage, no default to "main".
 */
@Injectable({
  providedIn: 'root'
})
export class UserWarehouseService {
  private auth = inject(AuthService);
  private warehouseId$ = new BehaviorSubject<string | null>(null);
  private initialized = false;

  /**
   * Get the user's warehouseId from their profile.
   * Returns null for main warehouse (warehouseId is null, 'main', or empty).
   * Returns warehouseId string for users assigned to specific warehouses.
   * Returns null for superadmin (they don't have a warehouse assignment).
   */
  async getUserWarehouseId(): Promise<string | null> {
    if (this.initialized) {
      return this.warehouseId$.value;
    }

    try {
      const userData = await this.auth.getUserDataFromServer();
      if (!userData) {
        throw new Error('User data not found');
      }

      const role = userData?.role?.toLowerCase?.() ?? null;
      
      // Superadmin doesn't have a warehouseId
      if (role === 'superadmin') {
        this.warehouseId$.next(null);
        this.initialized = true;
        return null;
      }

      const warehouseId = userData.warehouseId;
      
      // Handle main warehouse: null, 'main', or empty string means main warehouse
      // For main warehouse, we return null (not an error)
      if (!warehouseId || warehouseId === 'main' || String(warehouseId).trim() === '') {
        // Main warehouse - return null (this is valid)
        this.warehouseId$.next(null);
        this.initialized = true;
        console.log('[UserWarehouseService] User assigned to main warehouse (null)');
        return null;
      }

      // User is assigned to a specific warehouse
      const warehouseIdStr = String(warehouseId).trim();
      this.warehouseId$.next(warehouseIdStr);
      this.initialized = true;
      console.log('[UserWarehouseService] User warehouseId loaded:', warehouseIdStr);
      return warehouseIdStr;
    } catch (error) {
      console.error('[UserWarehouseService] Error getting user warehouseId:', error);
      this.initialized = true;
      throw error;
    }
  }

  /**
   * Get warehouseId synchronously (returns current value).
   * Returns null if not initialized (doesn't throw to allow Observable error handling).
   * Components should call getUserWarehouseId() to ensure initialization.
   */
  getWarehouseId(): string | null {
    if (!this.initialized) {
      console.warn('[UserWarehouseService] getWarehouseId() called before initialization. Call getUserWarehouseId() first.');
      return null;
    }
    return this.warehouseId$.value;
  }

  /**
   * Observable of warehouseId
   */
  getWarehouseId$() {
    return this.warehouseId$.asObservable();
  }

  /**
   * Reset (for logout)
   */
  reset() {
    this.warehouseId$.next(null);
    this.initialized = false;
  }
}

