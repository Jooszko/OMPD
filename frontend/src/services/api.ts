import { clearCache } from './offlineCache';

const API_BASE = '/api';

export interface TodayOrder {
  client_name: string;
  product_name: string;
  quantity: number;
  price_at_sale: string;
  status: 'planned' | 'in_production' | 'in_delivery' | 'delivered' | 'failed' | 'cancelled';
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

export interface LoginResponse {
  refresh: string;
  access: string;
  must_change_password: boolean;
  role: AppUser['role'];
}

export function getAuthToken(): string | null {
  return localStorage.getItem('access_token');
}

export class LoginError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export const SESSION_EXPIRED_KEY = 'auth:session-expired';

function markSessionExpired(): void {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  } catch {
    // brak dostępu do sessionStorage – komunikat się po prostu nie pokaże
  }
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new LoginError('Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.', 'network');
  }

  if (!response.ok) {
    const body: { error?: unknown; detail?: unknown; code?: unknown } = await response.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : typeof body.detail === 'string' ? body.detail : null;
    const code = typeof body.code === 'string' ? body.code : response.status === 429 ? 'too_many_attempts' : 'unknown';
    throw new LoginError(message ?? 'Nie udało się zalogować. Spróbuj ponownie.', code);
  }

  const data: LoginResponse = await response.json();
  localStorage.setItem('access_token', data.access);
  localStorage.setItem('refresh_token', data.refresh);
  return data;
}

export function logoutUser(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  void clearCache();
}

export async function revokeSession(): Promise<void> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return;
  try {
    await fetch(`${API_BASE}/auth/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
  } catch {
    // brak połączenia – tokeny i tak zostaną usunięte z urządzenia
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return false;

  const response = await fetch(`${API_BASE}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) return false;

  const data: { access: string; refresh?: string } = await response.json();
  localStorage.setItem('access_token', data.access);
  if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
  return true;
}

function refreshAccessTokenOnce(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function withAuth(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, withAuth(init));
  if (response.status !== 401) return response;

  const refreshed = await refreshAccessTokenOnce();
  if (!refreshed) {
    logoutUser();
    markSessionExpired();
    window.location.reload();
    return response;
  }
  return fetch(input, withAuth(init));
}

