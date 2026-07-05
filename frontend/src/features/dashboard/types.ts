export interface OrderItem {
  product_id: number;
  qty: number;
}

export interface Order {
  id: number;
  client_id: number;
  total_quantity: number;
  total_amount: number;
  status?: string;
  is_standing?: boolean;
  day_of_week?: string;
  date?: string;
  items?: OrderItem[];
}