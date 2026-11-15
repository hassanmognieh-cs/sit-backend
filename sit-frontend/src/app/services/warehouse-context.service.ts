import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Warehouse, WarehouseService } from './warehouse.service';

@Injectable({
  providedIn: 'root'
})
export class WarehouseContextService {
  // Selected warehouse entity (null = main warehouse)
  private currentWarehouse$ = new BehaviorSubject<Warehouse | null>(null);

  // Selected warehouse ID context (BehaviorSubject of ID as requested)
  // 'main' = main warehouse (root collections)
  private selectedWarehouseId$ = new BehaviorSubject<string>('main');

  private readonly STORAGE_KEY = 'selectedWarehouseId';

  constructor(private warehouseService: WarehouseService) {
    // Load warehouse from localStorage on init
    this.loadWarehouseFromStorage();
  }

  // Observable of the full warehouse entity (null = main)
  getCurrentWarehouse(): Observable<Warehouse | null> {
    return this.currentWarehouse$.asObservable();
  }

  getCurrentWarehouseValue(): Warehouse | null {
    return this.currentWarehouse$.value;
  }

  /**
   * Set selected warehouse by ID.
   * For non-main warehouses this will load the warehouse document from Firestore.
   */
  async setWarehouse(warehouseId: string): Promise<void> {
    if (!warehouseId || warehouseId === 'main') {
      this.clearWarehouse();
      localStorage.setItem(this.STORAGE_KEY, 'main');
      this.selectedWarehouseId$.next('main');
      return;
    }

    try {
      console.log('[WarehouseContext] setWarehouse() - Loading warehouse:', warehouseId);
      // Use backend API to load warehouse (handles auth + Firestore access)
      const warehouse = await this.warehouseService.getWarehouseById(warehouseId);
      console.log('[WarehouseContext] setWarehouse() - Warehouse loaded:', warehouse);
      
      if (!warehouse || !warehouse.id) {
        throw new Error('Warehouse data is invalid or missing ID');
      }
      
      this.currentWarehouse$.next(warehouse);
      this.selectedWarehouseId$.next(warehouseId);
      localStorage.setItem(this.STORAGE_KEY, warehouseId);
      console.log('[WarehouseContext] setWarehouse() - Warehouse set successfully');
    } catch (error: any) {
      console.error('[WarehouseContext] setWarehouse() - Error loading warehouse:', error);
      console.error('[WarehouseContext] setWarehouse() - Error status:', error?.status);
      console.error('[WarehouseContext] setWarehouse() - Error message:', error?.message);
      console.error('[WarehouseContext] setWarehouse() - Error response:', error?.error);
      throw error;
    }
  }

  async loadWarehouseFromStorage(): Promise<void> {
    const storedId = localStorage.getItem(this.STORAGE_KEY);
    if (storedId) {
      // "main" means main warehouse (null = main warehouse)
      if (storedId === 'main') {
        this.currentWarehouse$.next(null);
        this.selectedWarehouseId$.next('main');
        return;
      }
      try {
        const warehouse = await this.warehouseService.getWarehouseById(storedId);
        this.currentWarehouse$.next(warehouse);
        this.selectedWarehouseId$.next(storedId);
      } catch (error) {
        // Warehouse might have been deleted, clear storage
        console.warn('Stored warehouse not found, clearing storage');
        localStorage.removeItem(this.STORAGE_KEY);
        this.currentWarehouse$.next(null);
        this.selectedWarehouseId$.next('main');
      }
    } else {
      // No stored warehouse → main by default
      this.currentWarehouse$.next(null);
      this.selectedWarehouseId$.next('main');
    }
  }

  clearWarehouse(): void {
    this.currentWarehouse$.next(null);
    this.selectedWarehouseId$.next('main');
    // Keep STORAGE_KEY = 'main' to indicate explicit selection of main warehouse
    localStorage.setItem(this.STORAGE_KEY, 'main');
  }

  hasWarehouseSelected(): boolean {
    return this.currentWarehouse$.value !== null;
  }

  /**
   * Returns the Firestore ID of the currently selected warehouse.
   * - null means main warehouse (root collections)
   */
  getCurrentWarehouseId(): string | null {
    // If no warehouse selected, return null (main warehouse)
    // Otherwise return the warehouse ID
    return this.currentWarehouse$.value?.id || null;
  }

