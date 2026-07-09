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


export interface LogisticsOrder {
  do_id: number;
  product_name: string;
  quantity: number;
  status: 'planned' | 'in_production' | 'in_delivery' | 'delivered' | 'cancelled';
}

export interface LogisticsStop {
  client_id: number;
  name: string;
  address: string;
  orders: LogisticsOrder[];
}

export interface LogisticsRoute {
  route_id: number;
  route_name: string;
  driver: { user_id: number; full_name: string } | null;
  stops: LogisticsStop[];
}

export interface LogisticsData {
  date: string;
  routes: LogisticsRoute[];
  unassigned: LogisticsStop[];
}

export async function fetchLogistics(): Promise<LogisticsData> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/logistics/`, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}

export async function updateOrderStatus(
  orderId: number,
  newStatus: LogisticsOrder['status']
): Promise<{ do_id: number; status: string }> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/logistics/orders/${orderId}/status/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: newStatus }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}


export async function fetchSuppliers(): Promise<any[]> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/finance/suppliers/`, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}


export async function saveSupplier(payload: any, supplierId: number | null = null): Promise<any> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = supplierId 
    ? `${API_BASE}/finance/suppliers/${supplierId}/` 
    : `${API_BASE}/finance/suppliers/`;
    
  const method = supplierId ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(errorData) || `Błąd serwera: ${response.status}`);
  }

  return response.json();
}