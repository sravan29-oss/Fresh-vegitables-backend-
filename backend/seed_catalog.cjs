const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fresh_vegetables',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'db_555a87fd0e63780985202c70',
});

const categories = [
  { name: 'Fresh Vegetables', slug: 'fresh-vegetables', description: 'Everyday fresh farm vegetables', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600', display_order: 1 },
  { name: 'Leafy Greens', slug: 'leafy-greens', description: 'Crisp, nutrient-packed fresh greens', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600', display_order: 2 },
  { name: 'Root Vegetables', slug: 'root-vegetables', description: 'Farm potatoes, carrots, onions and roots', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600', display_order: 3 },
  { name: 'Exotic Vegetables', slug: 'exotic-vegetables', description: 'Broccoli, bell peppers, zucchini and salads', image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600', display_order: 4 },
  { name: 'Herbs & Seasonings', slug: 'herbs-seasonings', description: 'Fresh coriander, mint, ginger, chillies and herbs', image: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600', display_order: 5 },
  { name: 'Organic Vegetables', slug: 'organic-vegetables', description: '100% certified residue-free chemical-free harvest', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600', display_order: 6 },
];

const sampleProducts = [
  {
    name: 'Farm Fresh Spinach (Palak)',
    slug: 'farm-fresh-spinach-palak',
    catSlug: 'leafy-greens',
    description: 'Crisp, tender, iron-rich spinach freshly harvested at dawn from local hydroponic and organic farms.',
    images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800'],
    unit: '500g',
    mrp: 35,
    selling_price: 26,
    stock_quantity: 120,
    minimum_stock: 15,
    featured: true,
    best_seller: true,
    variants: [
      { name: 'Bunch (250g)', unit: '250g', mrp: 20, selling_price: 15, stock: 60 },
      { name: 'Family Pack (500g)', unit: '500g', mrp: 35, selling_price: 26, stock: 60 },
    ]
  },
  {
    name: 'Desi Ripe Tomatoes',
    slug: 'desi-ripe-tomatoes',
    catSlug: 'fresh-vegetables',
    description: 'Tangy and juicy naturally sun-ripened Indian Desi tomatoes perfect for curries, salads, and soups.',
    images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800'],
    unit: '1kg',
    mrp: 45,
    selling_price: 34,
    stock_quantity: 250,
    minimum_stock: 30,
    featured: true,
    best_seller: true,
    variants: [
      { name: '500g', unit: '500g', mrp: 25, selling_price: 18, stock: 100 },
      { name: '1kg Economy', unit: '1kg', mrp: 45, selling_price: 34, stock: 150 },
    ]
  },
  {
    name: 'Premium Red Onions',
    slug: 'premium-red-onions',
    catSlug: 'root-vegetables',
    description: 'Firm, pungent, high-grade Nashik red onions with multiple layers of crisp freshness.',
    images: ['https://images.unsplash.com/photo-1508747703725-719777637510?w=800'],
    unit: '1kg',
    mrp: 50,
    selling_price: 38,
    stock_quantity: 300,
    minimum_stock: 40,
    featured: false,
    best_seller: true,
    variants: [
      { name: '1kg', unit: '1kg', mrp: 50, selling_price: 38, stock: 150 },
      { name: '2kg Saver Pack', unit: '2kg', mrp: 95, selling_price: 72, stock: 150 },
    ]
  },
  {
    name: 'New Crop Farm Potatoes (Aloo)',
    slug: 'new-crop-farm-potatoes',
    catSlug: 'root-vegetables',
    description: 'Thin-skinned, golden farm potatoes with low moisture, ideal for frying, baking, and traditional curries.',
    images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800'],
    unit: '1kg',
    mrp: 40,
    selling_price: 29,
    stock_quantity: 280,
    minimum_stock: 35,
    featured: false,
    best_seller: true,
    variants: [
      { name: '1kg', unit: '1kg', mrp: 40, selling_price: 29, stock: 140 },
      { name: '2kg Bag', unit: '2kg', mrp: 78, selling_price: 55, stock: 140 },
    ]
  },
  {
    name: 'Tender Green Okra / Bhindi',
    slug: 'tender-green-okra-bhindi',
    catSlug: 'fresh-vegetables',
    description: 'Handpicked tender and crisp lady fingers, completely seed-tested and free from stringy fiber.',
    images: ['https://images.unsplash.com/photo-1525607551316-4a8e16d1f9ba?w=800'],
    unit: '500g',
    mrp: 50,
    selling_price: 39,
    stock_quantity: 110,
    minimum_stock: 15,
    featured: true,
    best_seller: false,
    variants: [
      { name: '250g', unit: '250g', mrp: 28, selling_price: 21, stock: 50 },
      { name: '500g', unit: '500g', mrp: 50, selling_price: 39, stock: 60 },
    ]
  },
  {
    name: 'Crunchy Green Bell Pepper (Capsicum)',
    slug: 'crunchy-green-bell-pepper-capsicum',
    catSlug: 'fresh-vegetables',
    description: 'Vibrant green, thick-walled capsicums picked fresh to give that authentic sweet, peppery crunch.',
    images: ['https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800'],
    unit: '500g',
    mrp: 60,
    selling_price: 45,
    stock_quantity: 90,
    minimum_stock: 12,
    featured: true,
    best_seller: false,
    variants: [
      { name: '250g', unit: '250g', mrp: 32, selling_price: 24, stock: 40 },
      { name: '500g', unit: '500g', mrp: 60, selling_price: 45, stock: 50 },
    ]
  },
  {
    name: 'Certified Organic Broccoli',
    slug: 'certified-organic-broccoli',
    catSlug: 'organic-vegetables',
    description: 'Dense, dark green nutrient-dense broccoli florets grown organically without synthetic pesticides.',
    images: ['https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=800'],
    unit: '500g (1 Head)',
    mrp: 85,
    selling_price: 68,
    stock_quantity: 75,
    minimum_stock: 10,
    featured: true,
    best_seller: false,
    variants: [
      { name: 'Single Head (~400-500g)', unit: '500g', mrp: 85, selling_price: 68, stock: 75 },
    ]
  },
  {
    name: 'Tender Sweet Green Peas',
    slug: 'tender-sweet-green-peas',
    catSlug: 'fresh-vegetables',
    description: 'Fresh seasonal green pea pods bursting with natural sweetness and vibrant green flavor.',
    images: ['https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=800'],
    unit: '500g',
    mrp: 65,
    selling_price: 49,
    stock_quantity: 130,
    minimum_stock: 20,
    featured: true,
    best_seller: true,
    variants: [
      { name: '500g Pods', unit: '500g', mrp: 65, selling_price: 49, stock: 80 },
      { name: '1kg Saver', unit: '1kg', mrp: 125, selling_price: 94, stock: 50 },
    ]
  },
  {
    name: 'Aromatic Coriander Leaves (Dhaniya)',
    slug: 'aromatic-coriander-leaves-dhaniya',
    catSlug: 'herbs-seasonings',
    description: 'Deep aroma, lush green desi coriander leaves with tender stems, washed and bundled with care.',
    images: ['https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=800'],
    unit: '100g',
    mrp: 20,
    selling_price: 14,
    stock_quantity: 160,
    minimum_stock: 25,
    featured: false,
    best_seller: true,
    variants: [
      { name: '100g Bunch', unit: '100g', mrp: 20, selling_price: 14, stock: 160 },
    ]
  },
  {
    name: 'Fresh English Cucumber (Kheera)',
    slug: 'fresh-english-cucumber-kheera',
    catSlug: 'exotic-vegetables',
    description: 'Seedless, crisp, high-water content cucumbers straight from polyhouses, refreshing for daily detox.',
    images: ['https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=800'],
    unit: '500g',
    mrp: 40,
    selling_price: 28,
    stock_quantity: 85,
    minimum_stock: 12,
    featured: true,
    best_seller: false,
    variants: [
      { name: '500g Pack', unit: '500g', mrp: 40, selling_price: 28, stock: 85 },
    ]
  },
  {
    name: 'Desi Spicy Green Chillies',
    slug: 'desi-spicy-green-chillies',
    catSlug: 'herbs-seasonings',
    description: 'Fiery, aromatic green chillies to bring authentic zest and heat to your curries and tadkas.',
    images: ['https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800'],
    unit: '200g',
    mrp: 25,
    selling_price: 18,
    stock_quantity: 140,
    minimum_stock: 20,
    featured: false,
    best_seller: true,
    variants: [
      { name: '200g Pack', unit: '200g', mrp: 25, selling_price: 18, stock: 140 },
    ]
  },
  {
    name: 'Crisp Sweet Carrots (Gajar)',
    slug: 'crisp-sweet-carrots-gajar',
    catSlug: 'root-vegetables',
    description: 'Juicy, farm-harvested red & orange carrots rich in beta-carotene, ideal for juicing and cooking.',
    images: ['https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800'],
    unit: '1kg',
    mrp: 55,
    selling_price: 42,
    stock_quantity: 190,
    minimum_stock: 25,
    featured: true,
    best_seller: false,
    variants: [
      { name: '500g', unit: '500g', mrp: 30, selling_price: 22, stock: 90 },
      { name: '1kg', unit: '1kg', mrp: 55, selling_price: 42, stock: 100 },
    ]
  }
];

async function seed() {
  console.log('🥬 Connecting to PostgreSQL...');
  const client = await pool.connect();
  try {
    console.log('🌱 Upserting categories...');
    const catMap = {};
    for (const cat of categories) {
      const res = await client.query(
        `INSERT INTO categories (name, slug, description, image, status, display_order)
         VALUES ($1, $2, $3, $4, 'active', $5)
         ON CONFLICT (slug) DO UPDATE 
         SET name = EXCLUDED.name, description = EXCLUDED.description, image = EXCLUDED.image
         RETURNING id, slug`,
        [cat.name, cat.slug, cat.description, cat.image, cat.display_order]
      );
      catMap[res.rows[0].slug] = res.rows[0].id;
    }

    console.log('🥬 Seeding products & variants...');
    for (const p of sampleProducts) {
      const categoryId = catMap[p.catSlug] || null;
      const prodRes = await client.query(
        `INSERT INTO products (name, slug, category_id, description, images, unit, mrp, selling_price, purchase_price, stock_quantity, minimum_stock, status, featured, best_seller)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13)
         ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name,
             category_id = EXCLUDED.category_id,
             description = EXCLUDED.description,
             images = EXCLUDED.images,
             unit = EXCLUDED.unit,
             mrp = EXCLUDED.mrp,
             selling_price = EXCLUDED.selling_price,
             stock_quantity = EXCLUDED.stock_quantity,
             minimum_stock = EXCLUDED.minimum_stock,
             featured = EXCLUDED.featured,
             best_seller = EXCLUDED.best_seller
         RETURNING id`,
        [
          p.name,
          p.slug,
          categoryId,
          p.description,
          p.images,
          p.unit,
          p.mrp,
          p.selling_price,
          Math.round(p.selling_price * 0.7),
          p.stock_quantity,
          p.minimum_stock,
          p.featured,
          p.best_seller,
        ]
      );

      const productId = prodRes.rows[0].id;

      // Clean existing variants for clean idempotency
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);

      for (const v of p.variants) {
        await client.query(
          `INSERT INTO product_variants (product_id, name, unit, mrp, selling_price, stock_quantity, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
          [productId, v.name, v.unit, v.mrp, v.selling_price, v.stock]
        );
      }
      console.log(`  + Seeded product: ${p.name} with ${p.variants.length} variants`);
    }

    console.log('✨ Seeded all products successfully!');
  } catch (err) {
    console.error('❌ Error during catalog seeding:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
