import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { firstValueFrom } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.css']
})
export class ReportsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private productService = inject(ProductService);

  logs: any[] = [];
  products: any[] = [];

  // KPI
  totalRevenue = 0;
  totalCost = 0;
  netProfit = 0;
  inventoryValue = 0;
  damagedCost = 0;
  returnCount = 0;

  // Chart instances
  revenueCostChart: Chart | null = null;
  profitByProductChart: Chart | null = null;
  inventoryValueChart: Chart | null = null;
  forecastChart: Chart | null = null;

  // Switchers
  chart1Metric: 'revenue-cost' | 'revenue-profit' | 'cost-profit' = 'revenue-cost';
  chart2Metric: 'profit' | 'revenue' | 'cost' | 'quantity' = 'profit';
  chart4Metric: 'value' | 'quantity' = 'value';

  // AI Forecast
  showForecast = false;
  forecastData: any = {
    nextMonthRevenue: 0,
    nextMonthCost: 0,
    nextMonthProfit: 0,
    dailyForecast: [] as any[],
    restockRecommendations: [] as any[],
    productsAtRisk: [] as any[]
  };

  loading = true;

  async ngOnInit() {
    await this.loadData();
    this.calculateKPIs();
    this.calculateForecasts();
    setTimeout(() => {
      this.buildAllCharts();
      this.loading = false;
    }, 200);
  }

  ngOnDestroy() {
    this.destroyAllCharts();
    this.destroyChart(this.forecastChart);
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.getFreshToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  async loadData() {
    try {
      const headers = await this.getHeaders();
      const rawLogs = await firstValueFrom(this.http.get<any[]>('http://localhost:5011/api/inventorylogs', { headers })) || [];
      
      // Parse dates for all logs
      this.logs = rawLogs.map(log => ({
        ...log,
        createdAt: this.parseDate(log.createdAt)
      }));
      
      this.products = await firstValueFrom(this.productService.getProducts()) || [];
    } catch (err) {
      console.error('Error loading data:', err);
      this.logs = [];
      this.products = [];
    }
  }

  calculateKPIs() {
    this.totalRevenue = 0;
    this.totalCost = 0;
    this.damagedCost = 0;
    this.returnCount = 0;

    this.logs.forEach(log => {
      const revenue = Number(log.totalRevenue ?? 0);
      const cost = Number(log.totalCost ?? 0);

      this.totalRevenue += revenue;
      this.totalCost += cost;

      if (log.reason === 'damage') this.damagedCost += cost;
      if (log.reason === 'return') this.returnCount++;
    });

    this.netProfit = this.totalRevenue - this.totalCost;

    this.inventoryValue = this.products.reduce((sum, p) =>
      sum + (Number(p.price ?? 0) * Number(p.stockQuantity ?? 0)), 0
    );
  }

  private parseDate(dateValue: any): Date | null {
    if (!dateValue) return null;
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    
    // If it's a string or number
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const d = new Date(dateValue);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // If it's an object with timestamp (Firestore Timestamp)
    if (dateValue && typeof dateValue === 'object') {
      // Try to get seconds/nanoseconds from Firestore Timestamp
      if (dateValue.seconds !== undefined) {
        const d = new Date(dateValue.seconds * 1000);
        return isNaN(d.getTime()) ? null : d;
      }
      // Try toDate if available
      if (typeof dateValue.toDate === 'function') {
        const d = dateValue.toDate();
        return isNaN(d.getTime()) ? null : d;
      }
      // Try toISOString method
      if (typeof dateValue.toISOString === 'function') {
        const d = new Date(dateValue.toISOString());
        return isNaN(d.getTime()) ? null : d;
      }
    }
    
    return null;
  }
// 2 charts hasab profit... for each product
  private groupByMonth(logs: any[]) {
    const months: any = {};
    logs.forEach(log => {
      const d = this.parseDate(log.createdAt);
      if (!d) return;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!months[key]) months[key] = { label, revenue: 0, cost: 0, profit: 0, quantity: 0 };

      months[key].revenue += Number(log.totalRevenue ?? 0);
      months[key].cost += Number(log.totalCost ?? 0);
      months[key].profit += Number(log.profit ?? 0);
      months[key].quantity += Number(log.quantity ?? 0);
    });
    return months;
  }
