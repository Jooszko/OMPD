export interface OrderItem {
  product_id: number;
  product_name?: string;
  qty: number;
}

export interface Order {
  id: number | string;
  client_id: number;
  client_name?: string;
  address?: string;
  total_quantity: number;
  total_amount: number;
  status?: string;
  is_standing?: boolean;
  day_of_week?: string;
  date?: string;
  items?: OrderItem[];
}