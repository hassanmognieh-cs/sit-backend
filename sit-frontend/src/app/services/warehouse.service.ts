import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Warehouse {
  id?: string;
  name: string;
  city?: string;
  address: string;
  latitude: number;
  longitude: number;
  adminId?: string;
  createdBy?: string;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WarehouseService {

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private async getAuthHeaders(): Promise<{ [key: string]: string }> {
    const token = await this.authService.getFreshToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // GET ALL WAREHOUSES
  async getAllWarehouses(): Promise<Warehouse[]> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.get<Warehouse[]>(`${environment.apiBase}/api/warehouses`, { headers })
    );
  }

  // GET WAREHOUSE BY ID
  async getWarehouseById(id: string): Promise<Warehouse> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.get<Warehouse>(`${environment.apiBase}/api/warehouses/${id}`, { headers })
    );
  }

  // CREATE WAREHOUSE
  async createWarehouse(warehouse: Omit<Warehouse, 'id' | 'createdBy' | 'createdAt'>): Promise<{ id: string }> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.post<{ id: string }>(`${environment.apiBase}/api/warehouses`, warehouse, { headers })
    );
  }

  // UPDATE WAREHOUSE
  async updateWarehouse(id: string, warehouse: Omit<Warehouse, 'id' | 'createdBy' | 'createdAt'>): Promise<{ message: string }> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.put<{ message: string }>(`${environment.apiBase}/api/warehouses/${id}`, warehouse, { headers })
    );
  }

  // DELETE WAREHOUSE
  async deleteWarehouse(id: string): Promise<{ message: string }> {
    const headers = await this.getAuthHeaders();
    return await firstValueFrom(
      this.http.delete<{ message: string }>(`${environment.apiBase}/api/warehouses/${id}`, { headers })
    );
  }
}





