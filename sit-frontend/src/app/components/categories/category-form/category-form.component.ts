import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.css']
})
export class CategoryFormComponent implements OnInit, OnChanges {

  @Input() mode: 'add' | 'edit' = 'add';
  @Input() categoryData: any = null;   // FIXED: matches parent

  @Output() formSubmit = new EventEmitter<any>();
  @Output() formCancel = new EventEmitter<void>();

  private fb = inject(FormBuilder);

  categoryForm!: FormGroup;

  ngOnInit() {
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.categoryForm) return;

    // When switching to edit mode: fill the form
    if (this.mode === 'edit' && this.categoryData) {
      this.patchForm();
    }

    // When switching to add mode: empty the form
    if (this.mode === 'add') {
      this.initializeForm();
    }
  }

  initializeForm() {
    this.categoryForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });

    // Patch immediately if editing and data already exists
    if (this.mode === 'edit' && this.categoryData) {
      this.patchForm();
    }
  }

  patchForm() {
    if (this.categoryData && this.categoryForm) {
      this.categoryForm.patchValue({
        name: this.categoryData.name || '',
        description: this.categoryData.description || ''
      }, { emitEvent: false });
    }
  }

  submitForm() {
    if (!this.categoryForm.valid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const formValue = this.categoryForm.value;

    // Include ID when editing
    if (this.mode === 'edit' && this.categoryData?.id) {
      formValue.id = this.categoryData.id;
    }

    this.formSubmit.emit(formValue);
  }

  closeModal() {
    this.formCancel.emit();
  }
}
