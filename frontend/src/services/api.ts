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


export interface AppUser {
  user_id: number;
  username: string;
  role: 'admin' | 'baker' | 'driver';
  full_name: string;
  is_active: boolean;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleJsonResponse(response: Response): Promise<any> {
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(errorData) || `Błąd serwera: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function fetchCurrentUser(): Promise<AppUser> {
  const response = await fetch(`${API_BASE}/users/me/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchUsers(): Promise<AppUser[]> {
  const response = await fetch(`${API_BASE}/users/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function createUser(payload: any): Promise<AppUser> {
  const response = await fetch(`${API_BASE}/users/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function updateUser(userId: number, payload: any): Promise<AppUser> {
  const response = await fetch(`${API_BASE}/users/${userId}/`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function deleteUser(userId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/users/${userId}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}


export interface RouteOption {
  route_id: number;
  route_name: string;
  is_active: boolean;
}

export interface AppClient {
  client_id: number;
  name: string;
  address: string;
  nip: string | null;
  route: number;
  route_details: RouteOption;
  is_active: boolean;
}

export async function fetchRoutes(): Promise<RouteOption[]> {
  const response = await fetch(`${API_BASE}/clients/routes/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchClients(): Promise<AppClient[]> {
  const response = await fetch(`${API_BASE}/clients/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function saveClient(payload: any, clientId: number | null = null): Promise<AppClient> {
  const url = clientId ? `${API_BASE}/clients/${clientId}/` : `${API_BASE}/clients/`;
  const method = clientId ? 'PUT' : 'POST';
  const response = await fetch(url, {
    method,
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}


export interface AppIngredient {
  ingredient_id: number;
  name: string;
  unit: string;
}

export interface AppProduct {
  product_id: number;
  name: string;
  category: string;
  base_price: string;
}

export interface RecipeItem {
  ingredient_id: number;
  ingredient_name: string;
  unit: string;
  amount: string;
}

export interface AppRecipe {
  product_id: number;
  name: string;
  category: string;
  items: RecipeItem[];
}

export async function fetchIngredients(): Promise<AppIngredient[]> {
  const response = await fetch(`${API_BASE}/products/ingredients/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchProducts(): Promise<AppProduct[]> {
  const response = await fetch(`${API_BASE}/products/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function updateProductPrice(productId: number, basePrice: number): Promise<AppProduct> {
  const response = await fetch(`${API_BASE}/products/${productId}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ base_price: basePrice }),
  });
  return handleJsonResponse(response);
}

export async function fetchRecipes(): Promise<AppRecipe[]> {
  const response = await fetch(`${API_BASE}/products/recipes/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function createRecipe(payload: {
  name: string;
  category: string;
  items: { ingredient_id: number; amount: number }[];
}): Promise<AppRecipe> {
  const response = await fetch(`${API_BASE}/products/recipes/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function updateRecipe(
  productId: number,
  items: { ingredient_id: number; amount: number }[]
): Promise<AppRecipe> {
  const response = await fetch(`${API_BASE}/products/recipes/${productId}/`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return handleJsonResponse(response);
}

export async function deleteRecipe(productId: number): Promise<void> {
  const response = await fetch(`${API_BASE}/products/recipes/${productId}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}


export async function fetchDailyOrders(dateStr?: string): Promise<any[]> {
  const url = dateStr ? `${API_BASE}/orders/daily/?date=${dateStr}` : `${API_BASE}/orders/daily/`;
  const response = await fetch(url, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchStandingOrders(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/orders/standing/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchOrderHistory(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/orders/history/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}


export interface AppNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_id: number | null;
  sender_name: string | null;
}

export function getCurrentUserId(): number | null {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded.user_id ?? null;
  } catch {
    return null;
  }
}

export async function sendMessage(recipientId: number, title: string, message: string): Promise<AppNotification> {
  const response = await fetch(`${API_BASE}/users/notifications/send/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ recipient_id: recipientId, title, message }),
  });
  return handleJsonResponse(response);
}

export interface NotificationsResponse {
  results: AppNotification[];
  unread_count: number;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const response = await fetch(`${API_BASE}/users/notifications/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function markNotificationRead(notificationId: number): Promise<AppNotification> {
  const response = await fetch(`${API_BASE}/users/notifications/${notificationId}/read/`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch(`${API_BASE}/users/notifications/mark-all-read/`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}


export interface DailySummary {
  date: string;
  revenue: string;
  expenses: string;
  balance: string;
}

export interface AppExpense {
  expense_id: number;
  category: string;
  category_label: string;
  amount: string;
  description: string;
  date: string;
}

export interface CategoryBreakdownRow {
  category: string;
  category_label: string;
  total: string;
}

export interface PeriodIncomeRow {
  client_name: string;
  amount: string;
  date: string;
}

export interface TopClientRow {
  client_name: string;
  total: string;
}

export interface ProfitTrendRow {
  date: string;
  net_profit: string;
}

export interface FinancialReport {
  report_date: string;
  total_revenue: string;
  total_cogs: string;
  total_operating_expenses: string;
  net_profit: string;
  is_finalized: boolean;
}

function withDateRange(base: string, start?: string, end?: string): string {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function fetchDailySummary(dateStr?: string): Promise<DailySummary> {
  const url = dateStr ? `${API_BASE}/finance/daily-summary/?date=${dateStr}` : `${API_BASE}/finance/daily-summary/`;
  const response = await fetch(url, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchExpenses(start?: string, end?: string): Promise<AppExpense[]> {
  const response = await fetch(withDateRange(`${API_BASE}/finance/expenses/`, start, end), { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function createExpense(payload: {
  category: string;
  amount: number;
  description: string;
  date: string;
}): Promise<AppExpense> {
  const response = await fetch(`${API_BASE}/finance/expenses/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function fetchCategoryBreakdown(start?: string, end?: string): Promise<CategoryBreakdownRow[]> {
  const response = await fetch(withDateRange(`${API_BASE}/finance/category-breakdown/`, start, end), { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchPeriodIncomes(start?: string, end?: string): Promise<PeriodIncomeRow[]> {
  const response = await fetch(withDateRange(`${API_BASE}/finance/period-incomes/`, start, end), { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchTopClients(start?: string, end?: string): Promise<TopClientRow[]> {
  const response = await fetch(withDateRange(`${API_BASE}/finance/top-clients/`, start, end), { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchProfitTrend(start?: string, end?: string): Promise<ProfitTrendRow[]> {
  const response = await fetch(withDateRange(`${API_BASE}/finance/profit-trend/`, start, end), { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchFinancialReports(): Promise<FinancialReport[]> {
  const response = await fetch(`${API_BASE}/finance/reports/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function generateFinancialReport(): Promise<FinancialReport> {
  const response = await fetch(`${API_BASE}/finance/reports/`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function deleteFinancialReport(reportDate: string): Promise<void> {
  const response = await fetch(`${API_BASE}/finance/reports/${reportDate}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
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