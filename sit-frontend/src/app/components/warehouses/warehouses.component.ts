import { Component, inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { WarehouseService, Warehouse } from '../../services/warehouse.service';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-warehouses',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouses.component.html',
  styleUrls: ['./warehouses.component.css']
})
export class WarehousesComponent implements OnInit, AfterViewInit {

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private warehouseService = inject(WarehouseService);
  private router = inject(Router);

  warehouses: Warehouse[] = [];
  filteredWarehouses: Warehouse[] = [];
  allAdmins: any[] = [];
  searchTerm: string = '';

  isSuperAdmin = false;

  showModal = false;
  mode: 'add' | 'edit' = 'add';
  selectedWarehouse: Warehouse | null = null;

  name = '';
  address = '';
  latitude = 0;
  longitude = 0;
  adminId = '';
  errorMessage = '';

  ngOnInit() {
    this.authService.role$.subscribe(role => {
      this.isSuperAdmin = role === 'superadmin';
    });

    this.loadWarehouses();
    this.loadAdmins();
  }

  async loadWarehouses() {
    try {
      this.warehouses = await this.warehouseService.getAllWarehouses();
      this.applyFilter();
    } catch (error) {
      console.error('Error loading warehouses:', error);
      this.errorMessage = 'Failed to load warehouses.';
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

  applyFilter() {
    const term = this.searchTerm.toLowerCase();
    this.filteredWarehouses = this.warehouses.filter(w =>
      (w.name || '').toLowerCase().includes(term) ||
      (w.address || '').toLowerCase().includes(term)
    );
  }

  openAddWarehouse() {
    if (!this.isSuperAdmin) return;
    this.mode = 'add';
    this.name = '';
    this.address = '';
    this.latitude = 0;
    this.longitude = 0;
    this.adminId = '';
    this.errorMessage = '';
    this.selectedWarehouse = null;
    this.showModal = true;
  }

  openEditWarehouse(warehouse: Warehouse) {
    if (!this.isSuperAdmin) return;
    this.mode = 'edit';
    this.selectedWarehouse = warehouse;
    this.name = warehouse.name;
    this.address = warehouse.address;
    this.latitude = warehouse.latitude;
    this.longitude = warehouse.longitude;
    this.adminId = warehouse.adminId || '';
    this.errorMessage = '';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  openMapForCoordinates() {
    // Navigate to map component with current coordinates
    const coords = {
      lat: this.latitude || 0,
      lng: this.longitude || 0
    };
    this.router.navigate(['/dashboard/warehouses/map'], {
      queryParams: {
        mode: this.mode,
        lat: coords.lat,
        lng: coords.lng,
        returnTo: 'warehouses'
      }
    });
  }

  ngAfterViewInit() {
    // Check if we're returning from map selection
    const coordsStr = sessionStorage.getItem('selectedWarehouseCoords');
    if (coordsStr) {
      try {
        const coords = JSON.parse(coordsStr);
        this.latitude = coords.lat;
        this.longitude = coords.lng;
        sessionStorage.removeItem('selectedWarehouseCoords');
      } catch (e) {
        // Ignore
      }
    }
  }

  async submitForm() {
    if (!this.isSuperAdmin) return;
    this.errorMessage = '';

    if (!this.name.trim()) {
      this.errorMessage = 'Name is required.';
      return;
    }

    if (!this.address.trim()) {
      this.errorMessage = 'Address is required.';
      return;
    }

    if (this.latitude === 0 && this.longitude === 0) {
      this.errorMessage = 'Please select coordinates on the map.';
      return;
    }

    try {
      const warehouseData: Omit<Warehouse, 'id' | 'createdBy' | 'createdAt'> = {
        name: this.name.trim(),
        address: this.address.trim(),
        latitude: this.latitude,
        longitude: this.longitude,
        adminId: this.adminId || undefined
      };

      if (this.mode === 'add') {
        await this.warehouseService.createWarehouse(warehouseData);
      } else if (this.selectedWarehouse?.id) {
        await this.warehouseService.updateWarehouse(this.selectedWarehouse.id, warehouseData);
      }

      this.closeModal();
      await this.loadWarehouses();
    } catch (error: any) {
      console.error('Error saving warehouse:', error);
      this.errorMessage = error?.error?.message || 'Failed to save warehouse.';
    }
  }

  async deleteWarehouse(warehouse: Warehouse) {
    if (!this.isSuperAdmin) return;
    if (!warehouse.id) return;

    if (!confirm(`Are you sure you want to delete "${warehouse.name}"?`)) return;

    try {
      await this.warehouseService.deleteWarehouse(warehouse.id);
      await this.loadWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      this.errorMessage = 'Failed to delete warehouse.';
    }
  }

  getAdminName(adminId: string | undefined): string {
    if (!adminId) return '—';
    const admin = this.allAdmins.find(a => a.uid === adminId);
    return admin ? (admin.name || admin.email) : '—';
  }

  viewOnMap() {
    this.router.navigate(['/dashboard/warehouses/map']);
  }
}

