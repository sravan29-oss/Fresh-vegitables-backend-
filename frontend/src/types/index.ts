export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  status: 'active' | 'inactive';
  display_order: number;
  product_count?: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  unit: string;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  status: 'active' | 'inactive';
}

export interface Product {
  id: string;
  category_id?: string;
  name: string;
  slug: string;
  description?: string;
  images: string[];
  unit: string;
  mrp: number;
  selling_price: number;
  purchase_price?: number;
  stock_quantity: number;
  minimum_stock: number;
  status: 'active' | 'inactive';
  featured: boolean;
  best_seller: boolean;
  category_name?: string;
  category_slug?: string;
  discount?: number;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  variants?: ProductVariant[];
  created_at?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string | null;
  name: string;
  slug: string;
  image?: string;
  unit: string;
  mrp: number;
  selling_price: number;
  quantity: number;
  stock_quantity: number;
  item_total: number;
  product_status: string;
  variant_name?: string | null;
}

export interface Cart {
  cart_id: string;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  mrp_total: number;
  discount: number;
  delivery_charge: number;
  total: number;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  house_number?: string;
  street?: string;
  area: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
  address_type: 'home' | 'work' | 'other';
  is_default: boolean;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  unit: string;
  price: number;
  mrp: number;
  quantity: number;
  subtotal: number;
  image_url?: string;
  product_images?: string[];
  product_name_snapshot?: string;
  unit_snapshot?: string;
  price_snapshot?: number;
  mrp_snapshot?: number;
  total?: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  address_id: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  payment_method: 'cod' | 'online' | 'upi' | 'wallet';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'preparing' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address: any;
  address_snapshot?: any;
  notes?: string;
  admin_email_sent?: boolean;
  admin_email_sent_at?: string | null;
  admin_email_error?: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'customer' | 'admin';
  status: 'active' | 'blocked';
  created_at?: string;
}

export interface DashboardStats {
  total_orders: number;
  today_orders: number;
  pending_orders: number;
  delivered_orders: number;
  total_customers: number;
  today_revenue: number;
  total_revenue: number;
  low_stock_products: number;
}

// ================= Phase 7: Payments =================
export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: 'upi' | 'card' | 'netbanking' | 'cod';
  payment_status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  gateway_payment_id?: string;
  gateway_order_id?: string;
  currency: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Refund {
  id: string;
  payment_id: string;
  order_id: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  processed_at?: string;
  created_at: string;
}

// ================= Phase 8 & 9: Delivery & Tracking =================
export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profile_image?: string;
  vehicle_type: string;
  vehicle_number: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_DELIVERY' | 'SUSPENDED';
  availability?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  total_deliveries?: number;
  created_at?: string;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  delivery_partner_id: string;
  partner_name?: string;
  partner_phone?: string;
  status: 'ASSIGNED' | 'ACCEPTED' | 'HEADING_TO_STORE' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
  assigned_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  estimated_delivery_time?: string;
  notes?: string;
}

export interface DeliveryTimelineEvent {
  id: string;
  status: string;
  title: string;
  description: string;
  timestamp: string;
  location: string;
  completed: boolean;
}

export interface DeliveryTrackingResponse {
  order: Order;
  show_driver?: boolean;
  carrier_name?: string;
  tracking_number?: string;
  expected_delivery?: string;
  logistics_status?: string;
  fulfillment_center?: string;
  package_type?: string;
  activities?: DeliveryTimelineEvent[];
  tracking?: {
    id?: string;
    order_id: string;
    delivery_partner_id?: string;
    status: string;
    partner_name?: string;
    partner_phone?: string;
    partner_rating?: number;
    vehicle_type?: string;
    vehicle_number?: string;
    partner_lat?: number;
    partner_lng?: number;
    estimated_delivery_time?: string;
    notes?: string;
    show_driver?: boolean;
  } | null;
  store_location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    address: string;
    latitude: number;
    longitude: number;
  };
}

// ================= Phase 10: Coupons & Offers =================
export interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'FLAT' | 'PERCENTAGE';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount: number;
  usage_limit: number;
  usage_count: number;
  per_customer_limit: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface CouponValidationResult {
  coupon: {
    id: string;
    code: string;
    name: string;
    discount_type: 'FLAT' | 'PERCENTAGE';
    discount_value: number;
  };
  order_amount: number;
  discount_amount: number;
  final_amount: number;
  savings_message: string;
}

// ================= Phase 11: Notifications =================
export interface Notification {
  id: string;
  user_id?: string | null;
  title: string;
  message: string;
  type: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
}

