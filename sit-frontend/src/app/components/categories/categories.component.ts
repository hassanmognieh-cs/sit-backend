import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { CategoryFormComponent } from './category-form/category-form.component';
import { AuthService } from '../../services/auth.service';
import { NotifyService } from '../../services/notify.service';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryFormComponent],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css'
})
export class CategoriesComponent implements OnInit {
  
  auth = inject(AuthService);
  categoryService = inject(CategoryService);
  notifyService = inject(NotifyService);
  private cdr = inject(ChangeDetectorRef);

  categories: any[] = [];
  searchTerm: string = '';
  filteredCategories: any[] = [];

  // Role variables
  role: string | null = null;
  isAdmin = false;
  isManager = false;

  // Modal state
  showModal = false;
  selectedCategory: any = null;
  mode: 'add' | 'edit' = 'add';

  ngOnInit() {

    // Subscribe to role
    this.auth.role$.subscribe(role => {
      this.role = role;
      this.isAdmin = role === 'admin';
      this.isManager = role === 'manager';
    });

    this.loadCategories();
  }

  /** -------------------------------
   * LOAD CATEGORIES
   --------------------------------*/
  loadCategories() {
    console.log('[Categories] loadCategories() - Starting to load categories...');
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        console.log('[Categories] loadCategories() - API Response received:', data);
        console.log('[Categories] loadCategories() - Before update, categories array length:', this.categories.length);
        this.categories = data || [];
        console.log('[Categories] loadCategories() - After update, categories array length:', this.categories.length);
        this.applyFilter();
        console.log('[Categories] loadCategories() - Filter applied, filteredCategories length:', this.filteredCategories.length);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[Categories] loadCategories() - Error loading categories:', error);
        this.notifyService.push('Failed to load categories', 'error');
      }
    });
  }

  /** -------------------------------
   * APPLY FILTER
   --------------------------------*/
  applyFilter() {
    console.log('[Categories] applyFilter() - Search term:', this.searchTerm);
    console.log('[Categories] applyFilter() - Before filter, categories count:', this.categories.length);
    
    if (!this.searchTerm) {
      this.filteredCategories = this.categories;
      console.log('[Categories] applyFilter() - No search term, showing all categories');
      this.cdr.detectChanges();
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredCategories = this.categories.filter(cat =>
      cat.name?.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term)
    );
    console.log('[Categories] applyFilter() - After filter, filteredCategories count:', this.filteredCategories.length);
    this.cdr.detectChanges();
  }

  /** -------------------------------
   * OPEN ADD CATEGORY (Admin only)
   --------------------------------*/
  openAddCategory() {
    if (!this.isAdmin) return;

    console.log('[Categories] openAddCategory() - Opening add modal');
    this.selectedCategory = null;
    this.mode = 'add';
    this.showModal = true;
    console.log('[Categories] openAddCategory() - Modal should be visible, showModal:', this.showModal);
  }

  /** -------------------------------
   * EDIT CATEGORY (Admin only)
   --------------------------------*/
  editCategory(category: any) {
    if (!this.isAdmin) return;

    console.log('[Categories] editCategory() - Opening edit modal for category:', category.id, category.name);
    this.selectedCategory = { ...category };
    this.mode = 'edit';
    this.showModal = true;
    console.log('[Categories] editCategory() - Modal should be visible, showModal:', this.showModal);
  }

  /** -------------------------------
   * CLOSE MODAL
   --------------------------------*/
  closeModal() {
    console.log('[Categories] closeModal() - Closing modal, showModal was:', this.showModal);
    this.showModal = false;
    console.log('[Categories] closeModal() - Modal closed, showModal is now:', this.showModal);
    this.cdr.detectChanges();
  }

  /** -------------------------------
   * HANDLE FORM SUBMIT (Admin only)
   --------------------------------*/
  handleFormSubmit(data: any) {
    if (!this.isAdmin) return;

    console.log('[Categories] handleFormSubmit() - Starting submit, mode:', this.mode);
    console.log('[Categories] handleFormSubmit() - Data to save:', data);

    if (this.mode === 'add') {
      console.log('[Categories] handleFormSubmit() - ADD mode - Calling API...');
      this.categoryService.addCategory(data).subscribe({
        next: (created) => {
          console.log('[Categories] handleFormSubmit() - ADD - API Response received:', created);
          console.log('[Categories] handleFormSubmit() - ADD - Before reload, categories array length:', this.categories.length);
          
          // Close modal first to give immediate feedback
          this.closeModal();
          console.log('[Categories] handleFormSubmit() - ADD - Modal closed');
          
          // Reload categories to get fresh data
          this.loadCategories();
          console.log('[Categories] handleFormSubmit() - ADD - loadCategories() called');
          
          this.notifyService.push('Category added successfully', 'info');
        },
        error: (error) => {
          console.error('[Categories] handleFormSubmit() - ADD - Error:', error);
          console.error('[Categories] handleFormSubmit() - ADD - Error status:', error?.status);
          console.error('[Categories] handleFormSubmit() - ADD - Error message:', error?.message);
          console.error('[Categories] handleFormSubmit() - ADD - Error URL:', error?.url);
          console.error('[Categories] handleFormSubmit() - ADD - Error details:', error?.error);
          
          // DO NOT close modal on error - let user see the error and retry
          // Modal stays open so user can fix and retry
          
          const errorMsg = error?.error?.message || error?.message || 'Unknown error';
          this.notifyService.push(`Failed to add category: ${errorMsg}`, 'error');
        }
      });
    } else {
      console.log('[Categories] handleFormSubmit() - UPDATE mode - Calling API for ID:', this.selectedCategory.id);
      this.categoryService.updateCategory(this.selectedCategory.id, data).subscribe({
        next: (updated) => {
          console.log('[Categories] handleFormSubmit() - UPDATE - API Response received:', updated);
          console.log('[Categories] handleFormSubmit() - UPDATE - Before reload, categories array length:', this.categories.length);
          
          // Close modal first to give immediate feedback
          this.closeModal();
          console.log('[Categories] handleFormSubmit() - UPDATE - Modal closed');
          
          // Reload categories to get fresh data
          this.loadCategories();
          console.log('[Categories] handleFormSubmit() - UPDATE - loadCategories() called');
          
          this.notifyService.push('Category updated successfully', 'info');
        },
        error: (error) => {
          console.error('[Categories] handleFormSubmit() - UPDATE - Error:', error);
          console.error('[Categories] handleFormSubmit() - UPDATE - Error status:', error?.status);
          console.error('[Categories] handleFormSubmit() - UPDATE - Error message:', error?.message);
          console.error('[Categories] handleFormSubmit() - UPDATE - Error URL:', error?.url);
          console.error('[Categories] handleFormSubmit() - UPDATE - Error details:', error?.error);
          
          // DO NOT close modal on error - let user see the error and retry
          // Modal stays open so user can fix and retry
          
          const errorMsg = error?.error?.message || error?.message || 'Unknown error';
          this.notifyService.push(`Failed to update category: ${errorMsg}`, 'error');
        }
      });
    }
  }

  /** -------------------------------
   * DELETE CATEGORY (Admin only)
   --------------------------------*/
  deleteCategory(id: string) {
    if (!this.isAdmin) return;

    console.log('[Categories] deleteCategory() - Requested delete for ID:', id);
    if (!confirm("Are you sure you want to delete this category?")) {
      console.log('[Categories] deleteCategory() - User cancelled deletion');
      return;
    }

    console.log('[Categories] deleteCategory() - Calling API to delete...');
    this.categoryService.deleteCategory(id).subscribe({
      next: (response) => {
        console.log('[Categories] deleteCategory() - DELETE - API Response received:', response);
        // Reload categories from backend to get fresh data
        this.loadCategories();
        this.notifyService.push('Category deleted successfully', 'info');
      },
      error: (err) => {
        console.error('[Categories] deleteCategory() - Error:', err);
        console.error('[Categories] deleteCategory() - Error status:', err?.status);
        console.error('[Categories] deleteCategory() - Error details:', err?.error);
        const errorMsg = err?.error?.message || err?.error || err?.message || 'Unknown error';
        this.notifyService.push(`Failed to delete category: ${errorMsg}`, 'error');
      }
    });
  }
}