//in 2 charts ka product
  private groupByProduct(logs: any[]) {
    const map: any = {};
    logs.forEach(log => {
      const name = log.productName ?? "Unknown";
      if (!map[name]) map[name] = { revenue: 0, cost: 0, profit: 0, quantity: 0 };

      map[name].revenue += Number(log.totalRevenue ?? 0);
      map[name].cost += Number(log.totalCost ?? 0);
      map[name].profit += Number(log.profit ?? 0);
      map[name].quantity += Number(log.quantity ?? 0);
    });
    return map;
  }

  // ⭐⭐⭐ FIXED TOOLTIP HANDLING (NO NULL ERRORS)

  // show fo2 kel aamod ra2em in ($)

  private safeY(context: any): number {
    return Number(context?.parsed?.y ?? 0);
  }

  private safeX(context: any): number {
    return Number(context?.parsed?.x ?? 0);
  }

  private makeMoneyTooltip(label: string) {
    return (context: any) => {
      const val = this.safeY(context);
      return `${label}: $${val.toFixed(2)}`;
    };
  }

  private makeQuantityOrMoneyTooltip(metric: string) {
    return (context: any) => {
      const val = metric === "quantity" ? this.safeX(context) : this.safeX(context).toFixed(2);
      return metric === "quantity"
        ? `Quantity: ${val}`
        : `${metric}: $${val}`;
    };
  }

  // 📌 BUILD CHARTS (CLEAN + NULL-SAFE)
  //first chart
  buildRevenueCostChart() {
    const ctx = document.getElementById('revenueCostChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.destroyChart(this.revenueCostChart);

    const months = this.groupByMonth(this.logs);
    const keys = Object.keys(months).sort();
    const labels = keys.map(k => months[k].label);

    const dataMap = {
      "revenue-cost": [
        { label: "Revenue", key: "revenue", color: "#10b981" },
        { label: "Cost", key: "cost", color: "#ef4444" }
      ],
      "revenue-profit": [
        { label: "Revenue", key: "revenue", color: "#10b981" },
        { label: "Profit", key: "profit", color: "#3b82f6" }
      ],
      "cost-profit": [
        { label: "Cost", key: "cost", color: "#ef4444" },
        { label: "Profit", key: "profit", color: "#3b82f6" }
      ]
    };

    const datasets = dataMap[this.chart1Metric].map(item => ({
      label: item.label,
      data: keys.map(k => months[k][item.key]),
      borderColor: item.color,
      backgroundColor: item.color + "33",
      tension: 0.4,
      fill: true
    }));

    this.revenueCostChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { callbacks: { label: this.makeMoneyTooltip("Value") } }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
  //second charts
  buildProfitByProductChart() {
    const ctx = document.getElementById('profitByProductChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.destroyChart(this.profitByProductChart);//change chart

    const grouped = this.groupByProduct(this.logs);
    const entries = Object.entries(grouped).slice(0, 10);

    const labels = entries.map(([n]) => n);
    const values = entries.map(([_, v]: any) => {
      if (this.chart2Metric === "profit") return v.profit;
      if (this.chart2Metric === "revenue") return v.revenue;
      if (this.chart2Metric === "cost") return v.cost;
      if (this.chart2Metric === "quantity") return v.quantity;
      return v.profit;
    });

    const color = this.chart2Metric === "profit" ? "#3b82f6" :
                  this.chart2Metric === "revenue" ? "#10b981" :
                  this.chart2Metric === "cost" ? "#ef4444" : "#8b5cf6";

    this.profitByProductChart = new Chart(ctx, {//create chart
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: color, borderRadius: 4 }]
      },
      options: {
        plugins: {
          tooltip: { 
            callbacks: { 
              label: this.chart2Metric === "quantity" 
                ? this.makeQuantityOrMoneyTooltip("quantity")
                : this.makeMoneyTooltip(this.chart2Metric) 
            } 
          }
        },
        indexAxis: 'x',
        maintainAspectRatio: false
      }
    });
  }


  buildInventoryValueChart() {
    const ctx = document.getElementById('inventoryValueChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.destroyChart(this.inventoryValueChart);

    const dataMap = this.products.map(p => ({
      name: p.name,
      value: this.chart4Metric === "value"
        ? Number(p.price ?? 0) * Number(p.stockQuantity ?? 0)
        : Number(p.stockQuantity ?? 0)
    })).sort((a, b) => b.value - a.value).slice(0, 8);//the best 8 product (stock)

    const labels = dataMap.map(x => x.name);//name of product
    const values = dataMap.map(x => x.value);//real value of product

    this.inventoryValueChart = new Chart(ctx, {//create chart
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const name = ctx.label ?? "";
                const value = Number(ctx.parsed ?? 0);
                return `${name}: $${value.toFixed(2)}`;
              }
            }
          }
        }
      }
    });
  }

  buildAllCharts() {
    this.buildRevenueCostChart();
    this.buildProfitByProductChart();
    this.buildInventoryValueChart();
  }

  onChart1MetricChange() {
  this.buildRevenueCostChart();
}

