import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { ProductService } from '../../services/product.service';
import { InventoryMovementRequest } from '../../models/inventory-movement-request';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-stock-movement',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movement.component.html',
  styleUrls: ['./stock-movement.component.css']
})
export class StockMovementComponent implements OnInit {

  private productService = inject(ProductService);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  products: any[] = [];
  filteredProducts: any[] = [];

  selectedProduct: any = null;
  searchText = '';
  quantity: number = 1;
  minQuantity: number = 1;
  showAllProducts: boolean = false;

  type: 'IN' | 'OUT' | null = null;
  typeLocked: boolean = false;
  reason: string = '';
  reasonLocked: boolean = false;

  movementItems: { product: any, quantity: number }[] = [];
  errorMessage: string = '';

  ngOnInit() {
    this.loadProducts();
  }

  loadProducts() {
    this.productService.getProducts().subscribe(res => {
      this.products = res;
      this.filteredProducts = [];
    });
  }

  selectedIntent: string | null = null;

  // Select movement type (only allowed before first item)
  selectType(selectedType: 'IN' | 'OUT') {
    if (this.typeLocked) {
      this.errorMessage = 'Cannot change movement type. Please clear the list first.';
      return;
    }
    this.type = selectedType;
    this.errorMessage = '';
  }

  selectIntent(intent: string, type: 'IN' | 'OUT', reason: string) {
    this.selectedIntent = intent;
    this.type = type;
    this.reason = reason;
    this.errorMessage = '';
  }

  resetIntent() {
    this.selectedIntent = null;
    this.type = null;
    this.reason = '';
    this.movementItems = [];
    this.selectedProduct = null;
    this.searchText = '';
    this.quantity = 1;
    this.typeLocked = false;
    this.reasonLocked = false;
    this.errorMessage = '';
    this.filteredProducts = [];
    this.showAllProducts = false;
  }

  clearMovement() {
    if (confirm('Clear all items? This will reset the movement.')) {
      this.resetIntent();
    }
  }

  // Searchable dropdown
  filterProducts() {
    if (!this.type) {
      this.errorMessage = 'Please select a movement type first.';
      return;
    }
    
    if (this.showAllProducts) {
      // Show all products when "View All" is active
      this.filteredProducts = this.products;
    } else {
      // Filter by search text
      const query = this.searchText.toLowerCase();
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(query)
      );
    }
  }

  // Toggle view all products
  toggleViewAllProducts() {
    this.showAllProducts = !this.showAllProducts;
    this.filterProducts();
  }

  // Select product from dropdown
  selectProduct(product: any) {
    this.selectedProduct = product;
    this.searchText = product.name;
    this.filteredProducts = [];
    this.showAllProducts = false;
    this.errorMessage = '';
  }

  // Validate quantity
  validateQuantity() {
    if (this.quantity < 1) {
      this.quantity = 1;
    }
  }

  // Add product to list
  addItem() {
    // Validation
    if (!this.type) {
      this.errorMessage = 'Please select a movement type first.';
      return;
    }

    if (!this.selectedProduct) {
      this.errorMessage = 'Please select a product.';
      return;
    }

    if (!this.quantity || this.quantity < 1) {
      this.errorMessage = 'Quantity must be at least 1.';
      this.quantity = 1;
      return;
    }

    // Lock type and reason after first item
    if (this.movementItems.length === 0) {
      this.typeLocked = true;
      if (this.reason && this.reason.trim()) {
        this.reasonLocked = true;
      }
    }

    // Validate reason is set before adding first item
    if (this.movementItems.length === 0 && (!this.reason || !this.reason.trim())) {
      this.errorMessage = 'Please select a reason before adding products.';
      return;
    }

    // Add item
    this.movementItems.push({
      product: this.selectedProduct,
      quantity: this.quantity
    });

    // Reset
    this.selectedProduct = null;
    this.searchText = '';
    this.quantity = 1;
    this.filteredProducts = [];
    this.errorMessage = '';
  }

  // Remove item from list
  removeItem(index: number) {
    this.movementItems.splice(index, 1);
    
    // Unlock type and reason if list is empty
    if (this.movementItems.length === 0) {
      this.typeLocked = false;
      this.reasonLocked = false;
      this.type = null;
    }
  }

  // Get headers with auth token
  private async getHeadersAsync(): Promise<HttpHeaders> {
    const token = await this.authService.getFreshToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Submit full movement with multiple products
  async submitMovement() {
    if (!this.type) {
      this.errorMessage = 'Please select a movement type.';
      return;
    }

    if (this.movementItems.length === 0) {
      this.errorMessage = 'Please add at least one product.';
      return;
    }

    if (!this.reason || !this.reason.trim()) {
      this.errorMessage = 'Please provide a reason.';
      return;
    }

    const payload: InventoryMovementRequest = {
      type: this.type,
      reason: this.reason,
      note: "",
      createdBy: "admin",
      items: this.movementItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity
      }))
    };

    try {
      const headers = await this.getHeadersAsync();
      this.http.post('http://localhost:5011/api/inventorylogs/multi', payload, { headers })
        .subscribe({
          next: () => {
            alert("Movement recorded successfully!");

            this.resetIntent();
          },
          error: (err) => {
            console.error('Submission error:', err);
            const errorMsg = err.error?.message || err.message || 'Unknown error';
            this.errorMessage = `Error submitting movement: ${errorMsg}. Please try again.`;
          }
        });
    } catch (error: any) {
      console.error('Token error:', error);
      this.errorMessage = 'Authentication error. Please try logging in again.';
    }
  }

  // Get total quantity for summary
  getTotalQuantity(): number {
    return this.movementItems.reduce((sum, item) => sum + item.quantity, 0);
  }
}
