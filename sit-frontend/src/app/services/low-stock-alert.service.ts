import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface LowStockProduct {
  id: string;
  name: string;
  stockQuantity: number;
  threshold: number;
  supplierId?: string;
  supplierName?: string;
  supplierEmail?: string;
}

@Injectable({ providedIn: 'root' })
export class LowStockAlertService {
  private lowStockProducts$ = new BehaviorSubject<LowStockProduct[]>([]);
  
  getLowStockProducts() {
    return this.lowStockProducts$.asObservable();
  }

  updateLowStockProducts(products: LowStockProduct[]) {
    this.lowStockProducts$.next(products);
  }

  getCurrentLowStockProducts(): LowStockProduct[] {
    return this.lowStockProducts$.value;
  }
}

