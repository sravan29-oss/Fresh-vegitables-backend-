--
-- PostgreSQL database dump
--

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    full_name character varying(100) NOT NULL,
    phone character varying(15) NOT NULL,
    house_number character varying(100),
    street character varying(200),
    area character varying(200) NOT NULL,
    landmark character varying(200),
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    pincode character varying(10) NOT NULL,
    latitude double precision,
    longitude double precision,
    address_type character varying(20) DEFAULT 'home'::character varying,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT addresses_address_type_check CHECK (((address_type)::text = ANY ((ARRAY['home'::character varying, 'work'::character varying, 'other'::character varying])::text[])))
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'admin'::character varying,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admins_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::text[]))),
    CONSTRAINT admins_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    admin_email character varying(255),
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id character varying(100),
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.cart_items OWNER TO postgres;

--
-- Name: carts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.carts OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(120) NOT NULL,
    description text,
    image character varying(500),
    status character varying(20) DEFAULT 'active'::character varying,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT categories_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: coupon_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupon_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    order_id uuid NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.coupon_usage OWNER TO postgres;

--
-- Name: coupons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    minimum_order_amount numeric(10,2) DEFAULT 0,
    maximum_discount numeric(10,2),
    usage_limit integer DEFAULT 1000,
    usage_count integer DEFAULT 0,
    per_customer_limit integer DEFAULT 1,
    start_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_date timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.coupons OWNER TO postgres;

--
-- Name: delivery_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    delivery_partner_id uuid NOT NULL,
    status character varying(30) DEFAULT 'DRIVER_ASSIGNED'::character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    picked_up_at timestamp with time zone,
    delivered_at timestamp with time zone,
    estimated_delivery_time timestamp with time zone,
    notes text
);


ALTER TABLE public.delivery_assignments OWNER TO postgres;

--
-- Name: delivery_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(100),
    profile_image character varying(500),
    vehicle_type character varying(50) DEFAULT 'Bike'::character varying,
    vehicle_number character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'AVAILABLE'::character varying,
    availability boolean DEFAULT true,
    rating numeric(3,2) DEFAULT 4.8,
    latitude numeric(10,7) DEFAULT 23.0225,
    longitude numeric(10,7) DEFAULT 72.5714,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.delivery_partners OWNER TO postgres;

--
-- Name: delivery_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    status character varying(50) NOT NULL,
    latitude numeric(10,7),
    longitude numeric(10,7),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.delivery_status_history OWNER TO postgres;

--
-- Name: delivery_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    pincodes text[] DEFAULT '{}'::text[] NOT NULL,
    delivery_radius_km numeric(6,2) DEFAULT 10.0,
    delivery_fee numeric(10,2) DEFAULT 25.00,
    min_order_amount numeric(10,2) DEFAULT 199.00,
    free_delivery_threshold numeric(10,2) DEFAULT 499.00,
    estimated_delivery_time character varying(50) DEFAULT '30–45 mins'::character varying,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    latitude numeric(10,7),
    longitude numeric(10,7),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT delivery_zones_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


ALTER TABLE public.delivery_zones OWNER TO postgres;

--
-- Name: homepage_banners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homepage_banners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid,
    title character varying(255) NOT NULL,
    subtitle character varying(255),
    image character varying(500) NOT NULL,
    link character varying(255),
    badge character varying(100),
    display_order integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.homepage_banners OWNER TO postgres;

--
-- Name: homepage_section_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homepage_section_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    item_type character varying(50) NOT NULL,
    item_id uuid,
    display_order integer DEFAULT 0,
    custom_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.homepage_section_items OWNER TO postgres;

--
-- Name: homepage_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.homepage_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    subtitle character varying(255),
    description text,
    image character varying(500),
    button_text character varying(100),
    button_link character varying(255),
    display_order integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    configuration jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT homepage_sections_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'scheduled'::character varying])::text[])))
);


ALTER TABLE public.homepage_sections OWNER TO postgres;

--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    points_balance integer DEFAULT 0,
    lifetime_points_earned integer DEFAULT 0,
    tier character varying(20) DEFAULT 'BRONZE'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT loyalty_accounts_points_balance_check CHECK ((points_balance >= 0)),
    CONSTRAINT loyalty_accounts_tier_check CHECK (((tier)::text = ANY ((ARRAY['BRONZE'::character varying, 'SILVER'::character varying, 'GOLD'::character varying, 'PLATINUM'::character varying])::text[])))
);


ALTER TABLE public.loyalty_accounts OWNER TO postgres;