onChart2MetricChange() {
  this.buildProfitByProductChart();
}


onChart4MetricChange() {
  this.buildInventoryValueChart();
}


  destroyChart(c: Chart | null) {
    if (c) c.destroy();
  }

  destroyAllCharts() {
    this.destroyChart(this.revenueCostChart);
    this.destroyChart(this.profitByProductChart);
    this.destroyChart(this.inventoryValueChart);
    this.destroyChart(this.forecastChart);
  }

  // ========== AI FORECAST METHODS ==========

  //show forecast
  toggleForecast() {
    this.showForecast = !this.showForecast;
    if (this.showForecast) {
      setTimeout(() => this.buildForecastChart(), 100);
    }
  }

  // Get seasonal multiplier based on month ( tawako3 zyedet lmabi3at   )
  private getSeasonalMultiplier(month: number): number {
    // December (12) - Holiday season: 1.3x
    if (month === 12) return 1.3;
    // Summer months (6-8): 1.2x
    if (month >= 6 && month <= 8) return 1.2;
    // Ramadan (varies, but typically March-May): 1.25x
    // For simplicity, we'll use March-May as high season
    if (month >= 3 && month <= 5) return 1.25;
    // Default: 1.0
    return 1.0;
  }

  // Calculate moving average (يستخدم لمعرفة الاتجاه العام.) +/nb 
  private movingAverage(values: number[], period: number): number {
    if (values.length === 0) return 0;
    const recent = values.slice(-period);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }

  // Exponential smoothing ( ehtimem bi 2e5er days of month)
  private exponentialSmoothing(values: number[], alpha: number = 0.3)//0.3 aktar 2e5er days
  : number {
    if (values.length === 0) return 0;
    let forecast = values[0];
    for (let i = 1; i < values.length; i++) {
      forecast = alpha * values[i] + (1 - alpha) * forecast;
    }
    return forecast;
  }

  // Calculate forecasts
  calculateForecasts() {
    const now = new Date();// get date today
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);//next month
    const seasonalMultiplier = this.getSeasonalMultiplier(nextMonth.getMonth() + 1);

    // Initialize forecast data
    //metel constractor kermel object
    this.forecastData = {
      nextMonthRevenue: 0,
      nextMonthCost: 0,
      nextMonthProfit: 0,
      dailyForecast: [],
      restockRecommendations: [],
      productsAtRisk: []
    };

    // If no logs, return with zero forecasts
    if (this.logs.length === 0) {
      return;
    }

    // Group historical data by day for last 90 days
    
    const dailyData: { [key: string]: { revenue: number[], cost: number[], quantity: number[] } } = {};
    const cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);//2e5er 90 days of sale

    this.logs.forEach(log => {
      const date = this.parseDate(log.createdAt);
      if (!date || date < cutoffDate) return;

      const key = date.toISOString().split('T')[0];
      if (!dailyData[key]) {
        dailyData[key] = { revenue: [], cost: [], quantity: [] };
      }
      dailyData[key].revenue.push(Number(log.totalRevenue ?? 0));
      dailyData[key].cost.push(Number(log.totalCost ?? 0));
      if (log.type === 'OUT') {
        dailyData[key].quantity.push(Number(log.quantity ?? 0));
      }
    });

    // Aggregate daily totals
    const dailyTotals = Object.keys(dailyData).map(key => ({
      date: key,
      revenue: dailyData[key].revenue.reduce((a, b) => a + b, 0),
      cost: dailyData[key].cost.reduce((a, b) => a + b, 0),
      quantity: dailyData[key].quantity.reduce((a, b) => a + b, 0)
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate monthly averages
    const monthlyRevenue = dailyTotals.map(d => d.revenue);//monthlyRevenue = [100d1,150d2]
    const monthlyCost = dailyTotals.map(d => d.cost);
    const monthlyQuantity = dailyTotals.map(d => d.quantity);

    // Forecast next month using 30-day moving average with exponential smoothing
    const period = Math.min(30, monthlyRevenue.length);//last 30 days
    const avgDailyRevenue = period > 0 ? this.movingAverage(monthlyRevenue, period) : 0;
    const avgDailyCost = period > 0 ? this.movingAverage(monthlyCost, period) : 0;//avg daily
    const smoothedRevenue = monthlyRevenue.length > 0 ? this.exponentialSmoothing(monthlyRevenue, 0.3) : avgDailyRevenue;
    const smoothedCost = monthlyCost.length > 0 ? this.exponentialSmoothing(monthlyCost, 0.3) : avgDailyCost;
     
    //smooth algorthim la de2a use 2e5er days

    //calculate how days in moth ljey
    const daysInMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    this.forecastData.nextMonthRevenue = (smoothedRevenue || avgDailyRevenue) * daysInMonth * seasonalMultiplier;//season hasab %
    this.forecastData.nextMonthCost = (smoothedCost || avgDailyCost) * daysInMonth * seasonalMultiplier;
    this.forecastData.nextMonthProfit = this.forecastData.nextMonthRevenue - this.forecastData.nextMonthCost;

    //  30-day daily forecast
    this.forecastData.dailyForecast = [];
    for (let i = 1; i <= 30; i++) {//array for 30 days
      const forecastDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const dayMultiplier = forecastDate.getDay() === 0 || forecastDate.getDay() === 6 ? 0.8 : 1.0; // Weekend adjustment
      const seasonal = this.getSeasonalMultiplier(forecastDate.getMonth() + 1);//hasab season %
      //bl weekend sales tnzel 0.2
      this.forecastData.dailyForecast.push({
        date: forecastDate.toISOString().split('T')[0],
        revenue: (smoothedRevenue || avgDailyRevenue) * dayMultiplier * seasonal,
        cost: (smoothedCost || avgDailyCost) * dayMultiplier * seasonal
      });
    }

    // Calculate restock recommendations per product
    this.calculateRestockRecommendations(monthlyQuantity, seasonalMultiplier);

    // Calculate products at risk
    this.calculateProductsAtRisk();
  }

  // Calculate restock recommendations
  private calculateRestockRecommendations(monthlyQuantity: number[], seasonalMultiplier: number) {
    const productSales: { [key: string]: { quantity: number[], product: any } } = {};

    // Group sales by product for last 90 days
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.logs.filter(log => {
      const date = this.parseDate(log.createdAt);
      return date && date >= cutoffDate && log.type === 'OUT';
    }).forEach(log => {
      const name = log.productName ?? 'Unknown';
      if (!productSales[name]) {
        productSales[name] = { quantity: [], product: this.products.find(p => p.name === name) };
      }
      productSales[name].quantity.push(Number(log.quantity ?? 0));
    });

    this.forecastData.restockRecommendations = Object.entries(productSales).map(([name, data]) => {
      const period = Math.min(30, data.quantity.length);
      const avgDailySales = period > 0 ? this.movingAverage(data.quantity, period) : 0;
      const smoothedSales = data.quantity.length > 0 ? (this.exponentialSmoothing(data.quantity, 0.3) || avgDailySales) : avgDailySales;
      const forecasted30DaySales = smoothedSales * 30 * seasonalMultiplier;
      
      const product = data.product;
      const currentStock = Number(product?.stockQuantity ?? 0);
      const threshold = Number(product?.threshold ?? 10);
      const recommendedStock = Math.ceil(forecasted30DaySales * 1.2); // 20% safety buffer
      const restockNeeded = Math.max(0, recommendedStock - currentStock);

      return {
        productName: name,
        currentStock,
        threshold,
        avgDailySales: smoothedSales,
        forecasted30DaySales,
        recommendedStock,
        restockNeeded,
        priority: currentStock < threshold ? 'HIGH' : currentStock < recommendedStock ? 'MEDIUM' : 'LOW'
      };
    }).filter(r => r.restockNeeded > 0)
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority === 'HIGH' ? -1 : b.priority === 'HIGH' ? 1 : 0;
        }
        return b.restockNeeded - a.restockNeeded;
      });
  }

  // Calculate products at risk (low stock + high demand)
  private calculateProductsAtRisk() {
    const productDemand: { [key: string]: number } = {};
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Calculate demand (sales) for last 30 days
    this.logs.filter(log => {
      const date = this.parseDate(log.createdAt);
      return date && date >= cutoffDate && log.type === 'OUT';
    }).forEach(log => {
      const name = log.productName ?? 'Unknown';
      productDemand[name] = (productDemand[name] || 0) + Number(log.quantity ?? 0);
    });

    this.forecastData.productsAtRisk = this.products
      .map(product => {
        const name = product.name ?? 'Unknown';
        const currentStock = Number(product.stockQuantity ?? 0);
        const threshold = Number(product.threshold ?? 10);
        const demand = productDemand[name] || 0;
        const avgDailyDemand = demand / 30;
        const daysUntilStockout = avgDailyDemand > 0 ? currentStock / avgDailyDemand : 999;

        return {
          productName: name,
          currentStock,
          threshold,
          avgDailyDemand,
          daysUntilStockout,
          riskLevel: currentStock < threshold ? 'CRITICAL' :
                    daysUntilStockout < 7 ? 'HIGH' :
                    daysUntilStockout < 14 ? 'MEDIUM' : 'LOW'
        };
      })
      .filter(p => p.currentStock < p.threshold || p.daysUntilStockout < 14)
      .sort((a, b) => {
        if (a.riskLevel !== b.riskLevel) {
          const order = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
          return order[a.riskLevel as keyof typeof order] - order[b.riskLevel as keyof typeof order];
        }
        return a.daysUntilStockout - b.daysUntilStockout;
      });
  }

  // Build forecast chart
  buildForecastChart() {
    const ctx = document.getElementById('forecastChart') as HTMLCanvasElement;
    if (!ctx) return;

    this.destroyChart(this.forecastChart);

    // Handle empty forecast data
    if (!this.forecastData.dailyForecast || this.forecastData.dailyForecast.length === 0) {
      return;
    }

    const labels = this.forecastData.dailyForecast.map((d: any) => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const revenueData = this.forecastData.dailyForecast.map((d: any)=> d.revenue);
    const costData = this.forecastData.dailyForecast.map((d: any)=> d.cost);

    this.forecastChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Forecasted Revenue',
            data: revenueData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Forecasted Cost',
            data: costData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const y = (context.parsed?.y ?? 0) as number;
               return `${context.dataset.label}: $${y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => `$${value}`
            }
          }
        }
      }
    });
  }

  getRiskBadgeClass(risk: string): string {
    switch (risk) {
      case 'CRITICAL': return 'badge-critical';
      case 'HIGH': return 'badge-high';
      case 'MEDIUM': return 'badge-medium';
      default: return 'badge-low';
    }
  }

  getPriorityBadgeClass(priority: string): string {
    switch (priority) {
      case 'HIGH': return 'badge-high';
      case 'MEDIUM': return 'badge-medium';
      default: return 'badge-low';
    }
  }
}
