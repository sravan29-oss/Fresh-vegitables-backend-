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
  average_rating?: number;
  review_count?: number;
  seo_title?: string;
  seo_description?: string;
  image_alt_text?: string;
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
  latitude?: number | null;
  longitude?: number | null;
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
  images?: string[];
  image?: string;
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
  payment_status: 'pending' | 'paid' | 'failed' | 'awaiting_cod_collection' | 'cod_collected' | 'refund_pending' | 'refunded' | 'partially_refunded';
  order_status: 'pending' | 'confirmed' | 'preparing' | 'packed' | 'out_for_delivery' | 'delivered' | 'cancelled';
  delivery_address: any;
  address_snapshot?: any;
  notes?: string;
  assigned_hub_id?: string | null;
  assigned_hub_code?: string | null;
  assigned_hub_name?: string | null;
  assigned_hub_address?: string | null;
  hub_distance_km?: number | null;
  confirmed_eta?: string | null;
  delivery_zone_name?: string | null;
  admin_email_sent?: boolean;
  admin_email_sent_at?: string | null;
  admin_email_error?: string | null;
  customer_email_sent?: boolean;
  customer_email_sent_at?: string | null;
  customer_email_error?: string | null;
  cancellation_email_sent?: boolean;
  cancellation_email_sent_at?: string | null;
  delivery_email_sent?: boolean;
  delivery_email_sent_at?: string | null;
  cancellation_reason?: string | null;
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
  new_orders?: number;
  today_orders: number;
  pending_orders: number;
  confirmed_orders?: number;
  processing_orders?: number;
  out_for_delivery?: number;
  delivered_orders: number;
  cancelled_orders?: number;
  total_customers: number;
  today_revenue: number;
  total_revenue: number;
  pending_payments?: number;
  paid_orders?: number;
  low_stock_products: number;
}

// ================= Admin-Controlled Payment Settings =================
export interface StorePaymentSettings {
  id: string;
  cod_enabled: boolean;
  cod_message: string;
  cod_min_amount: number;
  cod_max_amount: number;
  cod_fee: number;
  online_enabled: boolean;
  online_gateway_name: string;
  online_message: string;
  updated_by?: string;
  updated_at?: string;
}

export interface PaymentOverviewMetrics {
  total_online_payments: { count: number; amount: number };
  total_cod_orders: { count: number; amount: number };
  cod_collected: { count: number; amount: number };
  cod_pending_collection: { count: number; amount: number };
  failed_online_payments: { count: number; amount: number };
  refunds: { count: number; amount: number };
  total_verified_revenue: number;
  total_orders_in_window: number;
}