--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loyalty_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    loyalty_account_id uuid NOT NULL,
    points integer NOT NULL,
    type character varying(50) NOT NULL,
    reference_id character varying(100),
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.loyalty_transactions OWNER TO postgres;

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    title_template character varying(200) NOT NULL,
    message_template text NOT NULL,
    type character varying(50) NOT NULL,
    channel character varying(50) DEFAULT 'IN_APP'::character varying
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    reference_type character varying(50),
    reference_id character varying(100),
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    product_name_snapshot character varying(200) NOT NULL,
    unit_snapshot character varying(50) NOT NULL,
    price_snapshot numeric(10,2) NOT NULL,
    mrp_snapshot numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    total numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_seller_fulfillments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_seller_fulfillments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    fulfillment_status character varying(30) DEFAULT 'PENDING'::character varying,
    commission_amount numeric(10,2) DEFAULT 0,
    seller_earnings numeric(10,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT order_seller_fulfillments_fulfillment_status_check CHECK (((fulfillment_status)::text = ANY ((ARRAY['PENDING'::character varying, 'CONFIRMED'::character varying, 'PREPARING'::character varying, 'READY_FOR_PICKUP'::character varying, 'DISPATCHED'::character varying, 'DELIVERED'::character varying])::text[])))
);


ALTER TABLE public.order_seller_fulfillments OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_number character varying(20) NOT NULL,
    user_id uuid NOT NULL,
    address_snapshot jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    delivery_charge numeric(10,2) DEFAULT 0,
    discount numeric(10,2) DEFAULT 0,
    tax numeric(10,2) DEFAULT 0,
    total numeric(10,2) NOT NULL,
    payment_method character varying(30) DEFAULT 'cod'::character varying,
    payment_status character varying(20) DEFAULT 'pending'::character varying,
    order_status character varying(30) DEFAULT 'pending'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orders_order_status_check CHECK (((order_status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'preparing'::character varying, 'packed'::character varying, 'out_for_delivery'::character varying, 'delivered'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT orders_payment_method_check CHECK (((payment_method)::text = ANY ((ARRAY['cod'::character varying, 'online'::character varying, 'upi'::character varying, 'wallet'::character varying])::text[]))),
    CONSTRAINT orders_payment_status_check CHECK (((payment_status)::text = ANY ((ARRAY['pending'::character varying, 'paid'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    transaction_type character varying(30) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(30) NOT NULL,
    gateway_response jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_id uuid NOT NULL,
    method character varying(30) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    transaction_id character varying(200),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying, 'refunded'::character varying])::text[])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    unit character varying(50) NOT NULL,
    mrp numeric(10,2) NOT NULL,
    selling_price numeric(10,2) NOT NULL,
    stock_quantity integer DEFAULT 0,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT product_variants_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(220) NOT NULL,
    category_id uuid,
    description text,
    images text[] DEFAULT '{}'::text[],
    unit character varying(50) DEFAULT '1kg'::character varying,
    mrp numeric(10,2) NOT NULL,
    selling_price numeric(10,2) NOT NULL,
    purchase_price numeric(10,2) DEFAULT 0,
    stock_quantity integer DEFAULT 0,
    minimum_stock integer DEFAULT 5,
    status character varying(20) DEFAULT 'active'::character varying,
    featured boolean DEFAULT false,
    best_seller boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    seller_id uuid,
    seo_title character varying(255),
    seo_description text,
    seo_keywords text,
    canonical_url character varying(500),
    google_category character varying(150),
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: referral_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    reward_amount numeric(10,2) DEFAULT 50.00,
    referee_discount numeric(10,2) DEFAULT 50.00,
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.referral_codes OWNER TO postgres;

--
-- Name: referral_rewards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referral_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referral_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    reward_type character varying(30) DEFAULT 'WALLET_CREDIT'::character varying,
    status character varying(20) DEFAULT 'PROCESSED'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT referral_rewards_reward_type_check CHECK (((reward_type)::text = ANY ((ARRAY['WALLET_CREDIT'::character varying, 'LOYALTY_POINTS'::character varying])::text[]))),
    CONSTRAINT referral_rewards_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.referral_rewards OWNER TO postgres;

--
-- Name: referrals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referee_id uuid NOT NULL,
    referral_code character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    qualifying_order_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    rewarded_at timestamp with time zone,
    CONSTRAINT referrals_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'QUALIFIED'::character varying, 'REWARDED'::character varying])::text[])))
);


ALTER TABLE public.referrals OWNER TO postgres;

--
-- Name: refunds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refunds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_id uuid NOT NULL,
    order_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    reason text NOT NULL,
    status character varying(30) DEFAULT 'PROCESSING'::character varying NOT NULL,
    gateway_refund_id character varying(100),
    processed_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.refunds OWNER TO postgres;

--
-- Name: seller_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seller_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    commission_deducted numeric(10,2) NOT NULL,
    net_payout numeric(10,2) NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status character varying(20) DEFAULT 'PROCESSED'::character varying,
    payment_reference character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT seller_payouts_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSED'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.seller_payouts OWNER TO postgres;

--
-- Name: sellers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sellers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_name character varying(150) NOT NULL,
    owner_name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(100),
    address text NOT NULL,
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    pincode character varying(10) NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    verification_status character varying(20) DEFAULT 'PENDING'::character varying,
    commission_percentage numeric(5,2) DEFAULT 10.00,
    bank_account_details jsonb DEFAULT '{}'::jsonb,
    rating numeric(3,2) DEFAULT 4.9,
    total_orders integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sellers_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying])::text[]))),
    CONSTRAINT sellers_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.sellers OWNER TO postgres;

