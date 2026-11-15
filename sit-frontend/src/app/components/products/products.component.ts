import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';
import { LowStockAlertService } from '../../services/low-stock-alert.service';
import { NotifyService } from '../../services/notify.service';
import { ProductFormComponent } from './product-form/product-form.component';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductComponent implements OnInit {

  auth = inject(AuthService);
  productService = inject(ProductService);
  categoryService = inject(CategoryService);
  supplierService = inject(SupplierService);
  lowStockAlertService = inject(LowStockAlertService);
  notifyService = inject(NotifyService);
  private cdr = inject(ChangeDetectorRef);
  route = inject(ActivatedRoute);
  router = inject(Router);

  products: any[] = [];
  categories: any[] = [];
  suppliers: any[] = [];
  searchTerm: string = '';
  filteredProducts: any[] = [];

  // Role variables
  role: string | null = null;
  isAdmin = false;
  isManager = false;

  // Modal state
  showModal = false;
  selectedProduct: any = null;
  mode: 'add' | 'edit' = 'add';

  // Low stock alerts
  lowStockProducts: any[] = [];
  suppliersMap: { [key: string]: any } = {};
  filterOutOfStock = false;

  ngOnInit() {
    // Role logic
    this.auth.role$.subscribe(role => {
      this.role = role;
      this.isAdmin = role === 'admin';
      this.isManager = role === 'manager';
    });

    // Check for filter query param
    this.route.queryParams.subscribe(params => {
      this.filterOutOfStock = params['filter'] === 'out-of-stock';
      if (params['search']) {
        this.searchTerm = params['search'];
      }
      if (this.products.length > 0) {
        this.applyFilter();
      }
    });

    // Load all data
    this.initializeData();
  }

  /** -------------------------------
   * INITIALIZE DATA
   --------------------------------*/
  initializeData() {
    this.categoryService.getCategories().subscribe({
      next: (categoriesData) => {
        this.categories = categoriesData;

        this.supplierService.getSuppliers().subscribe({
          next: (suppliersData) => {
            this.suppliers = suppliersData;
            this.loadProducts();
          },
          error: () => {
            this.loadProducts();
          }
        });
      },
      error: () => {
        this.supplierService.getSuppliers().subscribe({
          next: (suppliersData) => {
            this.suppliers = suppliersData;
            this.loadProducts();
          },
          error: () => {
            this.loadProducts();
          }
        });
      }
    });
  }

  /** -------------------------------
   * LOAD PRODUCTS
   --------------------------------*/
  loadProducts() {
    console.log('[Products] loadProducts() - Starting to load products...');
    this.productService.getProducts().subscribe({
      next: (data) => {
        console.log('[Products] loadProducts() - API Response received:', data);
        console.log('[Products] loadProducts() - Before update, products array length:', this.products.length);
        
        const categoriesMap: { [key: string]: string } = {};
        const suppliersMap: { [key: string]: string } = {};

        this.categories.forEach(cat => {
          if (cat.id && cat.name) categoriesMap[cat.id] = cat.name;
        });

        this.suppliers.forEach(sup => {
          if (sup.id && sup.name) suppliersMap[sup.id] = sup.name;
          if (sup.id) this.suppliersMap[sup.id] = sup; // Store full supplier object
        });

        this.products = (data || []).map((product: any) => ({
          ...product,
          categoryName: categoriesMap[product.categoryId] || '—',
          supplierName: suppliersMap[product.supplierId] || '—'
        }));

        console.log('[Products] loadProducts() - After mapping, products array length:', this.products.length);

        // Check for low stock products
        this.checkLowStock();

        this.products.sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
          if (a.createdAt) return -1;
          if (b.createdAt) return 1;
          return (a.name || '').localeCompare(b.name || '');
        });

        this.applyFilter();
        console.log('[Products] loadProducts() - Filter applied, filteredProducts length:', this.filteredProducts.length);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[Products] loadProducts() - Error loading products:', error);
        this.notifyService.push('Failed to load products', 'error');
      }
    });
  }

  /** -------------------------------
   * FILTER
   --------------------------------*/
  applyFilter() {
    console.log('[Products] applyFilter() - Search term:', this.searchTerm, 'Filter out of stock:', this.filterOutOfStock);
    console.log('[Products] applyFilter() - Before filter, products count:', this.products.length);
    
    let filtered = this.products;

    // Apply out-of-stock filter if query param exists
    if (this.filterOutOfStock) {
      filtered = filtered.filter(product => {
        const stock = Number(product.stockQuantity ?? 0);
        return stock === 0 || stock < 0;
      });
      console.log('[Products] applyFilter() - After out-of-stock filter, count:', filtered.length);
    }

    // Apply search term filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(term) ||
        product.categoryName?.toLowerCase().includes(term) ||
        product.supplierName?.toLowerCase().includes(term)
      );
      console.log('[Products] applyFilter() - After search filter, count:', filtered.length);
    }

    this.filteredProducts = filtered;
    console.log('[Products] applyFilter() - Final filteredProducts count:', this.filteredProducts.length);
    this.cdr.detectChanges();
  }

  /** -------------------------------
   * OPEN ADD PRODUCT
   --------------------------------*/
  openAddProduct() {
    if (!this.isAdmin) return;

    console.log('[Products] openAddProduct() - Opening add modal');
    this.mode = 'add';
    this.selectedProduct = null;
    this.showModal = true;
    console.log('[Products] openAddProduct() - Modal should be visible, showModal:', this.showModal);
  }

  /** -------------------------------
   * EDIT PRODUCT
   --------------------------------*/
  editProduct(product: any) {
    if (!this.isAdmin) return;

    console.log('[Products] editProduct() - Opening edit modal for product:', product.id, product.name);
    this.selectedProduct = { ...product };
    this.mode = 'edit';
    this.showModal = true;
    console.log('[Products] editProduct() - Modal should be visible, showModal:', this.showModal);
  }

  /** -------------------------------
   * CLOSE MODAL
   --------------------------------*/
  closeModal() {
    console.log('[Products] closeModal() - Closing modal, showModal was:', this.showModal);
    this.showModal = false;
    console.log('[Products] closeModal() - Modal closed, showModal is now:', this.showModal);
    this.cdr.detectChanges();
  }

  /** -------------------------------
   * SUBMIT FORM
   --------------------------------*/
  handleFormSubmit(data: any) {
    if (!this.isAdmin) return;

    console.log('[Products] handleFormSubmit() - Starting submit, mode:', this.mode);
    console.log('[Products] handleFormSubmit() - Data to save:', data);

    if (this.mode === 'add') {
      console.log('[Products] handleFormSubmit() - ADD mode - Calling API...');
      this.productService.addProduct(data).subscribe({
        next: (created) => {
          console.log('[Products] handleFormSubmit() - ADD - API Response received:', created);
          console.log('[Products] handleFormSubmit() - ADD - Before reload, products array length:', this.products.length);
          
          // Close modal first to give immediate feedback
          this.closeModal();
          console.log('[Products] handleFormSubmit() - ADD - Modal closed');
          
          // Reload products to get fresh data
          this.loadProducts();
          console.log('[Products] handleFormSubmit() - ADD - loadProducts() called');
          
          this.notifyService.push('Product added successfully', 'info');
        },
        error: (error) => {
          console.error('[Products] handleFormSubmit() - ADD - Error:', error);
          console.error('[Products] handleFormSubmit() - ADD - Error status:', error?.status);
          console.error('[Products] handleFormSubmit() - ADD - Error message:', error?.message);
          console.error('[Products] handleFormSubmit() - ADD - Error URL:', error?.url);
          console.error('[Products] handleFormSubmit() - ADD - Error details:', error?.error);
          
          // DO NOT close modal on error - let user see the error and retry
          // Modal stays open so user can fix and retry
          
          const errorMsg = error?.error?.message || error?.message || 'Unknown error';
          this.notifyService.push(`Failed to add product: ${errorMsg}`, 'error');
        }
      });
    } else if (this.mode === 'edit') {
      console.log('[Products] handleFormSubmit() - UPDATE mode - Calling API for ID:', this.selectedProduct.id);
      this.productService.updateProduct(this.selectedProduct.id, data).subscribe({
        next: (updated) => {
          console.log('[Products] handleFormSubmit() - UPDATE - API Response received:', updated);
          console.log('[Products] handleFormSubmit() - UPDATE - Before reload, products array length:', this.products.length);
          
          // Close modal first to give immediate feedback
          this.closeModal();
          console.log('[Products] handleFormSubmit() - UPDATE - Modal closed');
          
          // Reload products to get fresh data
          this.loadProducts();
          console.log('[Products] handleFormSubmit() - UPDATE - loadProducts() called');
          
          this.notifyService.push('Product updated successfully', 'info');
        },
        error: (error) => {
          console.error('[Products] handleFormSubmit() - UPDATE - Error:', error);
          console.error('[Products] handleFormSubmit() - UPDATE - Error status:', error?.status);
          console.error('[Products] handleFormSubmit() - UPDATE - Error message:', error?.message);
          console.error('[Products] handleFormSubmit() - UPDATE - Error URL:', error?.url);
          console.error('[Products] handleFormSubmit() - UPDATE - Error details:', error?.error);
          
          // DO NOT close modal on error - let user see the error and retry
          // Modal stays open so user can fix and retry
          
          const errorMsg = error?.error?.message || error?.message || 'Unknown error';
          this.notifyService.push(`Failed to update product: ${errorMsg}`, 'error');
        }
      });
    }
  }

  /** -------------------------------
   * DELETE PRODUCT
   --------------------------------*/
  deleteProduct(id: string) {
    if (!this.isAdmin) return;

    console.log('[Products] deleteProduct() - Requested delete for ID:', id);
    if (!confirm("Are you sure you want to delete this product?")) {
      console.log('[Products] deleteProduct() - User cancelled deletion');
      return;
    }
 
    console.log('[Products] deleteProduct() - Calling API to delete...');
    this.productService.deleteProduct(id).subscribe({
      next: (response) => {
        console.log('[Products] deleteProduct() - DELETE - API Response received:', response);
        // Reload products from backend to get fresh data
        this.loadProducts();
        this.notifyService.push('Product deleted successfully', 'info');
      },
      error: (error) => {
        console.error('[Products] deleteProduct() - Error:', error);
        console.error('[Products] deleteProduct() - Error status:', error?.status);
        console.error('[Products] deleteProduct() - Error details:', error?.error);
        const errorMsg = error?.error?.message || error?.error || error?.message || 'Unknown error';
        this.notifyService.push(`Failed to delete product: ${errorMsg}`, 'error');
      }
    });
  }

  /** -------------------------------
   * CHECK LOW STOCK
   --------------------------------*/
  checkLowStock() {
    this.lowStockProducts = this.products.filter(product => {
      const stock = Number(product.stockQuantity ?? 0);
      const threshold = Number(product.threshold ?? 10);
      return stock <= threshold;
    });

    // Update the alert service
    const alertProducts = this.lowStockProducts.map(product => {
      const supplier = this.suppliersMap[product.supplierId];
      return {
        id: product.id,
        name: product.name,
        stockQuantity: Number(product.stockQuantity ?? 0),
        threshold: Number(product.threshold ?? 10),
        supplierId: product.supplierId,
        supplierName: product.supplierName || supplier?.name,
        supplierEmail: supplier?.email
      };
    });

    this.lowStockAlertService.updateLowStockProducts(alertProducts);
  }

  /** -------------------------------
   * CHECK IF PRODUCT IS LOW STOCK
   --------------------------------*/
  isLowStock(product: any): boolean {
    const stock = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.threshold ?? 10);
    return stock <= threshold;
  }

  /** -------------------------------
   * GET STOCK STATUS
   --------------------------------*/
  getStockStatus(product: any): 'critical' | 'low' | 'ok' {
    const stock = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.threshold ?? 10);
    
    if (stock === 0) return 'critical';
    if (stock <= threshold) return 'low';
    return 'ok';
  }

  isExpired(product: any): boolean {
    if (!product.expiryDate) return false;
    const expiryDate = new Date(product.expiryDate);
    const now = new Date();
    return expiryDate < now;
  }

  /** -------------------------------
   * NOTIFY SUPPLIER VIA EMAIL
   --------------------------------*/
  notifySupplier(product: any) {
    const supplier = this.suppliersMap[product.supplierId];
    if (!supplier || !supplier.email) {
      alert('Supplier email not found. Please update supplier information.');
      return;
    }

    const stock = Number(product.stockQuantity ?? 0);
    const threshold = Number(product.threshold ?? 10);
    const suggestedRestock = Math.max(threshold * 2, 50); // Suggest 2x threshold or minimum 50

    // Get admin email from auth service
    const adminEmail = this.auth.user$.value?.email || 'admin@inventory.com';
    const adminName = adminEmail.split('@')[0] || 'Admin';

    // Create email subject
    const subject = encodeURIComponent(`Restock Request: ${product.name}`);

    // Create email body
    const body = encodeURIComponent(
      `Dear ${supplier.name || 'Supplier'},

We need to restock the following product:

Product Name: ${product.name}
Current Stock: ${stock} units
Threshold: ${threshold} units
Suggested Restock Quantity: ${suggestedRestock} units

Please arrange for the restock at your earliest convenience.

Best regards,
${adminName}
${adminEmail}`
    );

    // Open email client
    window.location.href = `mailto:${supplier.email}?subject=${subject}&body=${body}`;
  }
}