  isMainWarehouse(): boolean {
    return this.currentWarehouse$.value === null;
  }

  /**
   * Observable of the selected warehouse ID.
   * 'main' = main warehouse.
   */
  getSelectedWarehouseId$(): Observable<string> {
    return this.selectedWarehouseId$.asObservable();
  }

  /**
   * Convenience getter for current warehouse ID string.
   * Returns 'main' for main warehouse or the warehouse document ID for others.
   */
  getSelectedWarehouseId(): string {
    return this.selectedWarehouseId$.value;
  }

  /**
   * Switch warehouse by ID (main or specific warehouse).
   */
  async switchWarehouse(id: string): Promise<void> {
    await this.setWarehouse(id);
  }

  /**
   * Sync warehouse context with user's assigned warehouseId from Firestore.
   * This ensures users always see their assigned warehouse, not what's in localStorage.
   */
  async syncWithUserWarehouse(userWarehouseId: string | null | undefined): Promise<void> {
    try {
      console.log('[WarehouseContext] syncWithUserWarehouse called with:', userWarehouseId);
      console.log('[WarehouseContext] Type:', typeof userWarehouseId);
      
      // If user has a warehouseId, use it (unless it's 'main')
      if (userWarehouseId && userWarehouseId !== 'main' && String(userWarehouseId).trim() !== '') {
        const currentId = this.getSelectedWarehouseId();
        console.log('[WarehouseContext] Current warehouse ID:', currentId);
        console.log('[WarehouseContext] User warehouse ID:', userWarehouseId);
        
        // Always sync to ensure it matches user's assignment, even if it seems the same
        // This handles cases where localStorage might have a different value
        console.log('[WarehouseContext] Setting warehouse to:', userWarehouseId);
        
        try {
          await this.setWarehouse(userWarehouseId);
        } catch (setError: any) {
          // If setWarehouse fails, it might be a network issue or warehouse doesn't exist
          // But we should still set the selectedWarehouseId so the user sees their warehouse
          console.error('[WarehouseContext] Error in setWarehouse, but setting ID anyway:', setError);
          // Set the ID directly even if warehouse entity couldn't be loaded
          this.selectedWarehouseId$.next(userWarehouseId);
          localStorage.setItem(this.STORAGE_KEY, userWarehouseId);
          // Try to load warehouse entity in background (non-blocking)
          this.warehouseService.getWarehouseById(userWarehouseId).then(warehouse => {
            if (warehouse && warehouse.id) {
              this.currentWarehouse$.next(warehouse);
              console.log('[WarehouseContext] Warehouse entity loaded successfully in background');
            }
          }).catch(err => {
            console.error('[WarehouseContext] Failed to load warehouse entity in background:', err);
          });
        }
        
        // Verify it was set correctly
        const verifyId = this.getSelectedWarehouseId();
        console.log('[WarehouseContext] Verified warehouse ID after sync:', verifyId);
        
        if (verifyId !== userWarehouseId) {
          console.warn('[WarehouseContext] Warning: Warehouse ID mismatch after sync. Expected:', userWarehouseId, 'Got:', verifyId);
          // Force set it if there's a mismatch
          this.selectedWarehouseId$.next(userWarehouseId);
          localStorage.setItem(this.STORAGE_KEY, userWarehouseId);
        } else {
          console.log('[WarehouseContext] ✓ Warehouse ID set correctly');
        }
      } else {
        // User is assigned to main warehouse
        const currentId = this.getSelectedWarehouseId();
        console.log('[WarehouseContext] User assigned to main warehouse. Current ID:', currentId);
        if (currentId !== 'main') {
          console.log('[WarehouseContext] Syncing with main warehouse');
          this.clearWarehouse();
        }
      }
    } catch (error) {
      console.error('[WarehouseContext] Error syncing with user warehouse:', error);
      console.error('[WarehouseContext] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Don't fall back to main warehouse on error - user's assignment should be respected
      // Only clear if we're sure the user should be in main warehouse
      if (!userWarehouseId || userWarehouseId === 'main') {
        this.clearWarehouse();
      } else {
        // User has a warehouseId but sync failed - set it anyway
        console.warn('[WarehouseContext] Sync failed but user has warehouseId, setting it directly');
        this.selectedWarehouseId$.next(userWarehouseId);
        localStorage.setItem(this.STORAGE_KEY, userWarehouseId);
      }
    }
  }
}



