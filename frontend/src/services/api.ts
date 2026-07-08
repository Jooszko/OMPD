const API_BASE = 'http://localhost:8000/api';

export interface TodayOrder {
  client_name: string;
  product_name: string;
  quantity: number;
  price_at_sale: string;
  status: 'planned' | 'in_production' | 'in_delivery' | 'delivered' | 'cancelled';
}

export interface IngredientUsed {
  name: string;
  unit: string;
  total_amount: string;
}

export interface RevenuePerClient {
  client_name: string;
  total_revenue: string;
}

export interface WarehouseItem {
  name: string;
  unit: string;
  current_stock: string;
  min_stock_level: string;
}

export interface FinancialSummary {
  total_revenue: string;
  total_cogs: string;
  total_operating_expenses: string;
  net_profit: string;
  is_finalized: boolean;
}

export interface DashboardData {
  today_orders: TodayOrder[];
  total_items_for_shipment: number;
  ingredients_used_today: IngredientUsed[];
  revenue_per_client: RevenuePerClient[];
  warehouse_stock: WarehouseItem[];
  financial_summary: FinancialSummary | null;
}

// export async function fetchDashboard(): Promise<DashboardData> {
//   const response = await fetch(`${API_BASE}/dashboard/`);
//   if (!response.ok) {
//     throw new Error(`Błąd serwera: ${response.status}`);
//   }
//   return response.json();
// }

export interface LoginResponse {
  refresh: string;
  access: string;
}

export function getAuthToken(): string | null {
  return localStorage.getItem('access_token');
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error('Błędna nazwa użytkownika lub hasło');
  }

  const data: LoginResponse = await response.json();
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  return data;
}

export function logoutUser(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function fetchDashboard(): Promise<any> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/dashboard/`, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}
