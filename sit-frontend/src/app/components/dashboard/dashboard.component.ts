import { Component, OnInit, AfterViewInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { ProductService } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplierService } from '../../services/supplier.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/users.service';
import { LowStockAlertService } from '../../services/low-stock-alert.service';
import { InventoryLog } from '../../models/inventory-log';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private supplierService = inject(SupplierService);
  private auth = inject(AuthService);
  private userService = inject(UserService);
  private lowStockAlertService = inject(LowStockAlertService);
  private http = inject(HttpClient);
  private router = inject(Router);

  @ViewChild('employeeInventoryChart') employeeInventoryChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('overviewChart') overviewChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartRef?: ElementRef<HTMLCanvasElement>;

  // Role flags
  role: string | null = null;
  isAdmin = false;
  isManager = false;
  isEmployee = false;

  // Dashboard stats
  totalProducts = 0;
  totalCategories = 0;
  totalSuppliers = 0;
  totalUsers = 0;
  totalEmployees = 0;
  totalManagers = 0;
  lowStockCount = 0;
  outOfStockCount = 0;
  expiredProductsCount = 0;
  expiringSoonCount = 0;
  totalStockValue = 0;
  totalStockQuantity = 0;

  // Lists for modals
  lowStockProducts: any[] = [];
  expiredProducts: any[] = [];
  expiringSoonProducts: any[] = [];
  outOfStockProducts: any[] = [];

  // Chart (optional)
  chartLabels: string[] = [];
  chartData: number[] = [];
  maxCategoryCount = 0;
  private employeeChart?: Chart;
  private overviewChartInstance?: Chart;

  // Low stock table filter
  tableFilter: 'lowStock' | 'expiringSoon' = 'lowStock';

  // Modal state
  activeModal: 'lowStock' | 'expired' | 'expiringSoon' | 'outOfStock' | null = null;

  // Alert messages panel
  showAlertsPanel = false;
  alertMessages: any[] = [];
  private lowStockSubscription?: Subscription;

  // New dashboard sections
  expiringProducts: any[] = [];
  recentActivity: InventoryLog[] = [];
  categoryStockData: { name: string; stock: number }[] = [];
  private categoryChartInstance?: Chart;
  private themeObserver?: MutationObserver;

  ngAfterViewInit() {
    this.themeObserver = this.watchThemeChanges();
  }


  // --------------------------------------------------------
  // INIT + LOAD DATA
  // --------------------------------------------------------
  ngOnInit() {
    this.auth.role$.subscribe(role => {
      this.role = role;
      this.isAdmin = role === 'admin';
      this.isManager = role === 'manager';
      this.isEmployee = role === 'employee';
    });

    this.loadDashboardData();
    
    // Subscribe to low stock alerts updates
    this.lowStockSubscription = this.lowStockAlertService.getLowStockProducts().subscribe(() => {
      this.updateAlertMessages();
    });
  }

  ngOnDestroy() {
    this.lowStockSubscription?.unsubscribe();
    this.categoryChartInstance?.destroy();
    this.themeObserver?.disconnect();
  }


  async loadDashboardData() {
    try {
      const [products, categories, suppliers] = await Promise.all([
        firstValueFrom(this.productService.getProducts()).catch(() => []),
        firstValueFrom(this.categoryService.getCategories()).catch(() => []),
        firstValueFrom(this.supplierService.getSuppliers()).catch(() => [])
      ]);

      this.totalProducts = products.length;
      this.totalCategories = categories.length;
      this.totalSuppliers = suppliers.length;

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const categoriesMap: Record<string, string> = {};
      categories.forEach((cat: any) => {
        if (cat.id && cat.name) categoriesMap[cat.id] = cat.name;
      });

      const suppliersMap: Record<string, any> = {};
      suppliers.forEach((sup: any) => {
        if (sup.id) suppliersMap[sup.id] = sup;
      });

      // Low stock
      this.lowStockProducts = products
        .filter((p: any) => p.stockQuantity <= p.threshold && p.stockQuantity > 0)
        .map((p: any) => {
          const supplier = suppliersMap[p.supplierId];
          return {
            ...p,
            categoryName: categoriesMap[p.categoryId] || '—',
            supplierEmail: supplier?.email || null,
            supplierName: supplier?.name || '—'
          };
        });
      this.lowStockCount = this.lowStockProducts.length;

      // Out of stock
      this.outOfStockProducts = products
        .filter((p: any) => p.stockQuantity === 0 || p.stockQuantity < 0)
        .map((p: any) => {
          const supplier = suppliersMap[p.supplierId];
          return {
            ...p,
            categoryName: categoriesMap[p.categoryId] || '—',
            supplierEmail: supplier?.email || null,
            supplierName: supplier?.name || '—'
          };
        });
      this.outOfStockCount = this.outOfStockProducts.length;

      // Expired
      this.expiredProducts = products
        .filter((p: any) => p.expiryDate && new Date(p.expiryDate) < now)
        .map((p: any) => {
          const supplier = suppliersMap[p.supplierId];
          return {
            ...p,
            categoryName: categoriesMap[p.categoryId] || '—',
            supplierEmail: supplier?.email || null,
            supplierName: supplier?.name || '—'
          };
        });
      this.expiredProductsCount = this.expiredProducts.length;

      // Expiring soon
      this.expiringSoonProducts = products
        .filter((p: any) => {
          if (!p.expiryDate) return false;
          const exp = new Date(p.expiryDate);
          return exp >= now && exp <= sevenDaysFromNow;
        })
        .map((p: any) => ({
          ...p,
          categoryName: categoriesMap[p.categoryId] || '—'
        }));
      this.expiringSoonCount = this.expiringSoonProducts.length;

      // Total stock value
      this.totalStockValue = products.reduce((sum: number, p: any) =>
        sum + ((p.price || 0) * (p.stockQuantity || 0)), 0
      );

      // Total stock quantity
      this.totalStockQuantity = products.reduce((sum: number, p: any) =>
        sum + (p.stockQuantity || 0), 0
      );

      // Load user counts
      await this.loadUserCounts();

      // Build simple category distribution for chart
      const categoryCounts: Record<string, number> = {};
      products.forEach((p: any) => {
        const name = categoriesMap[p.categoryId] || 'Uncategorized';
        categoryCounts[name] = (categoryCounts[name] || 0) + 1;
      });

      this.chartLabels = Object.keys(categoryCounts);
      this.chartData = this.chartLabels.map(label => categoryCounts[label]);
      this.maxCategoryCount = this.chartData.length
        ? Math.max(...this.chartData)
        : 0;

      // Derive expiry timeline from products already fetched
      this.expiringProducts = products
        .filter((p: any) => p.expiryDate != null)
        .map((p: any) => ({
          ...p,
          categoryName: categoriesMap[p.categoryId] || '—',
          supplierName: suppliersMap[p.supplierId]?.name || '—'
        }))
        .sort((a: any, b: any) => {
          const dateA = a.expiryDate?.toDate ? a.expiryDate.toDate() : new Date(a.expiryDate);
          const dateB = b.expiryDate?.toDate ? b.expiryDate.toDate() : new Date(b.expiryDate);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 6);

      // Derive stock-by-category from products already fetched
      const categoryStock: Record<string, number> = {};
      products.forEach((p: any) => {
        const catName = categoriesMap[p.categoryId] || 'Uncategorized';
        categoryStock[catName] = (categoryStock[catName] || 0) + (p.stockQuantity || 0);
      });
      this.categoryStockData = Object.entries(categoryStock)
        .map(([name, stock]) => ({ name, stock }))
        .sort((a, b) => b.stock - a.stock);

      // Fetch recent activity from inventory logs API
      this.loadRecentActivity();

      // After data is ready, (re)initialize employee chart
      this.initEmployeeChart();

      // Initialize overview chart after all data is loaded and view is ready
      setTimeout(() => this.initOverviewChart(), 100);

      // Initialize category bar chart
      setTimeout(() => this.initCategoryChart(), 150);

      // Update alert messages
      this.updateAlertMessages();

    } catch (err) {
      console.error('Dashboard loading error:', err);
    }
  }

  private initEmployeeChart() {
    if (this.role !== 'employee') return;
    if (!this.employeeInventoryChart) return;

    const ctx = this.employeeInventoryChart.nativeElement;

    // Destroy existing chart if it exists
    if (this.employeeChart) {
      this.employeeChart.destroy();
    }

    this.employeeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Products', 'Categories', 'Low Stock'],
        datasets: [{
          data: [
            this.totalProducts || 0,
            this.totalCategories || 0,
            this.lowStockCount || 0
          ],
          backgroundColor: ['#1E40AF', '#0EA5E9', '#F59E0B'],
          borderWidth: 0
        }]
      },
      options: {
        cutout: '65%',
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#b5c5ff',
              font: { 
                size: 11
              },
              padding: 8,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: 'rgba(8, 19, 38, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#b5c5ff',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8
          }
        }
      }
    });
  }


  // --------------------------------------------------------
  // CARD CLICK HANDLER
  // --------------------------------------------------------
  onCardClick(type: string) {
    switch (type) {
      case 'products': 
        this.router.navigate(['/dashboard/products']); 
        break;
      case 'categories': 
        this.router.navigate(['/dashboard/categories']); 
        break;
      case 'suppliers': 
        this.router.navigate(['/dashboard/suppliers']); 
        break;
      case 'reports': 
        this.router.navigate(['/dashboard/reports']); 
        break;
      case 'history': 
        this.router.navigate(['/dashboard/history']); 
        break;
      case 'stockMovement': 
        this.router.navigate(['/dashboard/stock-movement']); 
        break;
      case 'chatbot': 
        this.router.navigate(['/dashboard/chatbot']); 
        break;
      case 'users': 
        this.router.navigate(['/dashboard/users']); 
        break;
      case 'outOfStock': 
        this.activeModal = 'outOfStock'; 
        break;
      case 'lowStock': 
        this.activeModal = 'lowStock'; 
        break;
      case 'expired': 
        this.activeModal = 'expired'; 
        break;
      case 'expiringSoon': 
        this.activeModal = 'expiringSoon'; 
        break;
    }
  }

  closeModal() {
    this.activeModal = null;
  }

  goToProducts() {
    this.router.navigate(['/dashboard/products']);
    this.closeModal();
  }

  goToProfile() {
    this.router.navigate(['/dashboard/profile']);
  }

  async loadUserCounts() {
    try {
      const users = await firstValueFrom(this.userService.getAllUsers());
      this.totalUsers = users.length;
      
      // Check for role field (could be 'role' or 'roles' array)
      this.totalEmployees = users.filter((u: any) => {
        const role = u.role || (Array.isArray(u.roles) ? u.roles[0] : null);
        return role === 'employee' || role === 'Employee';
      }).length;
      
      this.totalManagers = users.filter((u: any) => {
        const role = u.role || (Array.isArray(u.roles) ? u.roles[0] : null);
        return role === 'manager' || role === 'Manager';
      }).length;
      
      console.log('User counts loaded:', {
        total: this.totalUsers,
        employees: this.totalEmployees,
        managers: this.totalManagers,
        sampleUser: users[0] // Debug: show first user structure
      });
    } catch (err) {
      console.error('Error loading user counts:', err);
      // Set defaults on error
      this.totalEmployees = 0;
      this.totalManagers = 0;
    }
  }

  private initOverviewChart() {
    if (!this.overviewChart) {
      setTimeout(() => this.initOverviewChart(), 100);
      return;
    }

    const ctx = this.overviewChart.nativeElement;

    if (this.overviewChartInstance) {
      this.overviewChartInstance.destroy();
    }

    let labels: string[] = [];
    let realData: number[] = [];
    let colors: string[] = [];

    if (this.isAdmin) {
      labels = ['Employees', 'Managers', 'Categories', 'Suppliers'];
      realData = [
        this.totalEmployees || 0,
        this.totalManagers || 0,
        this.totalCategories || 0,
        this.totalSuppliers || 0
      ];
      colors = ['#00D4FF', '#A855F7', '#10B981', '#FB923C'];
    } else if (this.isManager) {
      labels = ['Employees', 'Categories', 'Suppliers'];
      realData = [
        this.totalEmployees || 0,
        this.totalCategories || 0,
        this.totalSuppliers || 0
      ];
      colors = ['#00D4FF', '#10B981', '#FB923C'];
    } else if (this.isEmployee) {
      labels = ['Products', 'Categories'];
      realData = [
        this.totalProducts || 0,
        this.totalCategories || 0
      ];
      colors = ['#00D4FF', '#10B981'];
    } else {
      labels = ['Employees', 'Managers', 'Categories', 'Suppliers'];
      realData = [
        this.totalEmployees || 0,
        this.totalManagers || 0,
        this.totalCategories || 0,
        this.totalSuppliers || 0
      ];
      colors = ['#00D4FF', '#A855F7', '#10B981', '#FB923C'];
    }

    const displayData = realData.map(val => val === 0 ? 0.5 : val);

    const legendColor = this.getLegendColor();
    const theme = document.documentElement.getAttribute('data-theme');
    const tooltipBg = theme === 'light' ? 'rgba(15,23,42,0.9)' : 'rgba(10,14,26,0.95)';

    this.overviewChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: displayData,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        cutout: '65%',
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: legendColor,
              font: { size: 12 },
              padding: 16,
              usePointStyle: true,
              pointStyle: 'rectRounded',
              pointStyleWidth: 10,
              filter: () => true,
              generateLabels: (chart) => {
                const chartData = chart.data;
                if (chartData.labels && chartData.datasets && chartData.datasets.length > 0) {
                  const dataset = chartData.datasets[0];
                  const bgColors = Array.isArray(dataset.backgroundColor)
                    ? dataset.backgroundColor
                    : [];
                  return chartData.labels.map((label, i) => {
                    const value = realData[i];
                    const backgroundColor = (typeof bgColors[i] === 'string' ? bgColors[i] : '#999') as string;
                    return {
                      text: `${label}: ${value}`,
                      fillStyle: backgroundColor,
                      strokeStyle: 'transparent',
                      fontColor: legendColor,
                      lineWidth: 0,
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: '#ffffff',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const val = realData[context.dataIndex];
                return ` ${context.label}: ${val}`;
              }
            }
          }
        }
      }
    });
  }

  private getLegendColor(): string {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? '#F1F5F9'
      : '#1C2333';
  }

  private watchThemeChanges(): MutationObserver {
    const observer = new MutationObserver(() => {
      if (this.overviewChartInstance) {
        const color = this.getLegendColor();
        const legend = (this.overviewChartInstance.options as any).plugins?.legend;
        if (legend?.labels) {
          legend.labels.color = color;
        }
        this.overviewChartInstance.update();
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return observer;
  }

  goToChatbot() {
    this.router.navigate(['/dashboard/chatbot']);
  }

  get filteredLowStockProducts() {
    if (this.tableFilter === 'expiringSoon') {
      return this.expiringSoonProducts;
    }
    return this.lowStockProducts;
  }

  onTableFilterChange() {
    // Filter change is handled by the getter
  }

  updateAlertMessages() {
    this.alertMessages = [];
    
    // Add low stock products to alerts (qty > 0 but <= threshold)
    this.lowStockProducts.forEach(product => {
      this.alertMessages.push({
        type: 'lowStock',
        title: 'Low Stock',
        message: `${product.name} is going to be out of stock soon (${product.stockQuantity}/${product.threshold})`,
        product: product,
        priority: 'high',
        id: `low-${product.id || Math.random()}`
      });
    });

    // Add out of stock products to alerts (qty = 0)
    this.outOfStockProducts.forEach(product => {
      this.alertMessages.push({
        type: 'outOfStock',
        title: 'Out of Stock',
        message: `${product.name} is out of stock. Restock now.`,
        product: product,
        priority: 'critical',
        id: `out-${product.id || Math.random()}`
      });
    });

    // Add expired products to alerts
    this.expiredProducts.forEach(product => {
      this.alertMessages.push({
        type: 'expired',
        title: 'Expired Product',
        message: `${product.name} has expired (Expired on: ${product.expiryDate ? new Date(product.expiryDate).toLocaleDateString() : 'N/A'})`,
        product: product,
        priority: 'critical',
        id: `expired-${product.id || Math.random()}`
      });
    });
  }

  deleteAlertMessage(alertId: string) {
    this.alertMessages = this.alertMessages.filter(alert => alert.id !== alertId);
  }

  toggleAlertsPanel() {
    this.showAlertsPanel = !this.showAlertsPanel;
    if (this.showAlertsPanel) {
      this.updateAlertMessages();
    }
  }

  closeAlertsPanel() {
    this.showAlertsPanel = false;
  }

  handleAlertClick(alert: any) {
    // Don't navigate on click, let buttons handle actions
  }

  viewProductInTable(alert: any) {
    this.closeAlertsPanel();
    if (alert.product && alert.product.name) {
      // Navigate to products page with search term to filter this product
      this.router.navigate(['/dashboard/products'], { 
        queryParams: { 
          search: alert.product.name 
        } 
      });
    } else {
      // Fallback: just navigate to products
      this.router.navigate(['/dashboard/products']);
    }
  }

  viewSpecificProduct(product: any) {
    this.closeModal();
    if (product && product.name) {
      // Navigate to products page with search term to filter this specific product
      this.router.navigate(['/dashboard/products'], { 
        queryParams: { 
          search: product.name 
        } 
      });
    } else {
      // Fallback: just navigate to products
      this.router.navigate(['/dashboard/products']);
    }
  }

  sendEmailToSupplier(alert: any) {
    if (!alert.product) return;
    
    const product = alert.product;
    if (!product.supplierEmail) {
      alert(`Supplier email not found for ${product.name}. Please update supplier information.`);
      return;
    }

    const user = this.auth.user$.value;
    const adminEmail = user?.email || 'admin@inventory.com';
    const adminName = adminEmail.split('@')[0] || 'Admin';
    const suggestedRestock = Math.max(product.threshold * 2, 50);

    const subject = encodeURIComponent(`Restock Request: ${product.name}`);
    const body = encodeURIComponent(
      `Dear Supplier,

We need to restock the following product:

Product Name: ${product.name}
Current Stock: ${product.stockQuantity} units
Threshold: ${product.threshold} units
Suggested Restock Quantity: ${suggestedRestock} units

Please arrange for the restock at your earliest convenience.

Best regards,
${adminName}
${adminEmail}`
    );

    window.location.href = `mailto:${product.supplierEmail}?subject=${subject}&body=${body}`;
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'lowStock':
      case 'outOfStock':
        return 'bi-exclamation-triangle-fill';
      case 'expired':
        return 'bi-trash-fill';
      case 'expiringSoon':
        return 'bi-hourglass-split';
      default:
        return 'bi-info-circle-fill';
    }
  }

  getAlertBadgeClass(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'badge-critical';
      case 'high':
        return 'badge-high';
      case 'medium':
        return 'badge-medium';
      default:
        return 'badge-info';
    }
  }

  // --- New dashboard sections ---

  private loadRecentActivity() {
    this.http.get<any[]>('http://localhost:5011/api/InventoryLogs')
      .subscribe({
        next: (data) => {
          this.recentActivity = data
            .map((log: any) => {
              let parsedDate: Date | null = null;
              const d = log.createdAt;
              if (d) {
                if (d.seconds !== undefined) parsedDate = new Date(d.seconds * 1000);
                else if (d._seconds !== undefined) parsedDate = new Date(d._seconds * 1000);
                else if (typeof d === 'string' || typeof d === 'number') parsedDate = new Date(d);
                else if (d instanceof Date) parsedDate = d;
              }
              return {
                ...log,
                productName: log.productName || '',
                type: log.type || 'OUT',
                quantity: log.quantity || 0,
                price: log.price || 0,
                reason: log.reason || '',
                createdAt: parsedDate
              } as InventoryLog;
            })
            .sort((a, b) => {
              const tA = a.createdAt?.getTime() || 0;
              const tB = b.createdAt?.getTime() || 0;
              return tB - tA;
            })
            .slice(0, 5);
        },
        error: () => {
          this.recentActivity = [];
        }
      });
  }

  private initCategoryChart() {
    if (!this.categoryChartRef || this.categoryStockData.length === 0) return;

    if (this.categoryChartInstance) {
      this.categoryChartInstance.destroy();
    }

    const barColors = ['#00D4FF', '#7C3AED', '#10B981', '#F59E0B', '#94A3B8', '#EC4899', '#F97316'];

    this.categoryChartInstance = new Chart(this.categoryChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.categoryStockData.map(c => c.name),
        datasets: [{
          data: this.categoryStockData.map(c => c.stock),
          backgroundColor: this.categoryStockData.map((_, i) => barColors[i % barColors.length]),
          borderRadius: 5,
          borderSkipped: false,
          barPercentage: 0.6,
          categoryPercentage: 0.75
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1C2333',
            titleColor: '#F1F5F9',
            bodyColor: '#94A3B8',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed.y} units`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#94A3B8',
              font: { size: 11 },
              maxRotation: 0,
              minRotation: 0,
              callback: function(value: any, index: number) {
                const label = (this as any).getLabelForValue(index);
                return label.length > 10 ? label.substring(0, 10) + '…' : label;
              }
            }
          },
          y: {
            display: true,
            border: { display: false },
            grid: {
              color: 'rgba(255,255,255,0.05)',
              drawTicks: false
            },
            ticks: {
              color: '#94A3B8',
              font: { size: 11 },
              padding: 8,
              stepSize: 20
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  getExpiryStatus(expiryDate: any): string {
    if (!expiryDate) return 'ok';
    const date = expiryDate?.toDate ? expiryDate.toDate() : new Date(expiryDate);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    if (days < 0) return 'expired';
    if (days <= 30) return 'soon';
    return 'ok';
  }

  formatExpiryLabel(expiryDate: any): string {
    if (!expiryDate) return '—';
    const date = expiryDate?.toDate ? expiryDate.toDate() : new Date(expiryDate);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getActivityColor(type: string): string {
    const t = (type || '').toUpperCase();
    if (t === 'IN') return '#10B981';
    if (t === 'OUT') return '#EF4444';
    return '#00D4FF';
  }

  formatActivityTime(date: Date | null | undefined): string {
    if (!date) return '—';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }
}
