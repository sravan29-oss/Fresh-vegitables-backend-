import { Pool } from 'pg';
import { env } from './env';
import { memoryStore } from './mockDb';
import { v4 as uuidv4 } from 'uuid';
import { getPersistedDeliverySettings, savePersistedDeliverySettings } from '../services/deliverySettings.service';
import { savePersistedProducts, savePersistedVariants, getPersistedProducts, getPersistedVariants } from '../services/productStore.service';
import { savePersistedOrders, savePersistedOrderItems, getPersistedOrders } from '../services/orderStore.service';
import { getPersistedZones, savePersistedZones } from '../services/zoneStore.service';

const isLocalhost =
  env.DATABASE_URL.includes('localhost') ||
  env.DATABASE_URL.includes('127.0.0.1');

const requiresSsl = !isLocalhost;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  ...(requiresSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

let isPgHealthy = false;
let hasCheckedPg = false;

pool.on('error', (err) => {
  // Silent fallback
});

let lastWarnTime = 0;

async function checkPgHealth(): Promise<boolean> {
  if (isPgHealthy) return true;
  try {
    const res = await pool.query('SELECT 1');
    isPgHealthy = res.rows.length > 0;
    if (isPgHealthy) {
      console.log(`✅ [Database Connected] PostgreSQL verified active on port ${env.DB_PORT}. Real database queries active.`);
    }
  } catch (e: any) {
    isPgHealthy = false;
    const now = Date.now();
    if (now - lastWarnTime > 30000) {
      lastWarnTime = now;
      if (env.NODE_ENV === 'production') {
        console.error('❌ [DATABASE WARNING] PostgreSQL connection check failed in production mode:');
        console.error(`❌ Details: ${e.message} (Code: ${e.code || 'UNKNOWN'})`);
        if (!process.env.DATABASE_URL || isLocalhost) {
          console.error('⚠️ [ACTION REQUIRED ON RENDER]: DATABASE_URL is not set or defaults to localhost.');
          console.error('👉 Please go to Render Dashboard -> Web Service -> Environment -> Add "DATABASE_URL" with your Render or Supabase PostgreSQL Connection String.');
        }
      } else {
        console.warn(`⚠️ [DEV WARNING] Local PostgreSQL is not reachable on port ${env.DB_PORT}: ${e.message}`);
        console.warn('⚠️ [DEV WARNING] Running in development mode with in-memory store.');
      }
    }
  }
  return isPgHealthy;
}

// Memory query handler
function runMemoryQuery(text: string, params: any[] = []): { rows: any[] } {
  const q = text.trim();
  const lower = q.toLowerCase();

  // Transactions
  if (lower === 'begin' || lower === 'commit' || lower === 'rollback') {
    return { rows: [] };
  }

  // 1. CATEGORIES
  if (lower.includes('from categories')) {
    if (lower.startsWith('select count(*)')) {
      return { rows: [{ total: memoryStore.categories.length }] };
    }
    if (lower.includes('where slug = $1')) {
      const cat = memoryStore.categories.find((c) => c.slug === params[0]);
      return { rows: cat ? [cat] : [] };
    }
    if (lower.includes('where id = $1')) {
      const cat = memoryStore.categories.find((c) => c.id === params[0]);
      return { rows: cat ? [cat] : [] };
    }
    // Return all or active categories with product counts
    const rows = memoryStore.categories.map((c) => ({
      ...c,
      product_count: memoryStore.products.filter((p) => p.category_id === c.id).length,
    }));
    return { rows };
  }

  if (lower.startsWith('insert into categories')) {
    const newCat = {
      id: uuidv4(),
      name: params[0],
      slug: params[1],
      description: params[2] || '',
      image: params[3] || '',
      status: params[4] || 'active',
      display_order: params[5] || 0,
    };
    memoryStore.categories.push(newCat);
    return { rows: [newCat] };
  }

  if (lower.startsWith('update categories')) {
    const id = params[params.length - 1];
    const cat = memoryStore.categories.find((c) => c.id === id);
    if (cat) {
      if (params[0]) cat.name = params[0];
      if (params[1]) cat.slug = params[1];
    }
    return { rows: cat ? [cat] : [] };
  }

  // 2. PRODUCTS
  if (lower.includes('from products')) {
    if (lower.startsWith('select count(*)')) {
      let filtered = [...memoryStore.products];
      if (lower.includes("status = 'active'") || lower.includes("p.status = 'active'")) {
        filtered = filtered.filter((p) => p.status === 'active');
      }
      if (lower.includes("stock_quantity <= minimum_stock")) {
        filtered = filtered.filter((p) => p.stock_quantity <= p.minimum_stock);
      }
      return { rows: [{ count: filtered.length, total: filtered.length }] };
    }

    if (lower.includes('where p.slug = $1') || lower.includes('where slug = $1')) {
      const p = memoryStore.products.find((prod) => prod.slug === params[0]);
      if (p) {
        const cat = memoryStore.categories.find((c) => c.id === p.category_id);
        return { rows: [{ ...p, category_name: cat?.name, category_slug: cat?.slug }] };
      }
      return { rows: [] };
    }

    if (lower.includes('where p.id = $1') || lower.includes('where id = $1')) {
      const p = memoryStore.products.find((prod) => prod.id === params[0]);
      if (p) {
        const cat = memoryStore.categories.find((c) => c.id === p.category_id);
        return { rows: [{ ...p, category_name: cat?.name, category_slug: cat?.slug }] };
      }
      return { rows: [] };
    }

    // List products
    let list = memoryStore.products.map((p) => {
      const cat = memoryStore.categories.find((c) => c.id === p.category_id);
      return { ...p, category_name: cat?.name, category_slug: cat?.slug };
    });

    if (lower.includes("p.status = 'active'") || lower.includes("where p.status = 'active'")) {
      list = list.filter((p) => p.status === 'active');
    }

    // Match params if any
    for (const param of params) {
      if (typeof param === 'string' && param.startsWith('%') && param.endsWith('%')) {
        const clean = param.slice(1, -1).toLowerCase();
        list = list.filter((p) => (p.name || '').toLowerCase().includes(clean) || (p.description || '').toLowerCase().includes(clean));
      } else if (typeof param === 'string') {
        const matchingCat = memoryStore.categories.find((c) => c.slug === param || c.id === param);
        if (matchingCat) {
          list = list.filter((p) => p.category_id === matchingCat.id);
        }
      }
    }

    return { rows: list };
  }

  if (lower.startsWith('insert into products')) {
    const newProd = {
      id: uuidv4(),
      name: params[0],
      slug: params[1],
      category_id: params[2] || null,
      description: params[3] || '',
      images: Array.isArray(params[4]) ? params[4] : [],
      unit: params[5] || '1kg',
      mrp: Number(params[6] || 0),
      selling_price: Number(params[7] || 0),
      purchase_price: Number(params[8] || 0),
      stock_quantity: Number(params[9] || 0),
      minimum_stock: Number(params[10] || 0),
      status: params[11] || 'active',
      featured: Boolean(params[12]),
      best_seller: Boolean(params[13]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.products.unshift(newProd);
    savePersistedProducts(memoryStore.products);
    return { rows: [newProd] };
  }

  if (lower.startsWith('update products')) {
    const id = params[params.length - 1];
    const prod = memoryStore.products.find((p) => p.id === id);
    if (prod) {
      if (lower.includes("status = 'inactive'")) {
        prod.status = 'inactive';
      } else if (lower.includes('set') && lower.includes('where')) {
        const setIdx = lower.indexOf('set');
        const whereIdx = lower.indexOf('where');
        const setPart = q.slice(setIdx + 3, whereIdx);
        const parts = setPart.split(',');
        for (const part of parts) {
          const m = part.trim().match(/^([a-zA-Z0-9_]+)\s*=\s*\$([0-9]+)$/);
          if (m) {
            const col = m[1];
            const pIdx = parseInt(m[2], 10) - 1;
            if (pIdx >= 0 && pIdx < params.length) {
              const val = params[pIdx];
              if (['mrp', 'selling_price', 'purchase_price', 'stock_quantity', 'minimum_stock'].includes(col)) {
                (prod as any)[col] = Number(val);
              } else if (['featured', 'best_seller'].includes(col)) {
                (prod as any)[col] = Boolean(val);
              } else {
                (prod as any)[col] = val;
              }
            }
          }
        }
      }
      prod.updated_at = new Date().toISOString();
      savePersistedProducts(memoryStore.products);
    }
    return { rows: prod ? [prod] : [] };
  }

  // 3. PRODUCT VARIANTS
  if (lower.includes('from product_variants')) {
    if (params[0]) {
      let vars = memoryStore.product_variants.filter((v) => v.product_id === params[0]);
      if (lower.includes("status = 'active'")) {
        vars = vars.filter((v) => v.status === 'active');
      }
      return { rows: vars };
    }
    return { rows: memoryStore.product_variants };
  }

  if (lower.startsWith('insert into product_variants')) {
    const newVar = {
      id: uuidv4(),
      product_id: params[0],
      name: params[1],
      unit: params[2],
      mrp: Number(params[3] || 0),
      selling_price: Number(params[4] || 0),
      stock_quantity: Number(params[5] || 0),
      status: params[6] || 'active',
      created_at: new Date().toISOString(),
    };
    memoryStore.product_variants.push(newVar);
    savePersistedVariants(memoryStore.product_variants);
    return { rows: [newVar] };
  }

  if (lower.startsWith('delete from product_variants')) {
    if (params[0]) {
      memoryStore.product_variants = memoryStore.product_variants.filter((v) => v.product_id !== params[0]);
      savePersistedVariants(memoryStore.product_variants);
    }
    return { rows: [] };
  }


  // 4. USERS & ADMINS
  if (lower.includes('from admins')) {
    if (params && params[0]) {
      const p = String(params[0]).toLowerCase();
      const admin = memoryStore.admins.find(
        (a) => String(a.id).toLowerCase() === p || (a.email && a.email.toLowerCase() === p)
      );
      return { rows: admin ? [admin] : [] };
    }
    return { rows: memoryStore.admins };
  }

  if (lower.includes('from users')) {
    if (lower.startsWith('select count(*)')) {
      return { rows: [{ count: memoryStore.users.length, total: memoryStore.users.length }] };
    }
    if (params[0]) {
      const u = memoryStore.users.find(
        (user) => user.email.toLowerCase() === params[0].toLowerCase() || user.id === params[0]
      );
      return { rows: u ? [u] : [] };
    }
    return {
      rows: memoryStore.users.map((u) => ({
        ...u,
        order_count: memoryStore.orders.filter((o) => o.user_id === u.id).length,
        total_spent: memoryStore.orders
          .filter((o) => o.user_id === u.id)
          .reduce((sum, o) => sum + o.total, 0),
      })),
    };
  }

  if (lower.startsWith('insert into users')) {
    const newUser = {
      id: uuidv4(),
      name: params[0],
      email: params[1],
      mobile: params[2],
      password: params[3],
      role: 'customer',
      status: 'active',
      created_at: new Date().toISOString(),
    };
    memoryStore.users.push(newUser);
    return { rows: [newUser] };
  }

  // 5. CARTS & CART ITEMS
  if (lower.includes('from carts')) {
    const cart = memoryStore.carts.find((c) => c.user_id === params[0]);
    return { rows: cart ? [cart] : [] };
  }

  if (lower.startsWith('insert into carts')) {
    const newCart = { id: uuidv4(), user_id: params[0], created_at: new Date().toISOString() };
    memoryStore.carts.push(newCart);
    return { rows: [newCart] };
  }

  if (lower.includes('from cart_items')) {
    const cartId = params[0];
    const items = memoryStore.cart_items
      .filter((ci) => !cartId || ci.cart_id === cartId)
      .map((ci) => {
        const prod = memoryStore.products.find((p) => p.id === ci.product_id);
        const variant = ci.variant_id ? memoryStore.product_variants.find((v) => v.id === ci.variant_id) : null;
        return {
          ...ci,
          name: prod?.name || 'Fresh Vegetable',
          slug: prod?.slug || '',
          images: prod?.images || [],
          unit: variant?.unit || prod?.unit || '1kg',
          mrp: variant?.mrp || prod?.mrp || 50,
          selling_price: variant?.selling_price || prod?.selling_price || 40,
          stock_quantity: variant?.stock_quantity || prod?.stock_quantity || 100,
          product_status: prod?.status || 'active',
          variant_name: variant?.name,
          variant_unit: variant?.unit,
          variant_mrp: variant?.mrp,
          variant_selling_price: variant?.selling_price,
          variant_stock_quantity: variant?.stock_quantity,
        };
      });
    return { rows: items };
  }

  if (lower.startsWith('insert into cart_items')) {
    const newItem = {
      id: uuidv4(),
      cart_id: params[0],
      product_id: params[1],
      variant_id: params[2] || null,
      quantity: params[3] || 1,
      created_at: new Date().toISOString(),
    };
    memoryStore.cart_items.push(newItem);
    return { rows: [newItem] };
  }

  if (lower.startsWith('update cart_items')) {
    const item = memoryStore.cart_items.find((ci) => ci.id === params[1]);
    if (item) item.quantity = params[0];
    return { rows: item ? [item] : [] };
  }

  if (lower.startsWith('delete from cart_items')) {
    if (params[0]) {
      memoryStore.cart_items = memoryStore.cart_items.filter((ci) => ci.id !== params[0] && ci.cart_id !== params[0]);
    }
    return { rows: [] };
  }

  // 6. ADDRESSES
  if (lower.includes('from addresses')) {
    if (params[0]) {
      const list = memoryStore.addresses.filter((a) => a.user_id === params[0] || a.id === params[0]);
      return { rows: list };
    }
    return { rows: memoryStore.addresses };
  }

  if (lower.startsWith('insert into addresses')) {
    const newAddr = {
      id: uuidv4(),
      user_id: params[0],
      full_name: params[1],
      phone: params[2],
      house_number: params[3],
      street: params[4],
      area: params[5],
      landmark: params[6],
      city: params[7],
      state: params[8],
      pincode: params[9],
      address_type: params[12] || 'home',
      is_default: params[13] !== false,
      created_at: new Date().toISOString(),
    };
    memoryStore.addresses.unshift(newAddr);
    return { rows: [newAddr] };
  }

  // 7. ORDERS
  if (lower.includes('from orders')) {
    if (lower.includes('total_orders') || lower.includes('count(case when o.order_status')) {
      let filtered = [...memoryStore.orders];
      const total_orders = filtered.length;
      const new_orders = filtered.filter((o) => o.order_status === 'pending').length;
      const confirmed_orders = filtered.filter((o) => o.order_status === 'confirmed').length;
      const preparing_orders = filtered.filter((o) => ['preparing', 'packed'].includes(o.order_status)).length;
      const out_for_delivery_orders = filtered.filter((o) => o.order_status === 'out_for_delivery').length;
      const delivered_orders = filtered.filter((o) => o.order_status === 'delivered').length;
      const cancelled_orders = filtered.filter((o) => o.order_status === 'cancelled').length;
      const pending_payments = filtered.filter((o) => o.payment_status === 'pending' && o.order_status !== 'cancelled').length;
      const total_revenue = filtered.reduce((acc, o) => acc + (o.order_status !== 'cancelled' ? Number(o.total || 0) : 0), 0);

      return {
        rows: [{
          total_orders,
          new_orders,
          confirmed_orders,
          preparing_orders,
          out_for_delivery_orders,
          delivered_orders,
          cancelled_orders,
          pending_payments,
          total_revenue,
        }],
      };
    }
    if (lower.startsWith('select count(*)')) {
      let filtered = [...memoryStore.orders];
      if (lower.includes("order_status = 'pending'")) filtered = filtered.filter((o) => o.order_status === 'pending');
      if (lower.includes("order_status = 'delivered'")) filtered = filtered.filter((o) => o.order_status === 'delivered');
      return { rows: [{ count: filtered.length, total: filtered.length }] };
    }
    if (lower.includes('sum(total)')) {
      const sum = memoryStore.orders.reduce((acc, o) => acc + (o.order_status !== 'cancelled' ? o.total : 0), 0);
      return { rows: [{ amount: sum }] };
    }
    if (lower.includes('where id = $1') || lower.includes('where o.id = $1')) {
      const ord = memoryStore.orders.find((o) => o.id === params[0]);
      if (ord) {
        const user = memoryStore.users.find((u) => u.id === ord.user_id);
        const addr = typeof ord.address_snapshot === 'object' ? ord.address_snapshot : {};
        return {
          rows: [{
            ...ord,
            customer_name: user?.name || addr?.full_name || 'Customer',
            customer_mobile: user?.mobile || addr?.phone || '',
            customer_email: user?.email || '',
          }],
        };
      }
      return { rows: [] };
    }
    if (lower.includes('where user_id = $1')) {
      const ords = memoryStore.orders.filter((o) => o.user_id === params[0]);
      return { rows: ords };
    }

    const mapped = memoryStore.orders.map((o) => {
      const user = memoryStore.users.find((u) => u.id === o.user_id);
      const addr = typeof o.address_snapshot === 'object' ? o.address_snapshot : {};
      return {
        ...o,
        customer_name: user?.name || addr?.full_name || 'Customer',
        customer_mobile: user?.mobile || addr?.phone || '',
        customer_email: user?.email || '',
      };
    });
    return { rows: mapped };
  }

  if (lower.startsWith('insert into orders')) {
    let addrSnapshot = {};
    try {
      addrSnapshot = typeof params[2] === 'string' ? JSON.parse(params[2]) : (params[2] || {});
    } catch {
      addrSnapshot = params[2] || {};
    }
    const newOrder = {
      id: uuidv4(),
      order_number: params[0] || `ORD-${Date.now().toString().slice(-8)}`,
      user_id: params[1],
      address_snapshot: addrSnapshot,
      delivery_address: addrSnapshot,
      subtotal: Number(params[3] || 0),
      delivery_charge: Number(params[4] || 0),
      discount: Number(params[5] || 0),
      tax: Number(params[6] || 0),
      total: Number(params[7] || params[3] || 0),
      payment_method: params[8] || 'cod',
      payment_status: params[9] || 'pending',
      order_status: params[10] || 'pending',
      notes: params[11] || '',
      created_at: new Date().toISOString(),
    };
    (memoryStore.orders as any).unshift(newOrder);
    savePersistedOrders(memoryStore.orders);
    return { rows: [newOrder] };
  }

  if (lower.startsWith('update orders')) {
    const id = params[params.length - 1];
    const ord = memoryStore.orders.find((o) => o.id === id);
    if (ord) {
      if (lower.includes('order_status =')) {
        const statusVal = params.find((p) => ['pending', 'confirmed', 'preparing', 'packed', 'out_for_delivery', 'delivered', 'cancelled'].includes(p));
        if (statusVal) ord.order_status = statusVal;
      }
      if (lower.includes('payment_status =')) {
        const payVal = params.find((p) => ['pending', 'paid', 'failed', 'refunded', 'success'].includes(p));
        if (payVal) ord.payment_status = payVal === 'success' ? 'paid' : payVal;
      }
      savePersistedOrders(memoryStore.orders);
    }
    return { rows: ord ? [ord] : [] };
  }

  if (lower.includes('from order_items')) {
    const ordId = params[0];
    const items = memoryStore.order_items
      .filter((oi: any) => oi.order_id === ordId)
      .map((oi: any) => {
        const prod = memoryStore.products.find((p) => p.id === oi.product_id);
        const images = prod?.images || ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop'];
        return {
          ...oi,
          product_name: oi.product_name || oi.product_name_snapshot || prod?.name || 'Fresh Organic Produce',
          unit: oi.unit || oi.unit_snapshot || prod?.unit || '1 unit',
          price: Number(oi.price || oi.price_snapshot || prod?.selling_price || 0),
          subtotal: Number(oi.subtotal || oi.total || ((oi.price_snapshot || prod?.selling_price || 0) * (oi.quantity || 1))),
          product_images: images,
          image_url: images[0],
        };
      });
    return { rows: items };
  }

  if (lower.startsWith('insert into order_items')) {
    const newOi = {
      id: uuidv4(),
      order_id: params[0],
      product_id: params[1],
      variant_id: params[2] || null,
      product_name_snapshot: params[3],
      product_name: params[3],
      unit_snapshot: params[4],
      unit: params[4],
      price_snapshot: Number(params[5] || 0),
      price: Number(params[5] || 0),
      mrp_snapshot: Number(params[6] || 0),
      quantity: Number(params[7] || 1),
      total: Number(params[8] || 0),
      subtotal: Number(params[8] || 0),
    };
    memoryStore.order_items.push(newOi);
    savePersistedOrderItems(memoryStore.order_items);
    return { rows: [newOi] };
  }

  // 8. PAYMENTS & TRANSACTIONS & REFUNDS (Phase 7)
  if (lower.includes('from payments')) {
    if (lower.startsWith('select count(*)')) {
      return { rows: [{ total: memoryStore.payments.length }] };
    }
    if (lower.includes('where id = $1')) {
      const p = memoryStore.payments.find((pay) => pay.id === params[0]);
      return { rows: p ? [p] : [] };
    }
    if (lower.includes('where order_id = $1')) {
      const p = memoryStore.payments.find((pay) => pay.order_id === params[0]);
      return { rows: p ? [p] : [] };
    }
    return { rows: memoryStore.payments };
  }

  if (lower.startsWith('insert into payments')) {
    const newPay = {
      id: uuidv4(),
      order_id: params[0],
      amount: params[1],
      currency: 'INR',
      payment_method: params[2] || 'upi',
      payment_gateway: params[3] || 'simulated',
      gateway_payment_id: params[4] || `pay_sim_${Date.now()}`,
      gateway_order_id: params[5] || `ord_sim_${Date.now()}`,
      status: params[6] || 'PENDING',
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    memoryStore.payments.unshift(newPay);
    return { rows: [newPay] };
  }

  if (lower.startsWith('update payments')) {
    const id = params[params.length - 1];
    const pay = memoryStore.payments.find((p) => p.id === id || p.order_id === id);
    if (pay) {
      if (params[0]) pay.status = params[0];
      if (params[1]) pay.gateway_payment_id = params[1];
    }
    return { rows: pay ? [pay] : [] };
  }

  if (lower.includes('from refunds')) {
    return { rows: memoryStore.refunds };
  }

  if (lower.startsWith('insert into refunds')) {
    const newRef = {
      id: uuidv4(),
      payment_id: params[0],
      order_id: params[1],
      amount: params[2],
      reason: params[3],
      status: 'COMPLETED',
      gateway_refund_id: `rfnd_sim_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    memoryStore.refunds.unshift(newRef);
    return { rows: [newRef] };
  }

  // 9. DELIVERY PARTNERS & ASSIGNMENTS (Phase 8 & 9)
  if (lower.includes('from delivery_partners')) {
    if (lower.includes('where id = $1')) {
      const dp = memoryStore.delivery_partners.find((d) => d.id === params[0]);
      return { rows: dp ? [dp] : [] };
    }
    return { rows: memoryStore.delivery_partners };
  }

  if (lower.startsWith('insert into delivery_partners')) {
    const newDp = {
      id: uuidv4(),
      name: params[0],
      phone: params[1],
      email: params[2],
      vehicle_type: params[3] || 'Bike',
      vehicle_number: params[4] || 'GJ-01-XX-0000',
      status: 'AVAILABLE',
      availability: true,
      rating: 4.8,
      latitude: 23.0225,
      longitude: 72.5714,
      total_deliveries: 0,
      created_at: new Date().toISOString(),
    };
    (memoryStore.delivery_partners as any).push(newDp);
    return { rows: [newDp] };
  }

  if (lower.startsWith('update delivery_partners')) {
    const id = params[params.length - 1];
    const dp = memoryStore.delivery_partners.find((d) => d.id === id);
    if (dp && params[0]) dp.status = params[0];
    return { rows: dp ? [dp] : [] };
  }

  if (lower.startsWith('delete from delivery_partners')) {
    const id = params[0];
    memoryStore.delivery_partners = memoryStore.delivery_partners.filter((d) => d.id !== id);
    return { rows: [] };
  }

  if (lower.includes('from delivery_assignments')) {
    if (lower.includes('where order_id = $1') || lower.includes('where da.order_id = $1')) {
      const da = memoryStore.delivery_assignments.find((a) => a.order_id === params[0]);
      if (da) {
        const partner = memoryStore.delivery_partners.find((d) => d.id === da.delivery_partner_id);
        return { rows: [{ ...da, partner_name: partner?.name, partner_phone: partner?.phone, partner_rating: partner?.rating, partner_lat: partner?.latitude, partner_lng: partner?.longitude }] };
      }
      return { rows: [] };
    }
    return { rows: memoryStore.delivery_assignments };
  }

  if (lower.startsWith('insert into delivery_assignments')) {
    const newDa = {
      id: uuidv4(),
      order_id: params[0],
      delivery_partner_id: params[1],
      status: 'DRIVER_ASSIGNED',
      assigned_at: new Date().toISOString(),
      picked_up_at: null,
      delivered_at: null,
      estimated_delivery_time: new Date(Date.now() + 1800000).toISOString(), // 30 mins
      notes: params[2] || '',
    };
    (memoryStore.delivery_assignments as any).unshift(newDa);
    return { rows: [newDa] };
  }

  // 10. COUPONS & PROMOTIONS (Phase 10)
  if (lower.includes('from coupons')) {
    if (lower.includes('where code = $1') || lower.includes('where upper(code) = upper($1)')) {
      const cp = memoryStore.coupons.find((c) => c.code.toUpperCase() === String(params[0]).toUpperCase());
      return { rows: cp ? [cp] : [] };
    }
    if (lower.includes('where id = $1')) {
      const cp = memoryStore.coupons.find((c) => c.id === params[0]);
      return { rows: cp ? [cp] : [] };
    }
    return { rows: memoryStore.coupons };
  }

  if (lower.startsWith('insert into coupons')) {
    const newCp = {
      id: uuidv4(),
      code: params[0].toUpperCase(),
      name: params[1],
      description: params[2],
      discount_type: params[3] || 'FLAT',
      discount_value: params[4],
      minimum_order_amount: params[5] || 0,
      maximum_discount: params[6] || 100,
      usage_limit: params[7] || 1000,
      usage_count: 0,
      per_customer_limit: params[8] || 1,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      status: 'active',
    };
    memoryStore.coupons.push(newCp);
    return { rows: [newCp] };
  }

  if (lower.startsWith('update coupons')) {
    const id = params[params.length - 1];
    const cp = memoryStore.coupons.find((c) => c.id === id);
    if (cp && params[0]) cp.status = params[0];
    return { rows: cp ? [cp] : [] };
  }

  if (lower.startsWith('delete from coupons')) {
    const id = params[0];
    memoryStore.coupons = memoryStore.coupons.filter((c) => c.id !== id);
    return { rows: [] };
  }

  if (lower.includes('from coupon_usage')) {
    return { rows: memoryStore.coupon_usage };
  }

  // 11. NOTIFICATIONS (Phase 11)
  if (lower.includes('from notifications')) {
    if (lower.includes('where user_id = $1') || lower.includes('where (user_id = $1 or user_id is null)')) {
      const list = memoryStore.notifications.filter((n) => !n.user_id || n.user_id === params[0]);
      return { rows: list };
    }
    return { rows: memoryStore.notifications };
  }

  if (lower.startsWith('insert into notifications')) {
    const newNotif = {
      id: uuidv4(),
      user_id: params[0] || null,
      title: params[1],
      message: params[2],
      type: params[3] || 'SYSTEM',
      reference_type: params[4] || null,
      reference_id: params[5] || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    memoryStore.notifications.unshift(newNotif);
    return { rows: [newNotif] };
  }

  if (lower.startsWith('update notifications set is_read = true')) {
    memoryStore.notifications.forEach((n) => { n.is_read = true; });
    return { rows: [] };
  }

  // 12. CMS HOMEPAGE SECTIONS & BANNERS (Phase 13)
  if (lower.includes('from homepage_sections')) {
    if (lower.includes("status = 'active'")) {
      const active = (memoryStore as any).homepage_sections.filter((s: any) => s.status === 'active');
      active.sort((a: any, b: any) => a.display_order - b.display_order);
      return { rows: active };
    }
    const all = [...(memoryStore as any).homepage_sections];
    all.sort((a: any, b: any) => a.display_order - b.display_order);
    return { rows: all };
  }

  if (lower.includes('from homepage_banners')) {
    return { rows: (memoryStore as any).homepage_banners || [] };
  }

  if (lower.startsWith('insert into homepage_sections')) {
    const newSec = {
      id: uuidv4(),
      type: params[0],
      title: params[1],
      subtitle: params[2] || '',
      description: params[3] || '',
      image: params[4] || '',
      button_text: params[5] || '',
      button_link: params[6] || '',
      display_order: params[7] || 0,
      status: params[8] || 'active',
      configuration: params[9] || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (memoryStore as any).homepage_sections.push(newSec);
    return { rows: [newSec] };
  }

  // 13. LOYALTY, WALLET & REFERRALS (Phase 15)
  if (lower.includes('from wallets')) {
    if (params[0]) {
      const w = (memoryStore as any).wallets.find((item: any) => item.user_id === params[0] || item.id === params[0]);
      return { rows: w ? [w] : [] };
    }
    return { rows: (memoryStore as any).wallets };
  }

  if (lower.includes('from wallet_transactions')) {
    if (params[0]) {
      const txs = (memoryStore as any).wallet_transactions.filter((tx: any) => tx.wallet_id === params[0]);
      return { rows: txs };
    }
    return { rows: (memoryStore as any).wallet_transactions };
  }

  if (lower.includes('from loyalty_accounts')) {
    if (params[0]) {
      const acc = (memoryStore as any).loyalty_accounts.find((a: any) => a.user_id === params[0] || a.id === params[0]);
      return { rows: acc ? [acc] : [] };
    }
    return { rows: (memoryStore as any).loyalty_accounts };
  }

  if (lower.includes('from loyalty_transactions')) {
    if (params[0]) {
      const txs = (memoryStore as any).loyalty_transactions.filter((tx: any) => tx.loyalty_account_id === params[0]);
      return { rows: txs };
    }
    return { rows: (memoryStore as any).loyalty_transactions };
  }

  if (lower.includes('from referral_codes')) {
    if (lower.includes('where code = $1') || lower.includes('where upper(code) = upper($1)')) {
      const rc = (memoryStore as any).referral_codes.find((r: any) => r.code.toUpperCase() === String(params[0]).toUpperCase());
      return { rows: rc ? [rc] : [] };
    }
    if (params[0]) {
      const rc = (memoryStore as any).referral_codes.find((r: any) => r.user_id === params[0]);
      return { rows: rc ? [rc] : [] };
    }
    return { rows: (memoryStore as any).referral_codes };
  }

  if (lower.includes('from referrals')) {
    return { rows: (memoryStore as any).referrals };
  }

  // 14. SUBSCRIPTIONS (Phase 16)
  if (lower.includes('from subscriptions')) {
    if (params[0]) {
      const subs = (memoryStore as any).subscriptions.filter((s: any) => s.user_id === params[0] || s.id === params[0]);
      return { rows: subs };
    }
    return { rows: (memoryStore as any).subscriptions };
  }

  // 15. SELLERS & PAYOUTS (Phase 17)
  if (lower.includes('from sellers')) {
    if (params[0]) {
      const sel = (memoryStore as any).sellers.find((s: any) => s.id === params[0]);
      return { rows: sel ? [sel] : [] };
    }
    return { rows: (memoryStore as any).sellers };
  }

  if (lower.includes('from seller_payouts')) {
    if (params[0]) {
      const list = (memoryStore as any).seller_payouts.filter((p: any) => p.seller_id === params[0]);
      return { rows: list };
    }
    return { rows: (memoryStore as any).seller_payouts };
  }

  // 16. DELIVERY ZONES & STORES (Phase 19)
  if (lower.includes('from delivery_zones')) {
    const zones = getPersistedZones();
    if (params[0]) {
      const z = zones.find((item: any) => item.id === params[0]);
      return { rows: z ? [z] : [] };
    }
    return { rows: zones };
  }

  if (lower.includes('from stores')) {
    return { rows: (memoryStore as any).stores };
  }

  // 17. HOMEPAGE CMS (Phase 13)
  if (lower.includes('from homepage_sections')) {
    let list = [...(memoryStore as any).homepage_sections];
    if (lower.includes("where status = 'active'")) {
      const now = new Date();
      list = list.filter((s: any) => {
        if (s.status !== 'active') return false;
        if (s.start_date && new Date(s.start_date) > now) return false;
        if (s.end_date && new Date(s.end_date) < now) return false;
        return true;
      });
    }
    if (lower.includes('where id = $1')) {
      const found = (memoryStore as any).homepage_sections.find((s: any) => s.id === params[0]);
      return { rows: found ? [found] : [] };
    }
    list.sort((a: any, b: any) => a.display_order - b.display_order);
    return { rows: list };
  }

  if (lower.startsWith('insert into homepage_sections')) {
    const newSec = {
      id: uuidv4(),
      type: params[0] || 'promotional_banner',
      title: params[1] || 'Homepage Section',
      subtitle: params[2] || '',
      description: params[3] || '',
      image: params[4] || '',
      button_text: params[5] || 'Shop Now',
      button_link: params[6] || '/products',
      display_order: params[7] !== undefined ? Number(params[7]) : (memoryStore as any).homepage_sections.length + 1,
      status: params[8] || 'active',
      start_date: params[9] || null,
      end_date: params[10] || null,
      configuration: typeof params[11] === 'string' ? JSON.parse(params[11]) : (params[11] || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    (memoryStore as any).homepage_sections.push(newSec);
    return { rows: [newSec] };
  }

  if (lower.startsWith('update homepage_sections')) {
    const id = params[params.length - 1];
    const sec = (memoryStore as any).homepage_sections.find((s: any) => s.id === id);
    if (sec) {
      if (params[0]) sec.title = params[0];
      if (params[1]) sec.subtitle = params[1];
      if (params[2]) sec.status = params[2];
      sec.updated_at = new Date().toISOString();
    }
    return { rows: sec ? [sec] : [] };
  }

  if (lower.startsWith('delete from homepage_sections')) {
    const id = params[0];
    const idx = (memoryStore as any).homepage_sections.findIndex((s: any) => s.id === id);
    let deleted = null;
    if (idx !== -1) {
      deleted = (memoryStore as any).homepage_sections.splice(idx, 1)[0];
    }
    return { rows: deleted ? [deleted] : [] };
  }

  if (lower.includes('from homepage_banners')) {
    let list = [...(memoryStore as any).homepage_banners];
    if (lower.includes("where status = 'active'")) {
      list = list.filter((b: any) => b.status === 'active');
    }
    if (lower.includes('where id = $1')) {
      const b = (memoryStore as any).homepage_banners.find((item: any) => item.id === params[0]);
      return { rows: b ? [b] : [] };
    }
    list.sort((a: any, b: any) => a.display_order - b.display_order);
    return { rows: list };
  }

  if (lower.startsWith('insert into homepage_banners')) {
    const newBnr = {
      id: params[0] || uuidv4(),
      section_id: params[1] || 'sec-hero-01',
      title: params[2],
      subtitle: params[3] || '',
      image: params[4],
      link: params[5] || '/products',
      badge: params[6] || 'Fresh Harvest',
      display_order: params[7] !== undefined ? Number(params[7]) : (memoryStore as any).homepage_banners.length + 1,
      status: params[8] || 'active',
      created_at: new Date().toISOString(),
    };
    (memoryStore as any).homepage_banners.push(newBnr);
    return { rows: [newBnr] };
  }

  // 18. AUDIT LOGS (Phase 20)
  if (lower.includes('from audit_logs')) {
    return { rows: (memoryStore as any).audit_logs };
  }

  if (lower.startsWith('insert into audit_logs')) {
    const newLog = {
      id: uuidv4(),
      admin_id: params[0] || null,
      admin_email: params[1] || 'system',
      action: params[2],
      entity_type: params[3] || null,
      entity_id: params[4] || null,
      old_values: params[5] || null,
      new_values: params[6] || null,
      ip_address: params[7] || '127.0.0.1',
      user_agent: params[8] || 'API Client',
      created_at: new Date().toISOString(),
    };
    (memoryStore as any).audit_logs.unshift(newLog);
    return { rows: [newLog] };
  }

  // 19. DELIVERY SETTINGS & CHARGES (Phase 21)
  if (lower.includes('from delivery_settings')) {
    const settings = getPersistedDeliverySettings();
    return { rows: [settings] };
  }

  if (lower.startsWith('update delivery_settings')) {
    const updatePayload: any = {};
    if (params && params.length > 0) {
      if (params[0] !== undefined) updatePayload.default_delivery_charge = Number(params[0]);
      if (params[1] !== undefined) updatePayload.free_delivery_threshold = Number(params[1]);
      if (params[2] !== undefined) updatePayload.min_order_amount = Number(params[2]);
      if (params[3] !== undefined) updatePayload.enable_free_delivery = Boolean(params[3]);
      if (params[4] !== undefined) updatePayload.express_delivery_fee = Number(params[4]);
      if (params[5] !== undefined) updatePayload.estimated_delivery_time = String(params[5]);
      if (params[6] !== undefined) updatePayload.surge_charge = Number(params[6]);
      if (params[7] !== undefined) updatePayload.is_delivery_active = Boolean(params[7]);
    }
    const settings = savePersistedDeliverySettings(updatePayload);
    return { rows: [settings] };
  }

  return { rows: [] };
}

export const db = {
  query: async (text: string, params?: any[]) => {
    const healthy = await checkPgHealth();
    if (healthy) {
      try {
        return await pool.query(text, params);
      } catch (err: any) {
        // If table doesn't exist yet (42P01), connection refused, or connection terminated
        if (err.code === '42P01' || err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === 'ECONNRESET') {
          console.warn(`⚠️ [PostgreSQL Query Warning] ${err.message}. Using store fallback.`);
          return runMemoryQuery(text, params);
        }
        throw err;
      }
    }
    // PostgreSQL is unreachable or still starting up, fallback safely
    return runMemoryQuery(text, params);
  },

  getClient: async () => {
    const healthy = await checkPgHealth();
    if (healthy) {
      try {
        return await pool.connect();
      } catch (err: any) {
        isPgHealthy = false;
        console.warn(`⚠️ [PostgreSQL Client Warning] Could not connect client: ${err.message}`);
      }
    }
    // Mock client for safe fallback
    return {
      query: (text: string, params?: any[]) => Promise.resolve(runMemoryQuery(text, params)),
      release: () => {},
    };
  },

  pool,
};

export default db;
