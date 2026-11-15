/// <reference types="leaflet" />
import { Component, inject, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { WarehouseService, Warehouse } from '../../services/warehouse.service';
import { Firestore, collection, getDocs } from '@angular/fire/firestore';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';

@Component({
  selector: 'app-warehouse-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouse-map.component.html',
  styleUrls: ['./warehouse-map.component.css']
})
export class WarehouseMapComponent implements OnInit, AfterViewInit, OnDestroy {

  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private warehouseService = inject(WarehouseService);
  private route = inject(ActivatedRoute);
  router = inject(Router);

  isSuperAdmin = false;
  warehouses: Warehouse[] = [];
  allAdmins: any[] = [];
  map: L.Map | null = null;
  markers: L.Marker[] = [];

  // For coordinate selection mode
  selectionMode = false;
  selectedLat = 0;
  selectedLng = 0;
  returnTo = 'warehouses';

  ngOnInit() {
    this.authService.role$.subscribe(role => {
      this.isSuperAdmin = role === 'superadmin';
    });

    // Check if we're in coordinate selection mode
    this.route.queryParams.subscribe(params => {
      if (params['mode'] === 'add' || params['mode'] === 'edit') {
        this.selectionMode = true;
        this.selectedLat = parseFloat(params['lat']) || 0;
        this.selectedLng = parseFloat(params['lng']) || 0;
        this.returnTo = params['returnTo'] || 'warehouses';
      }
    });

    this.loadWarehouses();
    this.loadAdmins();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
    }, 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  async loadWarehouses() {
    try {
      this.warehouses = await this.warehouseService.getAllWarehouses();
      if (this.map) {
        this.updateMarkers();
      }
    } catch (error) {
      console.error('Error loading warehouses:', error);
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

  initMap() {
    // Default center (can be adjusted)
    const defaultLat = this.selectedLat || 24.7136;
    const defaultLng = this.selectedLng || 46.6753;
    const defaultZoom = this.selectionMode ? 13 : 6;

    this.map = L.map('warehouse-map').setView([defaultLat, defaultLng], defaultZoom);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // If in selection mode, add click handler and show initial marker
    if (this.selectionMode) {
      if (this.selectedLat && this.selectedLng) {
        this.addSelectionMarker(this.selectedLat, this.selectedLng);
      }

      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.selectedLat = e.latlng.lat;
        this.selectedLng = e.latlng.lng;
        this.addSelectionMarker(this.selectedLat, this.selectedLng);
      });
    } else {
      // Normal mode: show all warehouses
      this.updateMarkers();
    }
  }

  addSelectionMarker(lat: number, lng: number) {
    if (!this.map) return;

    // Remove existing selection marker
    this.markers.forEach(m => {
      if ((m as any).isSelectionMarker) {
        this.map!.removeLayer(m);
      }
    });
    this.markers = this.markers.filter(m => !(m as any).isSelectionMarker);

    // Add new selection marker
    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(this.map!);

    marker.bindPopup(`Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
    (marker as any).isSelectionMarker = true;
    this.markers.push(marker);
  }

  updateMarkers() {
    if (!this.map) return;

    // Clear existing markers
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];

    // Add markers for each warehouse
    this.warehouses.forEach(warehouse => {
      if (warehouse.latitude && warehouse.longitude) {
        const admin = this.allAdmins.find(a => a.uid === warehouse.adminId);
        const adminName = admin ? (admin.name || admin.email) : 'Unassigned';

        const marker = L.marker([warehouse.latitude, warehouse.longitude]).addTo(this.map!);
        
        const popupContent = `
          <div style="min-width: 200px;">
            <strong>${warehouse.name}</strong><br/>
            <small>${warehouse.address}</small><br/>
            <small><strong>Admin:</strong> ${adminName}</small>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        this.markers.push(marker);
      }
    });
  }

  confirmSelection() {
    if (this.selectedLat && this.selectedLng) {
      // Store coordinates in sessionStorage or pass via query params
      sessionStorage.setItem('selectedWarehouseCoords', JSON.stringify({
        lat: this.selectedLat,
        lng: this.selectedLng
      }));
      this.router.navigate([`/dashboard/${this.returnTo}`]);
    }
  }

  cancelSelection() {
    this.router.navigate([`/dashboard/${this.returnTo}`]);
  }

  goBack() {
    this.router.navigate(['/dashboard/warehouses']);
  }

  getAdminName(adminId: string | undefined): string {
    if (!adminId) return 'Unassigned';
    const admin = this.allAdmins.find(a => a.uid === adminId);
    return admin ? (admin.name || admin.email) : 'Unassigned';
  }
}

