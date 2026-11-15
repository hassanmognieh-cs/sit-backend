export interface InventoryLog {
  id?: string;
  productId?: string;
  productName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  price: number;
  sellingPrice?: number;
  totalCost?: number | null;
  totalRevenue?: number | null;
  profit?: number | null;
  costPerItem?: number | null;
  reason: string;
  note?: string;
  createdBy?: string;
  createdAt?: Date | null;
}