--
-- Name: store_delivery_zones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_delivery_zones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    zone_id uuid NOT NULL
);


ALTER TABLE public.store_delivery_zones OWNER TO postgres;

--
-- Name: store_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_inventory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    product_id uuid NOT NULL,
    stock_quantity integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.store_inventory OWNER TO postgres;

--
-- Name: store_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.store_settings (
    id character varying(50) DEFAULT 'global_store_settings'::character varying NOT NULL,
    support_phone character varying(50) DEFAULT '+91 8106970384'::character varying,
    support_email character varying(100) DEFAULT 'care@freshveggies.com'::character varying,
    announcement_text character varying(255) DEFAULT 'Same-Day Farm Delivery available for orders before 2:00 PM'::character varying,
    store_address character varying(255) DEFAULT 'Sector 14 Central Depot, Agro Valley'::character varying,
    quality_badge character varying(100) DEFAULT '⚡ 100% Residue-Free & Organic'::character varying,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.store_settings OWNER TO postgres;

--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    address text NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(100),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stores_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: subscription_deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    order_id uuid,
    scheduled_date date NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_deliveries_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'GENERATED'::character varying, 'SKIPPED'::character varying, 'CANCELLED'::character varying])::text[])))
);


ALTER TABLE public.subscription_deliveries OWNER TO postgres;

--
-- Name: subscription_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscription_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.subscription_items OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    address_id uuid,
    status character varying(30) DEFAULT 'ACTIVE'::character varying,
    frequency character varying(20) NOT NULL,
    delivery_day character varying(20),
    delivery_time_slot character varying(50) DEFAULT '06:00 AM - 08:00 AM'::character varying,
    start_date date DEFAULT CURRENT_DATE NOT NULL,
    next_delivery_date date NOT NULL,
    end_date date,
    payment_method character varying(30) DEFAULT 'wallet'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT subscriptions_frequency_check CHECK (((frequency)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'MONTHLY'::character varying])::text[]))),
    CONSTRAINT subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'PAUSED'::character varying, 'SKIPPED'::character varying, 'CANCELLED'::character varying, 'COMPLETED'::character varying])::text[])))
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255),
    mobile character varying(15),
    password character varying(255) NOT NULL,
    avatar character varying(500),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'blocked'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallet_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallet_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    wallet_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    transaction_type character varying(30) NOT NULL,
    balance_after numeric(10,2) NOT NULL,
    reference_type character varying(50),
    reference_id character varying(100),
    description text,
    status character varying(20) DEFAULT 'SUCCESS'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wallet_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['SUCCESS'::character varying, 'PENDING'::character varying, 'FAILED'::character varying])::text[])))
);


