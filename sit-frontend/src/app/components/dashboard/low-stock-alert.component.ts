import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LowStockAlertService, LowStockProduct } from '../../services/low-stock-alert.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-low-stock-alert',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="lowStockProducts.length > 0 && showAlert" class="low-stock-alert-container">
      <div class="low-stock-alert">
        <div class="alert-header">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <strong>Low Stock Alert</strong>
          <button class="btn-close-alert" (click)="dismissAlert()" title="Dismiss">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="alert-body">
          <p *ngIf="lowStockProducts.length === 1" class="alert-message">
            ⚠ <strong>{{ lowStockProducts[0].name }}</strong> is going to be out of stock soon, restock now.
          </p>
          <p *ngIf="lowStockProducts.length > 1" class="alert-message">
            ⚠ <strong>{{ lowStockProducts.length }} products</strong> are going to be out of stock soon, restock now.
          </p>
          <div class="alert-actions">
            <button class="btn-restock" (click)="notifySupplier()">
              <i class="bi bi-envelope"></i> Restock Now
            </button>
            <button class="btn-view" (click)="viewProducts()">
              <i class="bi bi-eye"></i> View Products
            </button>
          </div>
          <div class="never-show-again">
            <label class="never-show-label">
              <input type="checkbox" [(ngModel)]="neverShowAgain" (change)="onNeverShowChange()">
              <span>Never show again</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .low-stock-alert-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    .low-stock-alert {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      border-left: 4px solid #dc3545;
      overflow: hidden;
    }

    .alert-header {
      background: #f8d7da;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #721c24;
      font-weight: 600;
    }

    .alert-header i {
      font-size: 20px;
      color: #dc3545;
    }

    .btn-close-alert {
      margin-left: auto;
      background: none;
      border: none;
      color: #721c24;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }

    .btn-close-alert:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }

    .alert-body {
      padding: 16px;
    }

    .alert-message {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 14px;
    }

    .alert-actions {
      display: flex;
      gap: 8px;
    }

    .btn-restock,
    .btn-view {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }

    .btn-restock {
      background: #dc3545;
      color: #fff;
    }

    .btn-restock:hover {
      background: #c82333;
      transform: translateY(-1px);
    }

    .never-show-again {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
    }

    .never-show-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
      color: #666;
      user-select: none;
    }

    .never-show-label input[type="checkbox"] {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }

    .never-show-label:hover {
      color: #333;
    }

    .btn-view {
      background: #0d6efd;
      color: white;
    }

    .btn-view:hover {
      background: #0b5ed7;
      transform: translateY(-1px);
    }

    @media (max-width: 768px) {
      .low-stock-alert-container {
        top: 10px;
        right: 10px;
        left: 10px;
        max-width: none;
      }
    }
  `]
})
export class LowStockAlertComponent implements OnInit, OnDestroy {
  private lowStockAlertService = inject(LowStockAlertService);
  private authService = inject(AuthService);
  private router = inject(Router);

  lowStockProducts: LowStockProduct[] = [];
  showAlert = true;
  neverShowAgain = false;
  private subscription?: Subscription;
  private readonly NEVER_SHOW_KEY = 'lowStockAlertNeverShow';

  ngOnInit() {
    // Check if user has chosen to never show again
    const neverShow = localStorage.getItem(this.NEVER_SHOW_KEY);
    if (neverShow === 'true') {
      this.showAlert = false;
      return;
    }

    this.subscription = this.lowStockAlertService.getLowStockProducts().subscribe(products => {
      this.lowStockProducts = products;
      // Only show if there are products and user hasn't disabled it
      const neverShow = localStorage.getItem(this.NEVER_SHOW_KEY);
      this.showAlert = products.length > 0 && neverShow !== 'true';
    });
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }

  dismissAlert() {
    this.showAlert = false;
  }

  onNeverShowChange() {
    if (this.neverShowAgain) {
      localStorage.setItem(this.NEVER_SHOW_KEY, 'true');
      this.showAlert = false;
    } else {
      localStorage.removeItem(this.NEVER_SHOW_KEY);
    }
  }

  viewProducts() {
    this.router.navigate(['/dashboard/products']);
    this.dismissAlert();
  }

  notifySupplier() {
    if (this.lowStockProducts.length === 0) return;

    // If single product, notify its supplier
    if (this.lowStockProducts.length === 1) {
      const product = this.lowStockProducts[0];
      this.sendEmailToSupplier(product);
    } else {
      // If multiple products, notify all suppliers
      this.lowStockProducts.forEach(product => {
        if (product.supplierEmail) {
          this.sendEmailToSupplier(product);
        }
      });
    }
  }

  private sendEmailToSupplier(product: LowStockProduct) {
    if (!product.supplierEmail) {
      alert(`Supplier email not found for ${product.name}. Please update supplier information.`);
      return;
    }

    const adminEmail = this.authService.user$.value?.email || 'admin@inventory.com';
    const adminName = adminEmail.split('@')[0] || 'Admin';
    const suggestedRestock = Math.max(product.threshold * 2, 50);

    const subject = encodeURIComponent(`Restock Request: ${product.name}`);
    const body = encodeURIComponent(
      `Dear Supplier,

We need to restock the following product:

Product Name: ${product.name}
Current Stock: ${product.stockQuantity} units
Threshold: ${product.threshold} units
Suggested Restock Quantity: ${suggestedRestock} units

Please arrange for the restock at your earliest convenience.

Best regards,
${adminName}
${adminEmail}`
    );

    window.location.href = `mailto:${product.supplierEmail}?subject=${subject}&body=${body}`;
  }
}

