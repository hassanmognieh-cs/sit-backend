import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { RoleGuard } from './guards/role.guard';
import { AuthGuard } from './guards/auth.guard';
import { ProductComponent } from './components/products/products.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { SuppliersComponent } from './components/suppliers/suppliers.component';
import { ReportsComponent } from './components/reports/reports.component';
import { DashboardLayoutComponent } from './components/dashboard/dashboard-layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { StockMovementComponent } from './components/stock-movement/stock-movement.component';
import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { ChangePasswordComponent } from './components/change-password/change-password.component';
import { LogoutConfirmationComponent } from './components/logout-confirmation/logout-confirmation.component';


export const routes: Routes = [
  { path: '', component: WelcomeComponent },
  { path: 'login', component: LoginComponent },
  { 
    path: 'change-password', 
    component: ChangePasswordComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'logout-confirmation',
    component: LogoutConfirmationComponent,
    canActivate: [AuthGuard]
  },

  {
    path: 'dashboard',
    component: DashboardLayoutComponent,
    canActivate: [AuthGuard, RoleGuard],
    children: [
      {
        path: '',
        component: DashboardComponent
      },
      {
        path: 'products',
        component: ProductComponent,
        data: { roles: ['admin', 'superadmin', 'manager', 'employee'] }
      },
      {
        path: 'categories',
        component: CategoriesComponent,
        data: { roles: ['admin', 'superadmin', 'manager', 'employee'] }
      },
      {
        path: 'suppliers',
        component: SuppliersComponent,
        data: { roles: ['admin', 'superadmin', 'manager'] }
      },
      {
        path: 'reports',
        component: ReportsComponent,
        data: { roles: ['admin', 'superadmin', 'manager'] }
      },
      {
        path: 'stock-movement',
        component: StockMovementComponent,
        data: { roles: ['admin', 'superadmin', 'manager'] }
      },
      {
        path: 'history',
        loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent),
        data: { roles: ['admin', 'superadmin', 'manager'] }
      },
      {
        path: 'users',
        loadComponent: () => import('./components/users/users.component').then(m => m.UsersComponent),
        data: { roles: ['admin', 'superadmin'] }
      },
      {
        path: 'warehouses',
        loadComponent: () => import('./components/warehouses/warehouses.component').then(m => m.WarehousesComponent),
        data: { roles: ['superadmin'] }
      },
      {
        path: 'warehouses/map',
        loadComponent: () => import('./components/warehouses/warehouse-map.component').then(m => m.WarehouseMapComponent),
        data: { roles: ['superadmin'] }
      },
      {
        path: 'profile',
        loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
        data: { roles: ['admin', 'superadmin', 'manager', 'employee'] }
      },
      {
        path: 'tasks',
        loadComponent: () => import('./components/tasks/manager-tasks.component').then(m => m.ManagerTasksComponent),
        data: { roles: ['manager'] }
      },
      {
        path: 'my-tasks',
        loadComponent: () => import('./components/tasks/employee-tasks.component').then(m => m.EmployeeTasksComponent),
        data: { roles: ['employee'] }
      },
      {
        path: 'task-history',
        loadComponent: () => import('./components/tasks/task-history.component').then(m => m.TaskHistoryComponent),
        data: { roles: ['admin', 'superadmin'] }
      },
      {
        path: 'chatbot',
        component: ChatbotComponent,
        data: { roles: ['admin', 'superadmin', 'manager', 'employee'] }
      }

    ]
  },

  { path: 'logout', redirectTo: '/login' }
];
