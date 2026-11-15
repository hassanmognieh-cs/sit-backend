export interface InventoryMovementItem {
  productId: string;
  productName?: string;
  quantity: number;
}

export interface InventoryMovementRequest {
  type: "IN" | "OUT";
  reason?: string;
  note?: string;
  createdBy?: string;

  items: InventoryMovementItem[];
}