ALTER TABLE public.wallet_transactions OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(10,2) DEFAULT 0.00,
    currency character varying(10) DEFAULT 'INR'::character varying,
    is_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wallets_balance_check CHECK ((balance >= (0)::numeric))
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.addresses (id, user_id, full_name, phone, house_number, street, area, landmark, city, state, pincode, latitude, longitude, address_type, is_default, created_at, updated_at) FROM stdin;
9d066b2b-bc1b-4fa0-b56f-d09f2f0cab1b	7b07bdb9-01f3-47d8-ad6d-0a3ac27c696c	Sravan Kumar Naredla	8106970384	102	\N	KPHB Colony	\N	Hyderabad	Telangana	500072	\N	\N	home	t	2026-10-26 00:27:37.971278+05:30	2026-10-26 00:27:37.971278+05:30
d6e57728-176c-4392-90c1-5ef56c1a8b0e	a1be6f5c-c4cd-4ae6-91e4-562bd9e758c7	Super Admin	9876543210	102	\N	KPHB Colony	\N	Hyderabad	Telangana	500072	\N	\N	home	t	2026-10-26 09:38:52.252942+05:30	2026-10-26 09:38:52.252942+05:30
d8483b58-42eb-418b-8a2d-b872b6f4b0a4	e1f484b5-32ee-49b0-8035-cf59932ed818	Admin	9876543211	102	\N	KPHB Colony	\N	Hyderabad	Telangana	500072	\N	\N	home	t	2026-10-26 09:39:22.33857+05:30	2026-10-26 09:39:22.33857+05:30
\.


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (id, name, email, password, role, status, created_at, updated_at) FROM stdin;
a1be6f5c-c4cd-4ae6-91e4-562bd9e758c7	Super Admin	admin@freshvegetables.com	$2b$10$yF/l68rr7iGpaGQMgl8XiuFPf2vytH.y4fYID1pdNZ.GNxPIBXsla	super_admin	active	2026-10-25 21:31:09.344547+05:30	2026-10-25 23:08:52.161454+05:30
e1f484b5-32ee-49b0-8035-cf59932ed818	Admin	admin@freshveggies.com	$2b$10$yF/l68rr7iGpaGQMgl8XiuFPf2vytH.y4fYID1pdNZ.GNxPIBXsla	admin	active	2026-10-25 21:31:09.344547+05:30	2026-10-25 23:08:52.161454+05:30
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, admin_id, admin_email, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at) FROM stdin;
662ece5b-e960-4909-89e0-96b61bcd093d	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	HOMEPAGE_SECTION_STATUS_TOGGLED	homepage_section	7ab1ab70-a489-45c1-a259-3f476bafafd2	\N	{"status": "inactive"}	::1	API-Client	2026-10-25 21:40:06.844688+05:30
cac6195b-041f-4e9f-b7e7-17ad900f456a	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	HOMEPAGE_SECTION_STATUS_TOGGLED	homepage_section	7ab1ab70-a489-45c1-a259-3f476bafafd2	\N	{"status": "active"}	::1	API-Client	2026-10-25 21:40:06.858727+05:30
ba57d6e9-fad5-412d-bc99-646a54a06661	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	HOMEPAGE_SECTION_STATUS_TOGGLED	homepage_section	7ab1ab70-a489-45c1-a259-3f476bafafd2	\N	{"status": "inactive"}	::1	API-Client	2026-10-25 21:42:18.410269+05:30
c755a947-ebed-45fd-aecf-f70e2c684693	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	HOMEPAGE_SECTION_STATUS_TOGGLED	homepage_section	7ab1ab70-a489-45c1-a259-3f476bafafd2	\N	{"status": "active"}	::1	API-Client	2026-10-25 21:42:18.423259+05:30
2414cb4f-1fef-4c9b-a052-ca6d5cc414c2	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	DELIVERY_ZONE_CREATED	delivery_zone	e13b02f3-8b3a-4944-8fff-5fca4301dd58	\N	{"id": "e13b02f3-8b3a-4944-8fff-5fca4301dd58", "name": "Jammikunta ", "status": "ACTIVE", "latitude": 17.4474, "pincodes": ["505122"], "longitude": 78.3762, "created_at": "2026-10-25T18:44:40.436Z", "updated_at": "2026-10-25T18:44:40.436Z", "delivery_fee": 20, "min_order_amount": 199, "delivery_radius_km": 10, "estimated_delivery_time": "25–35 mins", "free_delivery_threshold": 199}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-10-26 00:14:40.667551+05:30
9dabf102-f208-49cd-bcb9-ca745619b22d	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	DELIVERY_ZONE_DELETED	delivery_zone	zone-miyapur	{"id": "zone-miyapur", "name": "Miyapur, Chandanagar & BHEL", "status": "ACTIVE", "latitude": 17.4968, "pincodes": ["500049", "500050", "500019"], "longitude": 78.3547, "created_at": "2024-01-01T00:00:00.000Z", "updated_at": "2026-10-25T18:16:10.922Z", "delivery_fee": 25, "min_order_amount": 249, "delivery_radius_km": 9, "estimated_delivery_time": "35–45 mins", "free_delivery_threshold": 549}	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-10-26 00:15:27.198475+05:30
7879bb1d-52dc-4ab7-b4b9-f269e249319a	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	DELIVERY_ZONE_DELETED	delivery_zone	e13b02f3-8b3a-4944-8fff-5fca4301dd58	{"id": "e13b02f3-8b3a-4944-8fff-5fca4301dd58", "name": "Jammikunta ", "status": "ACTIVE", "latitude": 17.4474, "pincodes": ["505122"], "longitude": 78.3762, "created_at": "2026-10-25T18:44:40.436Z", "updated_at": "2026-10-25T18:44:40.436Z", "delivery_fee": 20, "min_order_amount": 199, "delivery_radius_km": 10, "estimated_delivery_time": "25–35 mins", "free_delivery_threshold": 199}	\N	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-10-26 00:27:00.72357+05:30
d61390d1-7aa1-46b8-8030-b90222e94b17	e1f484b5-32ee-49b0-8035-cf59932ed818	admin@freshveggies.com	DELIVERY_SETTINGS_UPDATED	delivery_settings	global_delivery_settings	{"id": "global_delivery_settings", "updated_at": "2026-10-26T17:05:23.966Z", "surge_charge": 0, "min_order_amount": 199, "is_delivery_active": true, "enable_free_delivery": true, "express_delivery_fee": 45, "default_delivery_charge": 30, "estimated_delivery_time": "25–35 mins", "free_delivery_threshold": 499}	{"id": "global_delivery_settings", "updated_at": "2026-10-27T04:38:49.919Z", "surge_charge": 0, "min_order_amount": 199, "is_delivery_active": true, "enable_free_delivery": true, "express_delivery_fee": 45, "default_delivery_charge": 30, "estimated_delivery_time": "25–35 mins", "free_delivery_threshold": 499}	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36	2026-10-27 10:08:50.224858+05:30
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cart_items (id, cart_id, product_id, variant_id, quantity, created_at, updated_at) FROM stdin;
2b085cca-7460-41a7-9dff-5b8ce7aa50a1	94a16d42-1078-4441-89bc-b7d40fb97816	faf5d663-3868-40a9-8933-ed0560ec4c53	\N	1	2026-10-27 10:08:26.069227+05:30	2026-10-27 10:08:26.069227+05:30
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (id, user_id, created_at, updated_at) FROM stdin;
94a16d42-1078-4441-89bc-b7d40fb97816	7b07bdb9-01f3-47d8-ad6d-0a3ac27c696c	2026-10-26 00:12:14.561306+05:30	2026-10-26 00:12:14.561306+05:30
932fca27-1f9d-4e3c-8838-12dc664dbeda	a1be6f5c-c4cd-4ae6-91e4-562bd9e758c7	2026-10-26 09:38:52.237527+05:30	2026-10-26 09:38:52.237527+05:30
f5040d14-2366-4f2d-ac32-a1f8813b4886	e1f484b5-32ee-49b0-8035-cf59932ed818	2026-10-26 09:39:22.333621+05:30	2026-10-26 09:39:22.333621+05:30
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, slug, description, image, status, display_order, created_at, updated_at) FROM stdin;
8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd	Fresh	fresh	\N	\N	active	1	2026-10-27 09:48:03.988884+05:30	2026-10-27 09:48:03.988884+05:30
\.


