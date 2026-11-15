import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../services/supplier.service';
import { AuthService } from '../../services/auth.service';

import * as bootstrap from "bootstrap";   // ✅ Bootstrap JS (no types)
                                           // modal declared as "any"

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css'
})
export class SuppliersComponent implements OnInit {

  auth = inject(AuthService);
  supplierService = inject(SupplierService);
  private cdr = inject(ChangeDetectorRef);

  suppliers: any[] = [];
  filteredSuppliers: any[] = [];
  searchTerm = '';

  mode: 'add' | 'edit' = 'add';

  selectedSupplier: any = {
    name: '',
    email: '',
    phone: '',
    address: '',
    description: ''
  };

  isAdmin = false;

  modal: any;   // ✅ Bootstrap modal (NO TYPE ERROR)

  ngOnInit() {
    this.auth.role$.subscribe(role => {
      this.isAdmin = role === 'admin';
    });

    this.loadSuppliers();

    // Modal instance will be created when HTML is rendered
    setTimeout(() => {
      const modalElement = document.getElementById('supplierModal');
      if (modalElement) {
        this.modal = new bootstrap.Modal(modalElement);
      }
    }, 300);
  }

  // ---------------------------
  // LOAD SUPPLIERS
  // ---------------------------
  loadSuppliers() {
    console.log('[SuppliersComponent] loadSuppliers() - Starting to load suppliers...');
    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        console.log('[SuppliersComponent] loadSuppliers() - Received data:', data);
        this.suppliers = data || [];
        this.applyFilter();
        this.cdr.detectChanges(); // Force change detection
        console.log('[SuppliersComponent] loadSuppliers() - Suppliers loaded, count:', this.suppliers.length);
      },
      error: (error) => {
        console.error('[SuppliersComponent] loadSuppliers() - Error loading suppliers:', error);
      }
    });
  }

  // ---------------------------
  // SEARCH FILTER
  // ---------------------------
  applyFilter() {
    const t = this.searchTerm.toLowerCase();
    this.filteredSuppliers = this.suppliers.filter(s =>
      s.name?.toLowerCase().includes(t) ||
      s.email?.toLowerCase().includes(t) ||
      s.address?.toLowerCase().includes(t) ||
      s.phone?.toLowerCase().includes(t) ||
      s.description?.toLowerCase().includes(t)
    );
  }

  // ---------------------------
  // OPEN ADD FORM
  // ---------------------------
  openAddSupplier() {
    this.mode = 'add';
    this.selectedSupplier = {
      name: '',
      email: '',
      phone: '',
      address: '',
      description: ''
    };

    this.modal.show();   // ✅ open modal
  }

  // ---------------------------
  // OPEN EDIT FORM
  // ---------------------------
  editSupplier(s: any) {
    this.mode = 'edit';
    this.selectedSupplier = { ...s };
    this.modal.show();   // ✅ open modal
  }

  // ---------------------------
  // CLOSE MODAL
  // ---------------------------
  closeModal() {
    // Use both methods to ensure modal closes
    if (this.modal) {
      this.modal.hide();
    }
    // Also use Bootstrap's dismiss method as backup
    const modalElement = document.getElementById('supplierModal');
    if (modalElement) {
      const bsModal = bootstrap.Modal.getInstance(modalElement);
      if (bsModal) {
        bsModal.hide();
      }
      // Remove backdrop if it exists
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
      // Remove modal-open class from body
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }

  // ---------------------------
  // SAVE SUPPLIER (ADD + EDIT)
  // ---------------------------
  saveSupplier() {

    const data = { 
      name: this.selectedSupplier.name,
      email: this.selectedSupplier.email,
      phone: this.selectedSupplier.phone,
      address: this.selectedSupplier.address,
      description: this.selectedSupplier.description
    };

    /** -------------------------
     * ADD SUPPLIER
     ------------------------- */
    if (this.mode === 'add') {
      console.log('[SuppliersComponent] saveSupplier() - Adding supplier:', data);
      this.supplierService.addSupplier(data).subscribe({
        next: (created) => {
          console.log('[SuppliersComponent] saveSupplier() - Supplier added successfully:', created);
          // Close modal immediately
          this.closeModal();
          // Small delay to ensure modal backdrop is removed
          setTimeout(() => {
            // Reload suppliers list to get fresh data
            this.loadSuppliers();
          }, 200);
        },
        error: (error) => {
          console.error('[SuppliersComponent] saveSupplier() - Error adding supplier:', error);
          console.error('[SuppliersComponent] saveSupplier() - Error status:', error?.status);
          console.error('[SuppliersComponent] saveSupplier() - Error message:', error?.message);
          console.error('[SuppliersComponent] saveSupplier() - Error details:', error?.error);
          
          const errorMsg = error?.error?.message || error?.error || error?.message || 'Unknown error';
          alert(`Failed to add supplier: ${errorMsg}`);
        }
      });
    }

    /** -------------------------
     * UPDATE SUPPLIER
     ------------------------- */
    else {
      console.log('[SuppliersComponent] saveSupplier() - Updating supplier ID:', this.selectedSupplier.id, 'with data:', data);
      
      // Ensure we have an ID
      if (!this.selectedSupplier.id) {
        alert('Error: Supplier ID is missing. Please try again.');
        return;
      }
      
      this.supplierService.updateSupplier(this.selectedSupplier.id, data).subscribe({
        next: (response) => {
          console.log('[SuppliersComponent] saveSupplier() - Supplier updated successfully. Response:', response);
          // Close modal immediately
          this.closeModal();
          // Small delay to ensure modal backdrop is removed
          setTimeout(() => {
            // Reload suppliers list to get fresh data
            this.loadSuppliers();
          }, 200);
        },
        error: (error) => {
          console.error('[SuppliersComponent] saveSupplier() - Full error object:', error);
          console.error('[SuppliersComponent] saveSupplier() - Error status:', error?.status);
          console.error('[SuppliersComponent] saveSupplier() - Error statusText:', error?.statusText);
          console.error('[SuppliersComponent] saveSupplier() - Error message:', error?.message);
          console.error('[SuppliersComponent] saveSupplier() - Error URL:', error?.url);
          console.error('[SuppliersComponent] saveSupplier() - Error error:', error?.error);
          
          // Try to extract the actual error message
          let errorMsg = 'Unknown error';
          if (error?.error) {
            if (typeof error.error === 'string') {
              errorMsg = error.error;
            } else if (error.error?.message) {
              errorMsg = error.error.message;
            } else if (error.error?.title) {
              errorMsg = error.error.title;
            }
          } else if (error?.message) {
            errorMsg = error.message;
          }
          
          alert(`Failed to update supplier:\n\n${errorMsg}\n\nStatus: ${error?.status || 'N/A'}`);
        }
      });
    }
  }

  // ---------------------------
  // DELETE SUPPLIER
  // ---------------------------
  deleteSupplier(id: string) {
    if (!confirm("Are you sure you want to delete this supplier?")) return;

    console.log('[SuppliersComponent] deleteSupplier() - Deleting supplier ID:', id);
    this.supplierService.deleteSupplier(id).subscribe({
      next: (response) => {
        console.log('[SuppliersComponent] deleteSupplier() - Supplier deleted successfully. Response:', response);
        // Reload suppliers list to get fresh data from backend
        this.loadSuppliers();
      },
      error: (error) => {
        console.error('[SuppliersComponent] deleteSupplier() - Error deleting supplier:', error);
        alert('Failed to delete supplier. Please try again.');
      }
    });
  }
}