// ================= Phase 12: Business Intelligence =================
export interface BusinessIntelligenceData {
  range: string;
  overview: {
    today_orders: number;
    today_revenue: number;
    total_customers: number;
    pending_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    cod_orders: number;
    online_orders: number;
    active_deliveries: number;
  };
  sales_analytics: {
    total_revenue: number;
    avg_order_value: number;
    trend: Array<{ date: string; revenue: number; orders: number; delivered: number; cancelled: number }>;
  };
  product_analytics: {
    top_selling: Array<{ id: string; name: string; sold_kg: number; revenue: number; stock: number; status: string }>;
    low_stock: Array<{ id: string; name: string; stock_quantity: number; minimum_stock: number; selling_price: number }>;
    total_active_products: number;
  };
  customer_analytics: {
    total_customers: number;
    new_customers: number;
    returning_customers: number;
    repeat_rate_percentage: number;
    clv_estimate: string;
  };
  delivery_analytics: {
    total_deliveries: number;
    avg_delivery_time_min: number;
    active_drivers: number;
    drivers: Array<{
      id: string;
      name: string;
      deliveries: number;
      rating: number;
      status: string;
      vehicle_type: string;
      avg_time_minutes: number;
    }>;
  };
  payment_analytics: {
    successful: number;
    failed: number;
    refunded: number;
    cod_count: number;
  };
}

// ================= Phase 13: Homepage CMS =================
export interface HomepageBanner {
  id: string;
  section_id?: string;
  title: string;
  subtitle?: string;
  image: string;
  link?: string;
  badge?: string;
  display_order: number;
  status: 'active' | 'inactive';
}

export interface HomepageSection {
  id: string;
  type:
    | 'hero_banner'
    | 'categories'
    | 'featured_products'
    | 'best_sellers'
    | 'fresh_arrivals'
    | 'special_offers'
    | 'combo_packs'
    | 'seasonal_products'
    | 'promotional_banner'
    | 'testimonials'
    | 'why_choose_us'
    | 'app_promotion'
    | 'custom_banner';
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  button_text?: string;
  button_link?: string;
  display_order: number;
  status: 'active' | 'inactive' | 'scheduled';
  start_date?: string | null;
  end_date?: string | null;
  configuration?: any;
  categories?: Category[];
  products?: Product[];
  banners?: HomepageBanner[];
  created_at?: string;
  updated_at?: string;
}

export interface HomepageCMSResponse {
  sections: HomepageSection[];
  banners: HomepageBanner[];
}

// ================= Phase 15: Loyalty, Wallet & Referrals =================
export interface LoyaltyAccount {
  id: string;
  user_id: string;
  points_balance: number;
  lifetime_points_earned: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  created_at?: string;
}

export interface LoyaltyTransaction {
  id: string;
  loyalty_account_id: string;
  points: number;
  type: string;
  reference_id?: string;
  description: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  is_locked: boolean;
  created_at?: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  transaction_type: 'CREDIT' | 'DEBIT' | 'REFUND' | 'REFERRAL_BONUS' | 'PROMOTIONAL_BONUS';
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  description: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  created_at: string;
}

export interface ReferralProgram {
  referral_code: string;
  reward_amount: number;
  referee_discount: number;
  total_invited: number;
  total_earned: number;
  referrals: Array<{
    id: string;
    referee_id: string;
    status: string;
    created_at: string;
  }>;
  share_link: string;
}

// ================= Phase 16: Subscriptions & Recurring Orders =================
export interface SubscriptionItem {
  product_name: string;
  quantity: number;
  unit: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  title: string;
  status: 'ACTIVE' | 'PAUSED' | 'SKIPPED' | 'CANCELLED' | 'COMPLETED';
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  delivery_day: string;
  delivery_time_slot: string;
  start_date: string;
  next_delivery_date: string;
  total_deliveries_completed: number;
  amount_per_delivery: number;
  payment_method: string;
  address_summary: string;
  items: SubscriptionItem[];
  created_at: string;
}

// ================= Phase 17: Seller / Supplier Management =================
export interface Seller {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  commission_percentage: number;
  bank_account_details?: any;
  rating: number;
  total_orders: number;
  total_revenue: number;
  pending_payout: number;
  created_at: string;
}

export interface SellerPayout {
  id: string;
  seller_id: string;
  seller_name: string;
  amount: number;
  commission_deducted: number;
  net_payout: number;
  period_start: string;
  period_end: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  payment_reference: string;
  created_at: string;
}

// ================= Phase 19: Multi-Location & Delivery Zones =================
export interface DeliveryZone {
  id: string;
  name: string;
  pincodes: string[];
  delivery_radius_km: number;
  delivery_fee: number;
  min_order_amount: number;
  free_delivery_threshold: number;
  estimated_delivery_time: string;
  status: 'ACTIVE' | 'INACTIVE';
  latitude?: number;
  longitude?: number;
}

export interface DeliverySettings {
  id?: string;
  default_delivery_charge: number;
  free_delivery_threshold: number;
  min_order_amount: number;
  enable_free_delivery: boolean;
  express_delivery_fee: number;
  estimated_delivery_time: string;
  is_delivery_active: boolean;
  surge_charge: number;
  updated_at?: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email?: string;
  status: 'ACTIVE' | 'INACTIVE';
  coverage_zones?: string[];
}

// ================= Phase 20: Audit Logs =================
export interface AuditLog {
  id: string;
  admin_id?: string;
  admin_email: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address: string;
  user_agent?: string;
  created_at: string;
}


