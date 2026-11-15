import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CategoryService } from '../../../services/category.service';
import { SupplierService } from '../../../services/supplier.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.css'
})
export class ProductFormComponent implements OnInit, OnChanges {
  
  @Input() mode: 'add' | 'edit' = 'add';
  @Input() productData: any = null;
  
  @Output() formSubmit = new EventEmitter<any>();
  @Output() formCancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private supplierService = inject(SupplierService);

  productForm!: FormGroup;
  categories: any[] = [];
  suppliers: any[] = [];

  ngOnInit() {
    this.initializeForm();
    this.loadCategories();
    this.loadSuppliers();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.productForm) return;

    // When switching to edit mode: fill the form
    if (this.mode === 'edit' && this.productData) {
      this.patchForm();
    }

    // When switching to add mode: empty the form
    if (this.mode === 'add') {
      this.initializeForm();
    }
  }

  initializeForm() {
    this.productForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      price: [0, [Validators.required, Validators.min(0)]],
      sellingPrice: [null],
      stockQuantity: [0, [Validators.required, Validators.min(0)]],
      threshold: [0, [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      supplierId: ['', Validators.required],
      expiryDate: ['']
    });

    // Patch immediately if editing and data already exists
    if (this.mode === 'edit' && this.productData) {
      this.patchForm();
    }
  }

  loadCategories() {
    this.categoryService.getCategories().subscribe({
      next: (data) => {
        this.categories = data;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      }
    });
  }

  loadSuppliers() {
    this.supplierService.getSuppliers().subscribe({
      next: (data) => {
        this.suppliers = data;
      },
      error: (error) => {
        console.error('Error loading suppliers:', error);
      }
    });
  }

  patchForm() {
    if (this.productData && this.productForm) {
      this.productForm.patchValue({
        name: this.productData.name || '',
        description: this.productData.description || '',
        price: this.productData.price || 0,
        sellingPrice: this.productData.sellingPrice || null,
        stockQuantity: this.productData.stockQuantity || 0,
        threshold: this.productData.threshold || 0,
        categoryId: this.productData.categoryId || '',
        supplierId: this.productData.supplierId || '',
        expiryDate: this.productData.expiryDate || ''
      }, { emitEvent: false });
    }
  }

  submitForm() {
    if (!this.productForm.valid) {
      this.productForm.markAllAsTouched();
      return;
    }

    const formValue = { ...this.productForm.value };

    // Convert empty expiryDate string to null
    if (formValue.expiryDate === '' || formValue.expiryDate === null) {
      formValue.expiryDate = null;
    } else if (formValue.expiryDate) {
      // Convert date string to ISO format
      formValue.expiryDate = new Date(formValue.expiryDate).toISOString();
    }

    // Convert empty sellingPrice to null
    if (formValue.sellingPrice === '' || formValue.sellingPrice === null || formValue.sellingPrice === undefined) {
      formValue.sellingPrice = null;
    }

    // Ensure numeric fields are numbers
    formValue.price = Number(formValue.price) || 0;
    formValue.stockQuantity = Number(formValue.stockQuantity) || 0;
    formValue.threshold = Number(formValue.threshold) || 0;
    if (formValue.sellingPrice !== null) {
      formValue.sellingPrice = Number(formValue.sellingPrice);
    }

    // Include ID when editing
    if (this.mode === 'edit' && this.productData?.id) {
      formValue.id = this.productData.id;
    }

    console.log('[ProductForm] Submitting form data:', formValue);
    this.formSubmit.emit(formValue);
  }

  closeModal() {
    this.formCancel.emit();
  }
}