--
-- Data for Name: coupon_usage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coupon_usage (id, coupon_id, user_id, order_id, discount_amount, used_at) FROM stdin;
\.


--
-- Data for Name: coupons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.coupons (id, code, name, description, discount_type, discount_value, minimum_order_amount, maximum_discount, usage_limit, usage_count, per_customer_limit, start_date, end_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: delivery_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_assignments (id, order_id, delivery_partner_id, status, assigned_at, picked_up_at, delivered_at, estimated_delivery_time, notes) FROM stdin;
\.


--
-- Data for Name: delivery_partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_partners (id, name, phone, email, profile_image, vehicle_type, vehicle_number, status, availability, rating, latitude, longitude, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: delivery_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_status_history (id, assignment_id, status, latitude, longitude, "timestamp") FROM stdin;
\.


--
-- Data for Name: delivery_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_zones (id, name, pincodes, delivery_radius_km, delivery_fee, min_order_amount, free_delivery_threshold, estimated_delivery_time, status, latitude, longitude, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: homepage_banners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.homepage_banners (id, section_id, title, subtitle, image, link, badge, display_order, status, created_at) FROM stdin;
aca12cf9-896a-434a-92e1-9b1308c0de76	7ab1ab70-a489-45c1-a259-3f476bafafd2	Monsoon Farm Specials	Flat 20% OFF on all Green Leafy Veggies	https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200	/products?category=leafy-greens	Seasonal Pick	9	active	2026-10-25 21:42:18.429077+05:30
\.


--
-- Data for Name: homepage_section_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.homepage_section_items (id, section_id, item_type, item_id, display_order, custom_data, created_at) FROM stdin;
\.


--
-- Data for Name: homepage_sections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.homepage_sections (id, type, title, subtitle, description, image, button_text, button_link, display_order, status, start_date, end_date, configuration, created_at, updated_at) FROM stdin;
92812928-41ae-496c-b26d-fa9d56e26eb2	categories	Shop by Harvest Category	Farm Categories	\N	\N	\N	\N	1	active	\N	\N	{}	2026-10-25 23:30:24.932613+05:30	2026-10-25 23:30:24.932613+05:30
b7d9058b-bea7-4d08-a085-97bd151acdc3	featured_products	Handpicked Fresh Today	Harvest Highlights	\N	\N	\N	\N	2	active	\N	\N	{}	2026-10-25 23:30:24.938096+05:30	2026-10-25 23:30:24.938096+05:30
7f230f2a-04e4-4b95-8223-cc82cb9f2aaa	best_sellers	Top Community Favorites	Most Ordered	\N	\N	\N	\N	3	active	\N	\N	{}	2026-10-25 23:30:24.941063+05:30	2026-10-25 23:30:24.941063+05:30
2478c62f-fdbd-4d20-9298-11ab7e248bfe	promotional_banner	Super Saver Monsoon Sale	Flat 20% OFF with code FRESH20	Enjoy handpicked crispy leafy greens and root vegetables at unbeatable prices.	\N	\N	\N	4	active	\N	\N	{"coupon_code": "FRESH20"}	2026-10-25 23:30:24.944899+05:30	2026-10-25 23:30:24.944899+05:30
cbba3154-aac5-449d-a202-1b9554fe707c	why_choose_us	Why Choose Fresh Vegetables?	The Pure Farm Promise	\N	\N	\N	\N	5	active	\N	\N	{}	2026-10-25 23:30:24.946947+05:30	2026-10-25 23:30:24.946947+05:30
8134db0f-d1ba-434a-bc6b-3e56af918de7	testimonials	Trusted by Over 50,000+ Homes	Real Reviews	\N	\N	\N	\N	6	active	\N	\N	{}	2026-10-25 23:30:24.948855+05:30	2026-10-25 23:30:24.948855+05:30
ad6316af-0889-408c-be24-26fddfd288c1	app_promotion	Freshness on the Go	Download Our App	\N	\N	\N	\N	7	active	\N	\N	{}	2026-10-25 23:30:24.950775+05:30	2026-10-25 23:30:24.950775+05:30
7ab1ab70-a489-45c1-a259-3f476bafafd2	hero_banner	Freshness from Nature to Your Table	100% Certified Organic • Chemical Free Harvest	Discover fresh vegetables and bring the goodness of nature into your everyday meals.	\N	Explore Fresh Vegetables	/products	0	active	\N	\N	{}	2026-10-25 21:26:11.49283+05:30	2026-10-25 21:42:18.421636+05:30
\.


--
-- Data for Name: loyalty_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loyalty_accounts (id, user_id, points_balance, lifetime_points_earned, tier, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: loyalty_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loyalty_transactions (id, loyalty_account_id, points, type, reference_id, description, created_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_templates (id, code, title_template, message_template, type, channel) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, user_id, title, message, type, reference_type, reference_id, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, variant_id, product_name_snapshot, unit_snapshot, price_snapshot, mrp_snapshot, quantity, total, created_at) FROM stdin;
\.


--
-- Data for Name: order_seller_fulfillments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_seller_fulfillments (id, order_id, seller_id, fulfillment_status, commission_amount, seller_earnings, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_number, user_id, address_snapshot, subtotal, delivery_charge, discount, tax, total, payment_method, payment_status, order_status, notes, created_at, updated_at) FROM stdin;
d3dc44ec-d944-4342-b85c-4549bf26bc2f	FVMVOW8C2PELS7	7b07bdb9-01f3-47d8-ad6d-0a3ac27c696c	{"area": "KPHB Colony", "city": "Hyderabad", "phone": "8106970384", "state": "Telangana", "street": null, "pincode": "500072", "landmark": null, "full_name": "Sravan Kumar Naredla", "address_type": "home", "house_number": "102"}	50.00	30.00	0.00	0.00	80.00	cod	pending	confirmed	Slot: evening.  	2026-10-26 12:16:27.325361+05:30	2026-10-26 12:16:43.282319+05:30
\.


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_transactions (id, payment_id, transaction_type, amount, status, gateway_response, created_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, method, amount, status, transaction_id, metadata, created_at, updated_at) FROM stdin;
7b1d98f7-950a-4f87-a89a-2ef10e9aae0b	d3dc44ec-d944-4342-b85c-4549bf26bc2f	cod	80.00	pending	\N	\N	2026-10-26 12:16:27.325361+05:30	2026-10-26 12:16:27.325361+05:30
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_variants (id, product_id, name, unit, mrp, selling_price, stock_quantity, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, name, slug, category_id, description, images, unit, mrp, selling_price, purchase_price, stock_quantity, minimum_stock, status, featured, best_seller, created_at, updated_at, seller_id, seo_title, seo_description, seo_keywords, canonical_url, google_category) FROM stdin;
faf5d663-3868-40a9-8933-ed0560ec4c53	Tomato	tomato	8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd		{/uploads/products/e617cc8b-b81d-4b2c-b622-8c9cc407fd85.webp}	500grms	28.00	25.00	0.00	5	5	active	t	t	2026-10-27 09:49:15.140763+05:30	2026-10-27 09:54:43.313344+05:30	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: referral_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referral_codes (id, user_id, code, reward_amount, referee_discount, usage_count, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: referral_rewards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referral_rewards (id, referral_id, user_id, amount, reward_type, status, created_at) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.referrals (id, referrer_id, referee_id, referral_code, status, qualifying_order_id, created_at, rewarded_at) FROM stdin;
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refunds (id, payment_id, order_id, amount, reason, status, gateway_refund_id, processed_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: seller_payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.seller_payouts (id, seller_id, amount, commission_deducted, net_payout, period_start, period_end, status, payment_reference, created_at) FROM stdin;
\.


--
-- Data for Name: sellers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sellers (id, business_name, owner_name, phone, email, address, city, state, pincode, status, verification_status, commission_percentage, bank_account_details, rating, total_orders, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: store_delivery_zones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.store_delivery_zones (id, store_id, zone_id) FROM stdin;
\.


--
-- Data for Name: store_inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.store_inventory (id, store_id, product_id, stock_quantity, updated_at) FROM stdin;
\.


--
-- Data for Name: store_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.store_settings (id, support_phone, support_email, announcement_text, store_address, quality_badge, updated_at) FROM stdin;
global_store_settings	+91 8106970384	care@freshveggies.com	Same-Day Farm Delivery available for orders before 2:00 PM	Sector 14 Central Depot, Agro Valley	⚡ 100% Residue-Free & Organic	2026-10-27 11:44:37.237477+05:30
\.


--
-- Data for Name: stores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stores (id, name, address, latitude, longitude, phone, email, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: subscription_deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_deliveries (id, subscription_id, order_id, scheduled_date, status, notes, created_at) FROM stdin;
\.


--
-- Data for Name: subscription_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscription_items (id, subscription_id, product_id, variant_id, quantity, unit_price, created_at) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, user_id, address_id, status, frequency, delivery_day, delivery_time_slot, start_date, next_delivery_date, end_date, payment_method, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, mobile, password, avatar, status, created_at, updated_at) FROM stdin;
7b07bdb9-01f3-47d8-ad6d-0a3ac27c696c	Sravan Kumar Naredla	naredlasravankumar29@gmail.com	8106970384	$2b$10$FCuyU8rRCBOwrCqE7UmlouyXh8PINaEPPZNQZlDqcWuTAB.XAogK.	\N	active	2026-10-26 00:12:14.543662+05:30	2026-10-26 00:12:14.543662+05:30
a1be6f5c-c4cd-4ae6-91e4-562bd9e758c7	Super Admin	admin@freshvegetables.com	9876543210	$2b$10$yF/l68rr7iGpaGQMgl8XiuFPf2vytH.y4fYID1pdNZ.GNxPIBXsla	\N	active	2026-10-26 09:38:52.233902+05:30	2026-10-26 09:39:22.312991+05:30
e1f484b5-32ee-49b0-8035-cf59932ed818	Admin	admin@freshveggies.com	9876543211	$2b$10$yF/l68rr7iGpaGQMgl8XiuFPf2vytH.y4fYID1pdNZ.GNxPIBXsla	\N	active	2026-10-26 09:39:22.332174+05:30	2026-10-26 09:39:22.332174+05:30
\.


--
-- Data for Name: wallet_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallet_transactions (id, wallet_id, amount, transaction_type, balance_after, reference_type, reference_id, description, status, created_at) FROM stdin;
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, currency, is_locked, created_at, updated_at) FROM stdin;
\.


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_cart_id_product_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_product_id_variant_id_key UNIQUE (cart_id, product_id, variant_id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: carts carts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_key UNIQUE (user_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: coupon_usage coupon_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: delivery_assignments delivery_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_pkey PRIMARY KEY (id);


--
-- Name: delivery_partners delivery_partners_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_email_key UNIQUE (email);


--
-- Name: delivery_partners delivery_partners_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_phone_key UNIQUE (phone);


--
-- Name: delivery_partners delivery_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_partners
    ADD CONSTRAINT delivery_partners_pkey PRIMARY KEY (id);


--
-- Name: delivery_status_history delivery_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_status_history
    ADD CONSTRAINT delivery_status_history_pkey PRIMARY KEY (id);


--
-- Name: delivery_zones delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_zones
    ADD CONSTRAINT delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: homepage_banners homepage_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homepage_banners
    ADD CONSTRAINT homepage_banners_pkey PRIMARY KEY (id);


--
-- Name: homepage_section_items homepage_section_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homepage_section_items
    ADD CONSTRAINT homepage_section_items_pkey PRIMARY KEY (id);


--
-- Name: homepage_sections homepage_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homepage_sections
    ADD CONSTRAINT homepage_sections_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_key UNIQUE (user_id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_code_key UNIQUE (code);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_seller_fulfillments order_seller_fulfillments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_seller_fulfillments
    ADD CONSTRAINT order_seller_fulfillments_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: referral_codes referral_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_code_key UNIQUE (code);


--
-- Name: referral_codes referral_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (id);


--
-- Name: referral_codes referral_codes_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_user_id_key UNIQUE (user_id);


--
-- Name: referral_rewards referral_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referee_id_key UNIQUE (referee_id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: seller_payouts seller_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_payouts
    ADD CONSTRAINT seller_payouts_pkey PRIMARY KEY (id);


--
-- Name: sellers sellers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_email_key UNIQUE (email);


--
-- Name: sellers sellers_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_phone_key UNIQUE (phone);


--
-- Name: sellers sellers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sellers
    ADD CONSTRAINT sellers_pkey PRIMARY KEY (id);


--
-- Name: store_delivery_zones store_delivery_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_delivery_zones
    ADD CONSTRAINT store_delivery_zones_pkey PRIMARY KEY (id);


--
-- Name: store_delivery_zones store_delivery_zones_store_id_zone_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_delivery_zones
    ADD CONSTRAINT store_delivery_zones_store_id_zone_id_key UNIQUE (store_id, zone_id);


--
-- Name: store_inventory store_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_pkey PRIMARY KEY (id);


--
-- Name: store_inventory store_inventory_store_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_store_id_product_id_key UNIQUE (store_id, product_id);


--
-- Name: store_settings store_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_settings
    ADD CONSTRAINT store_settings_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: subscription_deliveries subscription_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_deliveries
    ADD CONSTRAINT subscription_deliveries_pkey PRIMARY KEY (id);


--
-- Name: subscription_items subscription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_mobile_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_mobile_key UNIQUE (mobile);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wallet_transactions wallet_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- Name: idx_addresses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_addresses_user ON public.addresses USING btree (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_cart_items_cart; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cart_items_cart ON public.cart_items USING btree (cart_id);


--
-- Name: idx_cart_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cart_items_product ON public.cart_items USING btree (product_id);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_categories_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_categories_status ON public.categories USING btree (status);


--
-- Name: idx_delivery_zones_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_delivery_zones_status ON public.delivery_zones USING btree (status);


--
-- Name: idx_homepage_banners_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_homepage_banners_section ON public.homepage_banners USING btree (section_id);


--
-- Name: idx_homepage_sections_status_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_homepage_sections_status_order ON public.homepage_sections USING btree (status, display_order);


--
-- Name: idx_loyalty_accounts_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_loyalty_accounts_user ON public.loyalty_accounts USING btree (user_id);


--
-- Name: idx_loyalty_transactions_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_loyalty_transactions_account ON public.loyalty_transactions USING btree (loyalty_account_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (order_status);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);


--
-- Name: idx_products_best_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_best_seller ON public.products USING btree (best_seller) WHERE (best_seller = true);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_featured ON public.products USING btree (featured) WHERE (featured = true);


--
-- Name: idx_products_search; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search ON public.products USING gin (to_tsvector('english'::regconfig, (((name)::text || ' '::text) || COALESCE(description, ''::text))));


--
-- Name: idx_products_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_seller ON public.products USING btree (seller_id);


--
-- Name: idx_products_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_slug ON public.products USING btree (slug);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_referral_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referral_codes_code ON public.referral_codes USING btree (code);


--
-- Name: idx_referrals_referee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referrals_referee ON public.referrals USING btree (referee_id);


--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);


--
-- Name: idx_sellers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sellers_status ON public.sellers USING btree (status);


--
-- Name: idx_subscriptions_next_delivery; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_next_delivery ON public.subscriptions USING btree (next_delivery_date) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_wallet_transactions_wallet; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallet_transactions_wallet ON public.wallet_transactions USING btree (wallet_id);


--
-- Name: idx_wallets_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wallets_user ON public.wallets USING btree (user_id);


--
-- Name: addresses trigger_update_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admins trigger_update_admins_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_admins_updated_at BEFORE UPDATE ON public.admins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cart_items trigger_update_cart_items_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carts trigger_update_carts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_carts_updated_at BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories trigger_update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders trigger_update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payments trigger_update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: product_variants trigger_update_product_variants_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products trigger_update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users trigger_update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(id) ON DELETE SET NULL;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: coupon_usage coupon_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coupon_usage
    ADD CONSTRAINT coupon_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: delivery_assignments delivery_assignments_delivery_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);


--
-- Name: delivery_assignments delivery_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_assignments
    ADD CONSTRAINT delivery_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: delivery_status_history delivery_status_history_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_status_history
    ADD CONSTRAINT delivery_status_history_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.delivery_assignments(id) ON DELETE CASCADE;


--
-- Name: homepage_banners homepage_banners_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homepage_banners
    ADD CONSTRAINT homepage_banners_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.homepage_sections(id) ON DELETE CASCADE;


--
-- Name: homepage_section_items homepage_section_items_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.homepage_section_items
    ADD CONSTRAINT homepage_section_items_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.homepage_sections(id) ON DELETE CASCADE;


--
-- Name: loyalty_accounts loyalty_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_loyalty_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_loyalty_account_id_fkey FOREIGN KEY (loyalty_account_id) REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: order_seller_fulfillments order_seller_fulfillments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_seller_fulfillments
    ADD CONSTRAINT order_seller_fulfillments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_seller_fulfillments order_seller_fulfillments_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_seller_fulfillments
    ADD CONSTRAINT order_seller_fulfillments_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: payment_transactions payment_transactions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE SET NULL;


--
-- Name: referral_codes referral_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referral_rewards referral_rewards_referral_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_referral_id_fkey FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE CASCADE;


--
-- Name: referral_rewards referral_rewards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referral_rewards
    ADD CONSTRAINT referral_rewards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_qualifying_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_qualifying_order_id_fkey FOREIGN KEY (qualifying_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: referrals referrals_referee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.admins(id);


--
-- Name: seller_payouts seller_payouts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seller_payouts
    ADD CONSTRAINT seller_payouts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.sellers(id) ON DELETE CASCADE;


--
-- Name: store_delivery_zones store_delivery_zones_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_delivery_zones
    ADD CONSTRAINT store_delivery_zones_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: store_delivery_zones store_delivery_zones_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_delivery_zones
    ADD CONSTRAINT store_delivery_zones_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.delivery_zones(id) ON DELETE CASCADE;


--
-- Name: store_inventory store_inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: store_inventory store_inventory_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.store_inventory
    ADD CONSTRAINT store_inventory_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: subscription_deliveries subscription_deliveries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_deliveries
    ADD CONSTRAINT subscription_deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: subscription_deliveries subscription_deliveries_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_deliveries
    ADD CONSTRAINT subscription_deliveries_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_items subscription_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: subscription_items subscription_items_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscription_items subscription_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_items
    ADD CONSTRAINT subscription_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wallet_transactions wallet_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallet_transactions
    ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE CASCADE;


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