export async function fetchDashboard(): Promise<any> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await apiFetch(`${API_BASE}/dashboard/`, { headers });
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
  must_change_password: boolean;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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
  const response = await apiFetch(`${API_BASE}/users/me/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function changeInitialPassword(newPassword: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/auth/change-password/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPassword }),
  });
  const body: { access?: string; refresh?: string; new_password?: unknown; error?: unknown } = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    const messages = Array.isArray(body.new_password)
      ? body.new_password.filter((m): m is string => typeof m === 'string')
      : [typeof body.error === 'string' ? body.error : 'Nie udało się zapisać hasła. Spróbuj ponownie.'];
    throw new Error(messages.join('\n'));
  }

  localStorage.setItem('access_token', body.access ?? '');
  localStorage.setItem('refresh_token', body.refresh ?? '');
}

export async function fetchUsers(): Promise<AppUser[]> {
  const response = await apiFetch(`${API_BASE}/users/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function createUser(payload: any): Promise<AppUser> {
  const response = await apiFetch(`${API_BASE}/users/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function updateUser(userId: number, payload: any): Promise<AppUser> {
  const response = await apiFetch(`${API_BASE}/users/${userId}/`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function deleteUser(userId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/users/${userId}/`, {
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
  phone: string;
  route: number;
  route_details: RouteOption;
  is_active: boolean;
  latitude: string | null;
  longitude: string | null;
  geocoded_at: string | null;
}

export async function fetchRoutes(): Promise<RouteOption[]> {
  const response = await apiFetch(`${API_BASE}/clients/routes/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchClients(): Promise<AppClient[]> {
  const response = await apiFetch(`${API_BASE}/clients/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function saveClient(payload: any, clientId: number | null = null): Promise<AppClient> {
  const url = clientId ? `${API_BASE}/clients/${clientId}/` : `${API_BASE}/clients/`;
  const method = clientId ? 'PUT' : 'POST';
  const response = await apiFetch(url, {
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
  const response = await apiFetch(`${API_BASE}/products/ingredients/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchProducts(): Promise<AppProduct[]> {
  const response = await apiFetch(`${API_BASE}/products/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function updateProductPrice(productId: number, basePrice: number): Promise<AppProduct> {
  const response = await apiFetch(`${API_BASE}/products/${productId}/`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ base_price: basePrice }),
  });
  return handleJsonResponse(response);
}

export async function fetchRecipes(): Promise<AppRecipe[]> {
  const response = await apiFetch(`${API_BASE}/products/recipes/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function createRecipe(payload: {
  name: string;
  category: string;
  items: { ingredient_id: number; amount: number }[];
}): Promise<AppRecipe> {
  const response = await apiFetch(`${API_BASE}/products/recipes/`, {
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
  const response = await apiFetch(`${API_BASE}/products/recipes/${productId}/`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return handleJsonResponse(response);
}

export async function deleteRecipe(productId: number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/products/recipes/${productId}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}

export async function fetchDailyOrders(dateStr?: string): Promise<any[]> {
  const url = dateStr ? `${API_BASE}/orders/daily/?date=${dateStr}` : `${API_BASE}/orders/daily/`;
  const response = await apiFetch(url, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchStandingOrders(): Promise<any[]> {
  const response = await apiFetch(`${API_BASE}/orders/standing/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchOrderHistory(): Promise<any[]> {
  const response = await apiFetch(`${API_BASE}/orders/history/`, { headers: authHeaders() });
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
  const response = await apiFetch(`${API_BASE}/users/notifications/send/`, {
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
  const response = await apiFetch(`${API_BASE}/users/notifications/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function markNotificationRead(notificationId: number): Promise<AppNotification> {
  const response = await apiFetch(`${API_BASE}/users/notifications/${notificationId}/read/`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await apiFetch(`${API_BASE}/users/notifications/mark-all-read/`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}

export interface DailySummary {
  date: string;
  sales: string;
  returns: string;
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
  kind: 'sale' | 'return';
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
  const response = await apiFetch(url, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function fetchExpenses(start?: string, end?: string): Promise<AppExpense[]> {
  const response = await apiFetch(withDateRange(`${API_BASE}/finance/expenses/`, start, end), {
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function createExpense(payload: {
  category: string;
  amount: number;
  description: string;
  date: string;
}): Promise<AppExpense> {
  const response = await apiFetch(`${API_BASE}/finance/expenses/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function fetchCategoryBreakdown(start?: string, end?: string): Promise<CategoryBreakdownRow[]> {
  const response = await apiFetch(withDateRange(`${API_BASE}/finance/category-breakdown/`, start, end), {
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function fetchPeriodIncomes(start?: string, end?: string): Promise<PeriodIncomeRow[]> {
  const response = await apiFetch(withDateRange(`${API_BASE}/finance/period-incomes/`, start, end), {
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function fetchTopClients(start?: string, end?: string): Promise<TopClientRow[]> {
  const response = await apiFetch(withDateRange(`${API_BASE}/finance/top-clients/`, start, end), {
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function fetchProfitTrend(start?: string, end?: string): Promise<ProfitTrendRow[]> {
  const response = await apiFetch(withDateRange(`${API_BASE}/finance/profit-trend/`, start, end), {
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function fetchFinancialReports(): Promise<FinancialReport[]> {
  const response = await apiFetch(`${API_BASE}/finance/reports/`, { headers: authHeaders() });
  return handleJsonResponse(response);
}

export async function generateFinancialReport(): Promise<FinancialReport> {
  const response = await apiFetch(`${API_BASE}/finance/reports/`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleJsonResponse(response);
}

export async function deleteFinancialReport(reportDate: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/finance/reports/${reportDate}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}

export type FailureReason = 'closed' | 'refused' | 'no_access' | 'other';

export interface LogisticsOrder {
  do_id: number;
  product_name: string;
  quantity: number;
  status: 'planned' | 'in_production' | 'in_delivery' | 'delivered' | 'failed' | 'cancelled';
  delivered_at: string | null;
  delivery_note: string;
  failure_reason: FailureReason | '';
  failure_note: string;
  failed_at: string | null;
}

export interface DeliveryProof {
  proof_id: number;
  kind: 'photo' | 'signature';
  signer_name: string;
  created_at: string;
  localImage?: Blob;
  pendingActionId?: string;
}

export interface StopReturnItem {
  product_id: number;
  product_name: string;
  delivered_quantity: number;
  returned_quantity: number;
  unit_price: string;
}

export interface StopReturns {
  source_date: string;
  items: StopReturnItem[];
}

export interface LogisticsStop {
  client_id: number;
  name: string;
  address: string;
  phone: string;
  latitude: string | null;
  longitude: string | null;
  orders: LogisticsOrder[];
  proofs: DeliveryProof[];
  returns: StopReturns | null;
}

export interface LogisticsRoute {
  route_id: number;
  route_name: string;
  driver: { user_id: number; full_name: string } | null;
  stops: LogisticsStop[];
}

export interface LogisticsViewer {
  role: 'admin' | 'baker' | 'driver';
  is_preview: boolean;
  driver_id: number | null;
}

export interface LogisticsDriverOption {
  user_id: number;
  full_name: string;
}

export interface LogisticsData {
  date: string;
  today: string;
  routes: LogisticsRoute[];
  unassigned: LogisticsStop[];
  viewer: LogisticsViewer;
  drivers: LogisticsDriverOption[];
}

export async function fetchLogistics(driverId?: number, date?: string): Promise<LogisticsData> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const params = new URLSearchParams();
  if (driverId) params.set('driver', String(driverId));
  if (date) params.set('date', date);
  const query = params.toString();
  const url = query ? `${API_BASE}/logistics/?${query}` : `${API_BASE}/logistics/`;
  const response = await apiFetch(url, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}

export interface OrderedStop {
  client_id: number;
  name: string;
  latitude: string;
  longitude: string;
}

export interface RouteDirections {
  geometry: { coordinates: [number, number][] } | null;
  distance_m: number | null;
  duration_s: number | null;
  provider: 'osrm' | 'ors' | null;
  skipped_stops: string[];
  note: string | null;
  optimized: boolean;
  ordered_stops: OrderedStop[];
}

export async function fetchRouteDirections(routeId: number, date?: string): Promise<RouteDirections> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = date
    ? `${API_BASE}/logistics/routes/${routeId}/directions/?date=${encodeURIComponent(date)}`
    : `${API_BASE}/logistics/routes/${routeId}/directions/`;
  const response = await apiFetch(url, { headers });
  if (!response.ok) {
    if (response.status === 401) {
      logoutUser();
      window.location.reload();
    }
    throw new Error(`Błąd serwera: ${response.status}`);
  }
  return response.json();
}

export interface ActionOptions {
  actionId?: string;
  occurredAt?: string;
}

function actionHeaders(options: ActionOptions = {}, json = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (options.actionId) headers['X-Client-Action-Id'] = options.actionId;
  if (options.occurredAt) headers['X-Occurred-At'] = options.occurredAt;
  return headers;
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error ?? `Błąd serwera: ${response.status}`, response.status);
  }
  return response;
}

export async function updateOrderStatus(
  orderId: number,
  newStatus: LogisticsOrder['status'],
  options?: ActionOptions
): Promise<{ do_id: number; status: string; delivered_at: string | null }> {
  const response = await apiFetch(`${API_BASE}/logistics/orders/${orderId}/status/`, {
    method: 'PATCH',
    headers: actionHeaders(options),
    body: JSON.stringify({ status: newStatus }),
  });
  return (await ensureOk(response)).json();
}

export async function deliverStop(
  clientId: number,
  options?: ActionOptions
): Promise<{ client_id: number; delivered_ids: number[]; delivered_at: string }> {
  const response = await apiFetch(`${API_BASE}/logistics/clients/${clientId}/deliver/`, {
    method: 'POST',
    headers: actionHeaders(options),
  });
  return (await ensureOk(response)).json();
}

export interface ReportProblemResult {
  client_id: number;
  failed_ids: number[];
  failure_reason: FailureReason;
  failure_note: string;
  failed_at: string;
}

async function postProblemReport(
  path: string,
  reason: FailureReason,
  note: string,
  options?: ActionOptions
): Promise<ReportProblemResult> {
  const response = await apiFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: actionHeaders(options),
    body: JSON.stringify({ reason, note }),
  });
  return (await ensureOk(response)).json();
}

export function reportStopProblem(clientId: number, reason: FailureReason, note: string, options?: ActionOptions) {
  return postProblemReport(`/logistics/clients/${clientId}/report-problem/`, reason, note, options);
}

export function reportOrderProblem(orderId: number, reason: FailureReason, note: string, options?: ActionOptions) {
  return postProblemReport(`/logistics/orders/${orderId}/report-problem/`, reason, note, options);
}

export async function withdrawProblemReport(
  orderIds: number[],
  options?: ActionOptions
): Promise<{ reverted_ids: number[] }> {
  const response = await apiFetch(`${API_BASE}/logistics/problems/withdraw/`, {
    method: 'POST',
    headers: actionHeaders(options),
    body: JSON.stringify({ order_ids: orderIds }),
  });
  return (await ensureOk(response)).json();
}

export async function saveStopDeliveryNote(
  clientId: number,
  note: string,
  options?: ActionOptions
): Promise<{ client_id: number; updated_ids: number[]; delivery_note: string }> {
  const response = await apiFetch(`${API_BASE}/logistics/clients/${clientId}/delivery-note/`, {
    method: 'POST',
    headers: actionHeaders(options),
    body: JSON.stringify({ note }),
  });
  return (await ensureOk(response)).json();
}

export interface ReturnItemInput {
  product_id: number;
  quantity: number;
}

export interface SaveReturnsResult {
  client_id: number;
  date: string;
  returns: StopReturns | null;
}

export async function saveStopReturns(
  clientId: number,
  items: ReturnItemInput[],
  options?: ActionOptions,
  date?: string
): Promise<SaveReturnsResult> {
  const response = await apiFetch(`${API_BASE}/logistics/clients/${clientId}/returns/`, {
    method: 'POST',
    headers: actionHeaders(options),
    body: JSON.stringify({ items, date }),
  });
  return (await ensureOk(response)).json();
}

export async function uploadDeliveryProof(
  clientId: number,
  kind: DeliveryProof['kind'],
  image: Blob,
  signerName = '',
  options?: ActionOptions
): Promise<DeliveryProof> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('image', image, kind === 'photo' ? 'photo.jpg' : 'signature.png');
  if (signerName) form.append('signer_name', signerName);

  const response = await apiFetch(`${API_BASE}/logistics/clients/${clientId}/proofs/`, {
    method: 'POST',
    headers: actionHeaders(options, false),
    body: form,
  });
  return (await ensureOk(response)).json();
}

export async function fetchDeliveryProofImage(proofId: number): Promise<Blob> {
  const response = await apiFetch(`${API_BASE}/logistics/proofs/${proofId}/file/`);
  return (await ensureOk(response)).blob();
}

export async function deleteDeliveryProof(proofId: number, options?: ActionOptions): Promise<void> {
  const response = await apiFetch(`${API_BASE}/logistics/proofs/${proofId}/`, {
    method: 'DELETE',
    headers: actionHeaders(options, false),
  });
  await ensureOk(response);
}

export interface DeliveryStatsDay {
  date: string;
  delivered: number;
  failed: number;
  pending: number;
}

export interface DeliveryStatsDriver {
  driver_id: number | null;
  full_name: string;
  delivered: number;
  failed: number;
  success_rate: number | null;
  days_on_route: number;
  avg_stops_per_day: number;
  avg_route_minutes: number | null;
}

export interface DeliveryStats {
  period: { start: string; end: string };
  summary: { delivered: number; failed: number; pending: number; success_rate: number | null };
  daily: DeliveryStatsDay[];
  failure_reasons: { reason: FailureReason; label: string; count: number }[];
  problem_clients: { client_id: number; name: string; failed: number }[];
  drivers: DeliveryStatsDriver[];
  proof_coverage: { delivered_stops: number; photo: number; signature: number; note: number };
}

export async function fetchDeliveryStats(start: string, end: string): Promise<DeliveryStats> {
  const params = new URLSearchParams({ start, end });
  const response = await apiFetch(`${API_BASE}/delivery-stats/?${params}`);
  return (await ensureOk(response)).json();
}

export async function fetchSuppliers(): Promise<any[]> {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await apiFetch(`${API_BASE}/finance/suppliers/`, { headers });
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

  const url = supplierId ? `${API_BASE}/finance/suppliers/${supplierId}/` : `${API_BASE}/finance/suppliers/`;

  const method = supplierId ? 'PUT' : 'POST';

  const response = await apiFetch(url, {
    method,
    headers,
    body: JSON.stringify(payload),
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

export async function saveDailyOrder(payload: {
  client_id: number;
  order_date?: string;
  status?: string;
  items: { product_id: number; qty: number }[];
}): Promise<any> {
  const response = await apiFetch(`${API_BASE}/orders/daily/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export async function deleteDailyOrder(orderId: string | number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/orders/daily/?id=${encodeURIComponent(orderId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}

export async function deleteStandingOrder(clientId: string | number): Promise<void> {
  const response = await apiFetch(`${API_BASE}/orders/standing/?client_id=${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  await handleJsonResponse(response);
}

export async function saveStandingOrder(payload: {
  client_id: number;
  days: number[];
  items: { product_id: number; qty: number }[];
}): Promise<any> {
  const response = await apiFetch(`${API_BASE}/orders/standing/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handleJsonResponse(response);
}

export type ProductionStage = 'mixing' | 'dividing' | 'proofing' | 'baking' | 'done';
export type WasteReason = 'damaged' | 'misshaped' | 'overproofed' | 'burnt' | 'underbaked' | 'dropped' | 'other';

export interface ProductionPerson {
  user_id: number;
  full_name: string;
}

export interface WeighItem {
  ingredient_id: number;
  name: string;
  unit: string;
  amount: number;
}

export interface PlanPreviewBatch {
  sequence: number;
  dough_mass_kg: number;
  outputs: { product_id: number; product_name: string; pieces: number }[];
  ingredients: WeighItem[];
}

export interface PlanPreviewDough {
  dough_id: number;
  name: string;
  loss_buffer_pct: number;
  raw_mass_kg: number;
  total_mass_kg: number;
  mixer: { mixer_id: number; name: string; min_capacity_kg: number; max_capacity_kg: number } | null;
  products: {
    product_id: number;
    product_name: string;
    ordered_qty: number;
    piece_weight_kg: number;
    raw_mass_kg: number;
    bake_temp_c: number;
    bake_time_min: number;
  }[];
  batches: PlanPreviewBatch[];
  warnings: string[];
  notes: string[];
}

export interface PlanPreview {
  delivery_date: string;
  production_date: string;
  doughs: PlanPreviewDough[];
  unassigned_products: { product_id: number; product_name: string; ordered_qty: number }[];
  ingredient_totals: (WeighItem & { current_stock: number; shortage: number })[];
}

export interface ProductionPlanSummary {
  plan_id: number;
  created_at: string;
  created_by: ProductionPerson | null;
  locked: boolean;
}

export interface PlanOrderChange {
  product_id: number;
  product_name: string;
  planned_qty: number;
  current_qty: number;
  difference: number;
}

export interface ProductionPlanResponse {
  preview: PlanPreview;
  plan: ProductionPlanSummary | null;
  /** Różnice między zatwierdzonym planem a bieżącymi zamówieniami; puste, gdy plan nie jest zapisany. */
  order_changes: PlanOrderChange[];
}

export interface BatchOutput {
  product_id: number;
  product_name: string;
  planned_pieces: number;
  waste_pieces: number;
  good_pieces: number;
  piece_weight_kg: number;
  bake_temp_c: number;
  bake_time_min: number;
}

export interface BatchStageEntry {
  stage: ProductionStage;
  stage_label: string;
  started_by: ProductionPerson | null;
  started_at: string;
  finished_by: ProductionPerson | null;
  finished_at: string | null;
}

export interface BatchWasteEntry {
  waste_id: number;
  product_id: number;
  product_name: string;
  stage: ProductionStage;
  stage_label: string;
  quantity: number;
  reason: WasteReason;
  reason_label: string;
  recorded_by: ProductionPerson | null;
  created_at: string;
}

export interface ProductionBatch {
  batch_id: number;
  dough_id: number;
  dough_name: string;
  sequence: number;
  batch_count: number;
  dough_mass_kg: number;
  mixer_name: string | null;
  stage: ProductionStage;
  stage_label: string;
  next_stage: ProductionStage | null;
  next_stage_label: string | null;
  stage_started_at: string | null;
  stage_worker: ProductionPerson | null;
  completed_at: string | null;
  mixing: { instructions: string; mixing_time_min: number; target_dough_temp_c: number };
  proofing_time_min: number;
  ingredients: WeighItem[];
  outputs: BatchOutput[];
  history: BatchStageEntry[];
  waste: BatchWasteEntry[];
}

export interface CoverageRow {
  product_id: number;
  product_name: string;
  ordered_qty: number;
  planned_qty: number;
  waste_qty: number;
  expected_qty: number;
  finished_qty: number;
  shortfall: number;
}

export interface ProductionBoard {
  delivery_date: string;
  production_date: string;
  plan: ProductionPlanSummary | null;
  batches: ProductionBatch[];
  coverage: CoverageRow[];
  viewer: ProductionPerson & { role: AppUser['role'] };
  waste_reasons: { value: WasteReason; label: string }[];
}

export interface BatchActionResult {
  batch: ProductionBatch;
  coverage: CoverageRow[];
  shortfall?: number;
}

async function productionJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json();
  const data = await response.json().catch(() => ({}));
  throw new ApiError(data.error ?? `Błąd serwera: ${response.status}`, response.status);
}

function productionDateQuery(deliveryDate?: string): string {
  return deliveryDate ? `?delivery_date=${encodeURIComponent(deliveryDate)}` : '';
}

export async function fetchProductionPlan(deliveryDate?: string): Promise<ProductionPlanResponse> {
  const response = await apiFetch(`${API_BASE}/production/plan/${productionDateQuery(deliveryDate)}`, {
    headers: authHeaders(),
  });
  return productionJson(response);
}

export async function generateProductionPlan(deliveryDate: string): Promise<ProductionPlanResponse> {
  const response = await apiFetch(`${API_BASE}/production/plan/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ delivery_date: deliveryDate }),
  });
  return productionJson(response);
}

export async function fetchProductionBoard(deliveryDate?: string): Promise<ProductionBoard> {
  const response = await apiFetch(`${API_BASE}/production/board/${productionDateQuery(deliveryDate)}`, {
    headers: authHeaders(),
  });
  return productionJson(response);
}

async function postBatchAction(batchId: number, action: string, payload: object): Promise<BatchActionResult> {
  const response = await apiFetch(`${API_BASE}/production/batches/${batchId}/${action}/`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return productionJson(response);
}

export function startBatchStage(batchId: number, stage: ProductionStage): Promise<BatchActionResult> {
  return postBatchAction(batchId, 'start', { stage });
}

export function advanceBatchStage(batchId: number, stage: ProductionStage): Promise<BatchActionResult> {
  return postBatchAction(batchId, 'advance', { stage });
}

export function recordBatchWaste(
  batchId: number,
  payload: { product_id: number; quantity: number; reason: WasteReason }
): Promise<BatchActionResult> {
  return postBatchAction(batchId, 'waste', payload);
}

// ---------------------------------------------------------------------------
// Ustawienia produkcji: mieszałki, ciasta z recepturą, parametry wyrobów
// ---------------------------------------------------------------------------

/** Kwoty dziesiętne przychodzą z Django jako tekst, np. "120.000". */
export interface ProductionMixer {
  mixer_id: number;
  name: string;
  min_capacity_kg: string;
  max_capacity_kg: string;
  is_active: boolean;
}

export interface DoughRecipeItem {
  ingredient_id: number;
  name: string;
  unit: string;
  amount_per_kg: string;
}

export interface ProductionDough {
  dough_id: number;
  name: string;
  mixer_id: number | null;
  loss_buffer_pct: string;
  mixing_time_min: number;
  target_dough_temp_c: string;
  proofing_time_min: number;
  mixing_instructions: string;
  ingredients: DoughRecipeItem[];
  products_count: number;
}

export interface BakeSpecValues {
  dough_id: number;
  piece_weight_kg: string;
  bake_temp_c: number;
  bake_time_min: number;
}

export interface ProductBakeSpecRow {
  product_id: number;
  product_name: string;
  category: string;
  spec: (BakeSpecValues & { dough_name: string }) | null;
}

export interface ProductionSettings {
  mixers: ProductionMixer[];
  doughs: ProductionDough[];
  products: ProductBakeSpecRow[];
  ingredients: { ingredient_id: number; name: string; unit: string }[];
}

export type MixerInput = Omit<ProductionMixer, 'mixer_id'>;
export type DoughInput = Omit<ProductionDough, 'dough_id' | 'products_count' | 'ingredients'> & {
  ingredients: { ingredient_id: number; amount_per_kg: string }[];
};

async function sendProductionSettings<T>(path: string, method: string, payload?: object): Promise<T> {
  const response = await apiFetch(`${API_BASE}/production/${path}`, {
    method,
    headers: authHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (response.status === 204) return undefined as T;
  return productionJson(response);
}

export async function fetchProductionSettings(): Promise<ProductionSettings> {
  const response = await apiFetch(`${API_BASE}/production/settings/`, { headers: authHeaders() });
  return productionJson(response);
}

export function saveMixer(payload: Partial<MixerInput>, mixerId: number | null): Promise<ProductionMixer> {
  return mixerId === null
    ? sendProductionSettings('mixers/', 'POST', payload)
    : sendProductionSettings(`mixers/${mixerId}/`, 'PATCH', payload);
}

export function saveDough(payload: DoughInput, doughId: number | null): Promise<ProductionDough> {
  return doughId === null
    ? sendProductionSettings('doughs/', 'POST', payload)
    : sendProductionSettings(`doughs/${doughId}/`, 'PATCH', payload);
}

export function deleteDough(doughId: number): Promise<void> {
  return sendProductionSettings(`doughs/${doughId}/`, 'DELETE');
}

export function saveBakeSpec(productId: number, payload: BakeSpecValues): Promise<ProductBakeSpecRow> {
  return sendProductionSettings(`bake-specs/${productId}/`, 'PUT', payload);
}

export function deleteBakeSpec(productId: number): Promise<void> {
  return sendProductionSettings(`bake-specs/${productId}/`, 'DELETE');
}

export type AuditCategory = 'accounts' | 'clients' | 'products' | 'orders' | 'finance' | 'logistics';

export interface AuditChange {
  field: string;
  label: string;
  old: unknown;
  new: unknown;
}

export interface AuditEntry {
  entry_id: number;
  created_at: string;
  actor: number | null;
  actor_name: string;
  category: AuditCategory;
  category_label: string;
  action: string;
  action_label: string;
  object_type: string;
  object_id: string;
  object_label: string;
  description: string;
  changes: AuditChange[];
  ip_address: string | null;
}

export interface AuditPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditEntry[];
}

export interface AuditFilterOptions {
  categories: { value: AuditCategory; label: string }[];
  actions: { value: string; label: string; category: AuditCategory }[];
  actors: { id: number; name: string }[];
}

export type AuditQuery = Partial<
  Record<'category' | 'action' | 'actor' | 'date_from' | 'date_to' | 'q' | 'object_type' | 'object_id' | 'page', string>
>;

export async function fetchAuditEntries(query: AuditQuery): Promise<AuditPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const response = await apiFetch(`${API_BASE}/audit/?${params}`);
  return (await ensureOk(response)).json();
}

export async function fetchAuditFilterOptions(): Promise<AuditFilterOptions> {
  const response = await apiFetch(`${API_BASE}/audit/filters/`);
  return (await ensureOk(response)).json();
}
