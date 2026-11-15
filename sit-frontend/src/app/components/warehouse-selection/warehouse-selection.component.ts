import { Component, inject, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { WarehouseService, Warehouse } from '../../services/warehouse.service';
import { WarehouseContextService } from '../../services/warehouse-context.service';
import { AuthService } from '../../services/auth.service';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-warehouse-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-selection.component.html',
  styleUrls: ['./warehouse-selection.component.css']
})
export class WarehouseSelectionComponent implements OnInit, AfterViewInit {
  private warehouseService = inject(WarehouseService);
  private warehouseContext = inject(WarehouseContextService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private cdr = inject(ChangeDetectorRef);

  warehouses: Warehouse[] = [];
  selectedWarehouseId: string = '';
  loading = false;
  errorMessage = '';
  isSuperAdmin = false;
  
  // Form state for add warehouse modal
  showAddModal = false;
  name = '';
  city = '';
  address = '';
  latitude = 0;
  longitude = 0;
  adminId: string | undefined = undefined;
  allAdmins: any[] = [];
  formErrorMessage = '';
  
  // Lebanon cities with coordinates
  lebanonCities = [
    { name: 'Beirut', lat: 33.8938, lng: 35.5018 },
    { name: 'Tripoli', lat: 34.4333, lng: 35.8333 },
    { name: 'Sidon', lat: 33.5631, lng: 35.3689 },
    { name: 'Tyre', lat: 33.2708, lng: 35.1961 },
    { name: 'Byblos', lat: 34.1231, lng: 35.6511 },
    { name: 'Zahle', lat: 33.8497, lng: 35.9042 },
    { name: 'Baalbek', lat: 34.0058, lng: 36.2181 },
    { name: 'Jounieh', lat: 33.9806, lng: 35.6175 },
    { name: 'Batroun', lat: 34.2553, lng: 35.6581 },
    { name: 'Nabatieh', lat: 33.3781, lng: 35.4831 },
    { name: 'Marjayoun', lat: 33.3631, lng: 35.5917 }
  ];

  ngOnInit() {
    // Check user role
    this.authService.role$.subscribe(role => {
      this.isSuperAdmin = role === 'superadmin';
    });
    
    this.loadWarehouses();
    this.loadAdmins();
    
    // Check for coordinates from map selection
    this.route.queryParams.subscribe(params => {
      if (params['coordsSelected'] === 'true') {
        console.log('[WarehouseSelection] Detected coordsSelected flag');
        setTimeout(() => {
          this.checkForMapSelection();
          // Remove the flag from URL
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true
          });
        }, 200);
      }
    });
  }

  ngAfterViewInit() {
    // Check if we're returning from map selection
    this.checkForMapSelection();
  }

  async loadWarehouses() {
    this.loading = true;
    this.errorMessage = '';
    try {
      const allWarehouses = await this.warehouseService.getAllWarehouses();
      // Filter out any warehouse named "Main Warehouse" or similar - the main warehouse is represented by the hardcoded card
      // This prevents duplicate "Main Warehouse" cards
      this.warehouses = allWarehouses.filter(w => {
        if (!w.name) return true; // Keep warehouses without names (shouldn't happen, but safe)
        const name = (w.name || '').toLowerCase().trim();
        // Filter out any warehouse with "main warehouse" in the name (case-insensitive)
        // This catches variations like "Main Warehouse", "main warehouse", "Main Warehouse (Default)", etc.
        return !name.includes('main warehouse') && name !== 'main';
      });
      console.log('[WarehouseSelection] Loaded warehouses (filtered):', this.warehouses.length);
      console.log('[WarehouseSelection] Filtered warehouse names:', this.warehouses.map(w => w.name));
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      this.errorMessage = 'Failed to load warehouses. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async selectWarehouse() {
    if (!this.selectedWarehouseId) {
      this.errorMessage = 'Please select a warehouse.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      console.log('[WarehouseSelection] selectWarehouse() - Selected ID:', this.selectedWarehouseId);
      
      // If "main" is selected, set warehouse to null (main warehouse)
      if (this.selectedWarehouseId === 'main') {
        console.log('[WarehouseSelection] selectWarehouse() - Setting main warehouse');
        this.warehouseContext.clearWarehouse();
        localStorage.setItem('selectedWarehouseId', 'main');
      } else {
        console.log('[WarehouseSelection] selectWarehouse() - Setting warehouse:', this.selectedWarehouseId);
        await this.warehouseContext.setWarehouse(this.selectedWarehouseId);
        console.log('[WarehouseSelection] selectWarehouse() - Warehouse set successfully');
      }
      
      // Navigate to dashboard
      console.log('[WarehouseSelection] selectWarehouse() - Navigating to dashboard');
      this.router.navigate(['/dashboard']);
    } catch (error: any) {
      console.error('[WarehouseSelection] selectWarehouse() - Error details:', error);
      console.error('[WarehouseSelection] selectWarehouse() - Error status:', error?.status);
      console.error('[WarehouseSelection] selectWarehouse() - Error message:', error?.message);
      console.error('[WarehouseSelection] selectWarehouse() - Error response:', error?.error);
      
      // Provide more specific error message
      let errorMsg = 'Failed to select warehouse. Please try again.';
      if (error?.status === 403) {
        errorMsg = 'Access denied. You do not have permission to access this warehouse.';
      } else if (error?.status === 404) {
        errorMsg = 'Warehouse not found. It may have been deleted.';
      } else if (error?.status === 401) {
        errorMsg = 'Authentication failed. Please login again.';
      } else if (error?.error?.message) {
        errorMsg = error.error.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      this.errorMessage = errorMsg;
    } finally {
      this.loading = false;
    }
  }

  openAddWarehouseModal() {
    this.showAddModal = true;
    this.name = '';
    this.city = '';
    this.address = '';
    this.latitude = 0;
    this.longitude = 0;
    this.adminId = undefined;
    this.formErrorMessage = '';
  }

  closeAddModal() {
    this.showAddModal = false;
    this.formErrorMessage = '';
  }

  onCityChange() {
    // When city changes, update coordinates to city center if not already set
    if (this.city) {
      const cityData = this.lebanonCities.find(c => c.name === this.city);
      if (cityData && (this.latitude === 0 || this.longitude === 0)) {
        this.latitude = cityData.lat;
        this.longitude = cityData.lng;
      }
    } else {
      this.latitude = 0;
      this.longitude = 0;
    }
  }

  openMapForCoordinates() {
    if (!this.city) {
      this.formErrorMessage = 'Please select a city first.';
      return;
    }
    
    const cityData = this.lebanonCities.find(c => c.name === this.city);
    if (!cityData) {
      this.formErrorMessage = 'Invalid city selected.';
      return;
    }
    
    // Save current form mode to sessionStorage
    sessionStorage.setItem('warehouseFormMode', 'add');
    
    const coords = {
      lat: this.latitude || cityData.lat,
      lng: this.longitude || cityData.lng
    };
    
    this.router.navigate(['/dashboard/warehouses/map'], {
      queryParams: {
        mode: 'add',
        city: this.city,
        cityLat: cityData.lat,
        cityLng: cityData.lng,
        lat: coords.lat,
        lng: coords.lng,
        returnTo: 'warehouse-selection'
      }
    });
  }

  checkForMapSelection() {
    const coordsStr = sessionStorage.getItem('selectedWarehouseCoords');
    if (coordsStr) {
      try {
        const coords = JSON.parse(coordsStr);
        if (coords.lat && coords.lng && coords.lat !== 0 && coords.lng !== 0) {
          this.latitude = coords.lat;
          this.longitude = coords.lng;
          sessionStorage.removeItem('selectedWarehouseCoords');
          
          // Restore form data if it exists
          const formDataStr = sessionStorage.getItem('warehouseFormData');
          if (formDataStr) {
            try {
              const formData = JSON.parse(formDataStr);
              this.name = formData.name || '';
              this.city = formData.city || '';
              this.address = formData.address || '';
              this.adminId = formData.adminId;
              sessionStorage.removeItem('warehouseFormData');
            } catch (e) {
              console.error('Error parsing form data:', e);
            }
          }
          
          // Reopen modal if it was open
          const wasInAddMode = sessionStorage.getItem('warehouseFormMode') === 'add';
          if (wasInAddMode) {
            this.showAddModal = true;
            sessionStorage.removeItem('warehouseFormMode');
          }
          
          this.cdr.detectChanges();
        }
      } catch (e) {
        console.error('Error parsing coordinates:', e);
        sessionStorage.removeItem('selectedWarehouseCoords');
      }
    }
  }

  async loadAdmins() {
    try {
      const snap = await getDocs(collection(this.firestore, 'users'));
      this.allAdmins = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data['role'] === 'admin') {
          this.allAdmins.push({
            uid: docSnap.id,
            ...data
          });
        }
      });
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  }

  async submitWarehouseForm() {
    this.formErrorMessage = '';
    
    if (!this.name.trim()) {
      this.formErrorMessage = 'Warehouse name is required.';
      return;
    }
    
    if (!this.city) {
      this.formErrorMessage = 'Please select a city.';
      return;
    }
    
    if (!this.address.trim()) {
      this.formErrorMessage = 'Address is required.';
      return;
    }
    
    if (this.latitude === 0 || this.longitude === 0) {
      this.formErrorMessage = 'Please select a location on the map.';
      return;
    }

    try {
      const warehouseData: Omit<Warehouse, 'id' | 'createdBy' | 'createdAt'> & { city?: string } = {
        name: this.name.trim(),
        address: this.address.trim(),
        latitude: this.latitude,
        longitude: this.longitude,
        city: this.city.trim(),
        adminId: this.adminId && this.adminId.trim() !== '' ? this.adminId : undefined
      };

      await this.warehouseService.createWarehouse(warehouseData);
      this.formErrorMessage = '';
      
      // Reload warehouses list
      await this.loadWarehouses();
      
      // Close modal
      this.closeAddModal();
      
      // Show success message
      alert('Warehouse created successfully!');
    } catch (error: any) {
      console.error('Error creating warehouse:', error);
      this.formErrorMessage = error?.error?.message || 'Failed to create warehouse.';
    }
  }

  // Method to refresh warehouses (can be called from parent or after navigation)
  async refreshWarehouses() {
    await this.loadWarehouses();
  }

  async deleteWarehouse(warehouse: Warehouse, event: Event) {
    // Stop event propagation to prevent selecting the warehouse when clicking delete
    event.stopPropagation();
    
    if (!this.isSuperAdmin) {
      this.errorMessage = 'Only superadmins can delete warehouses.';
      return;
    }
    
    if (!warehouse.id) {
      this.errorMessage = 'Invalid warehouse.';
      return;
    }

    // Confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete "${warehouse.name}"?\n\nThis action cannot be undone and will permanently remove the warehouse and all its data.`);
    
    if (!confirmed) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.warehouseService.deleteWarehouse(warehouse.id);
      
      // If the deleted warehouse was selected, clear selection
      if (this.selectedWarehouseId === warehouse.id) {
        this.selectedWarehouseId = '';
      }
      
      // Reload warehouses list
      await this.loadWarehouses();
      
      // Show success message
      alert(`Warehouse "${warehouse.name}" has been deleted successfully.`);
    } catch (error: any) {
      console.error('[WarehouseSelection] Error deleting warehouse:', error);
      let errorMsg = 'Failed to delete warehouse. Please try again.';
      if (error?.error?.message) {
        errorMsg = error.error.message;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      this.errorMessage = errorMsg;
    } finally {
      this.loading = false;
    }
  }
}