export interface PaymentTransactionLog {
  id: string;
  order_id: string;
  payment_method: string;
  amount: number;
  previous_status?: string;
  new_status: string;
  action_by: string;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface AdminNotificationItem {
  id: string;
  type: 'NEW_ORDER' | 'ORDER_CANCELLED' | 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'DELIVERY_COMPLETED';
  title: string;
  message: string;
  order_id?: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
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

// ================= Phase 8 & 9 & 11 & 12: Delivery & Tracking =================
export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profile_image?: string;
  vehicle_type: string;
  vehicle_number: string;
  status: 'OFFLINE' | 'AVAILABLE' | 'BUSY' | 'ON_DELIVERY' | 'SUSPENDED';
  availability?: string | boolean;
  assigned_hub_id?: string;
  assigned_hub_name?: string;
  is_active?: boolean;
  pin_code?: string;
  latitude: number;
  longitude: number;
  rating?: number;
  total_deliveries?: number;
  failed_deliveries?: number;
  active_tasks_count?: number;
  last_location_at?: string;
  created_at?: string;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  delivery_partner_id: string;
  partner_name?: string;
  partner_phone?: string;
  status: 'ASSIGNED' | 'DRIVER_ASSIGNED' | 'ACCEPTED' | 'READY_FOR_PICKUP' | 'HEADING_TO_STORE' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'DELIVERY_FAILED' | 'CANCELLED';
  assigned_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  dispatched_at?: string;
  failed_at?: string;
  failure_reason?: string;
  failure_notes?: string;
  estimated_delivery_time?: string;
  notes?: string;
  otp_code?: string;
  hub_id?: string;
}

export interface DeliveryDashboardKPIs {
  total_deliveries: number;
  pending_assignment: number;
  ready_for_dispatch: number;
  assigned_deliveries: number;
  out_for_delivery: number;
  delivered: number;
  failed: number;
  cancelled: number;
}

export interface DeliveryDashboardItem {
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  assigned_hub_id: string;
  assigned_hub_name: string;
  items: any[];
  subtotal: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  delivery_status: string;
  assignment_id: string | null;
  assigned_partner_id: string | null;
  assigned_partner_name: string | null;
  assigned_partner_phone: string | null;
  assigned_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  expected_delivery_time: string | null;
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
  confirmed_eta?: string;
  logistics_status?: string;
  delivery_status?: string;
  fulfillment_center?: string;
  package_type?: string;
  activities?: DeliveryTimelineEvent[];
  timeline?: any[];
  live_gps?: {
    latitude: number;
    longitude: number;
    recorded_at: string;
    status: 'live' | 'stale' | 'unavailable';
  } | null;
  delivery_person?: {
    name: string;
    phone: string;
    vehicle_type: string;
    vehicle_number: string;
    rating?: number;
    profile_image?: string;
  } | null;
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
    latitude: number | null;
    longitude: number | null;
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
  maximum_discount: number | null;
  usage_limit: number;
  usage_count: number;
  per_customer_limit: number;
  first_order_only?: boolean;
  applicable_hub_id?: string | null;
  applicable_category_id?: string | null;
  applicable_product_id?: string | null;
  start_date: string;
  end_date: string;
  status: 'active' | 'inactive' | 'paused';
  total_discount_given?: number;
  created_at?: string;
}

export interface CouponValidationResult {
  coupon: {
    id: string;
    code: string;
    name: string;
    discount_type: 'FLAT' | 'PERCENTAGE';
    discount_value: number;
    minimum_order_amount?: number;
    maximum_discount?: number | null;
    applicable_hub_id?: string | null;
    first_order_only?: boolean;
  };
  order_amount: number;
  discount_amount: number;
  final_amount: number;
  savings_message: string;
}

// ================= Phase 9: Hub Inventory Management =================
export interface HubInventoryItem {
  id: string;
  hub_id: string;
  hub_name?: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  sku?: string;
  category_name?: string;
  unit: string;
  selling_price: number;
  purchase_price?: number;
  stock_quantity: number;
  reserved_quantity: number;
  available_to_sell: number;
  minimum_stock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updated_at: string;
}

export interface InventorySummary {
  total_products: number;
  total_stock: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  total_inventory_value: number;
}

export interface HubStockMovement {
  id: string;
  hub_id: string;
  product_id: string;
  product_name?: string;
  variant_id?: string | null;
  previous_stock: number;
  new_stock: number;
  quantity_changed: number;
  operation_type: 'ADD' | 'REDUCE' | 'ADJUST' | 'CORRECTION' | 'ORDER_DEDUCT' | 'ORDER_CANCEL_RESTORE' | 'ORDER_FAILED_RESTORE' | 'SEED';
  reason: string;
  reference_type?: string;
  reference_id?: string;
  created_by?: string;
  created_at: string;
}

export interface LowStockAlert {
  alert_key: string;
  hub_id: string;
  hub_name: string;
  product_id: string;
  product_name: string;
  current_stock: number;
  minimum_stock: number;
  status: 'low_stock' | 'out_of_stock';
  alert_severity: 'CRITICAL' | 'WARNING';
  message: string;
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
  hub_filter?: string;
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
  hubs_breakdown?: Record<string, {
    hub_id: string;
    hub_code: string;
    name: string;
    address: string;
    total_orders: number;
    total_revenue: number;
    delivered_orders: number;
    pending_orders: number;
    cancelled_orders: number;
    cod_revenue: number;
    online_revenue: number;
    avg_order_value: number;
    active_deliveries: number;
    fleet_count: number;
  }>;
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
  coupon_analytics?: {
    total_coupons: number;
    active_coupons: number;
    total_discount_disbursed: number;
    total_redemptions: number;
    top_performing_coupon: string;
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
  min_eta_minutes?: number;
  max_eta_minutes?: number;
  priority?: 'high' | 'medium' | 'normal';
  daily_open_time?: string;
  daily_close_time?: string;
  max_capacity_per_slot?: number;
  is_paused?: boolean;
  pause_reason?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PAUSED';
  latitude?: number;
  longitude?: number;
}

export interface DeliveryEstimate {
  available: boolean;
  isPaused: boolean;
  globalStatus: 'available' | 'paused' | 'closed_for_today';
  etaText: string; // e.g. "30–45 MINS"
  minEtaMinutes: number;
  maxEtaMinutes: number;
  zoneName: string;
  priority?: string;
  pauseReason?: string;
  distanceKm?: number;
  statusMessage?: string;
}

export interface DeliverySettings {
  id?: string;
  default_delivery_charge: number;
  free_delivery_threshold: number;
  min_order_amount: number;
  enable_free_delivery: boolean;
  express_delivery_fee: number;
  estimated_delivery_time: string;
  min_eta_minutes?: number;
  max_eta_minutes?: number;
  is_delivery_active: boolean;
  global_delivery_status?: 'available' | 'paused' | 'closed_for_today';
  global_pause_reason?: string;
  global_reopen_at?: string | null;
  surge_charge: number;
  hub_name?: string;
  hub_address?: string;
  hub_latitude?: number | null;
  hub_longitude?: number | null;
  delivery_radius_km?: number;
  serviceability_enabled?: boolean;
  is_hub_configured?: boolean;
  updated_at?: string;

  // Real-time Delivery Slots & Operating Hours
  operating_hours_start?: string;
  operating_hours_end?: string;
  express_enabled?: boolean;
  express_start_time?: string;
  express_end_time?: string;
  morning_slot_enabled?: boolean;
  morning_slot_start?: string;
  morning_slot_end?: string;
  morning_slot_cutoff?: string;
  evening_slot_enabled?: boolean;
  evening_slot_start?: string;
  evening_slot_end?: string;
  evening_slot_cutoff?: string;
}

export interface ServiceabilityState {
  checked: boolean;
  configured: boolean;
  serviceable: boolean;
  is_delivery_active?: boolean;
  eta_text?: string;
  distanceKm?: number;
  radiusKm: number;
  message?: string;
  hubName?: string;
  hubAddress?: string;
  checking: boolean;
  zone?: DeliveryZone | null;
  coordinates?: { latitude: number; longitude: number } | null;
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

// ================= Phase 16: Customer Reviews & Ratings =================
export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  admin_notes?: string | null;
  reported_count?: number;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  product_name?: string;
  product_image?: string;
  order_number?: string;
}

export interface ReviewRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ReviewEligibilityResponse {
  eligible: boolean;
  message?: string;
  eligible_orders?: Array<{
    order_id: string;
    order_number: string;
    delivered_at: string;
  }>;
}


