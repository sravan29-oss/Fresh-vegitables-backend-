-- Fresh Vegetables — Seed Data for Development
-- Run AFTER migrations

-- ============================================================
-- ADMIN USER (password: admin123)
-- ============================================================
INSERT INTO admins (name, email, password, role) VALUES
('Sravan Kumar', 'naredlasravankumar29@gmail.com', '$2b$10$fN7C1aZpT7qefZRzrnjWouSTAmq/uJyNKfXcVIcUjXWYt7D4f.uY6', 'super_admin'),
('Super Admin', 'admin@freshvegetables.com', '$2b$10$8K1p/YKGqXqYxLzVoP3Yyu.g5xEH7K3/.XUz8eO/kQM3gLtYXvqKe', 'super_admin'),
('Admin', 'admin@freshveggies.com', '$2b$10$8K1p/YKGqXqYxLzVoP3Yyu.g5xEH7K3/.XUz8eO/kQM3gLtYXvqKe', 'admin')
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

-- ============================================================
-- CATEGORIES
-- ============================================================
INSERT INTO categories (id, name, slug, description, image, status, display_order) VALUES
('8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh', 'fresh', 'Farm-fresh organic vegetables delivered to your doorstep', '/uploads/categories/fresh-vegetables.jpg', 'active', 1),
('11111111-2222-3333-4444-555555555551', 'Fresh Vegetables', 'fresh-vegetables', 'Farm-fresh vegetables delivered to your doorstep', '/uploads/categories/fresh-vegetables.jpg', 'active', 2),
('11111111-2222-3333-4444-555555555552', 'Leafy Greens', 'leafy-greens', 'Fresh and nutritious leafy greens', '/uploads/categories/leafy-greens.jpg', 'active', 3),
('11111111-2222-3333-4444-555555555553', 'Root Vegetables', 'root-vegetables', 'Fresh root vegetables from local farms', '/uploads/categories/root-vegetables.jpg', 'active', 4),
('11111111-2222-3333-4444-555555555554', 'Exotic Vegetables', 'exotic-vegetables', 'Premium exotic vegetables', '/uploads/categories/exotic-vegetables.jpg', 'active', 5),
('11111111-2222-3333-4444-555555555555', 'Herbs & Seasonings', 'herbs-seasonings', 'Fresh herbs and seasonings', '/uploads/categories/herbs-seasonings.jpg', 'active', 6),
('11111111-2222-3333-4444-555555555556', 'Organic Vegetables', 'organic-vegetables', 'Certified organic vegetables', '/uploads/categories/organic-vegetables.jpg', 'active', 7)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- PRODUCTS (Added by Admin)
-- ============================================================
INSERT INTO products (id, name, slug, category_id, description, images, unit, mrp, selling_price, stock_quantity, minimum_stock, status, featured, best_seller) VALUES
('faf5d663-3868-40a9-8933-ed0560ec4c53', 'Tomato', 'tomato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh From Market When order reach', '{"/uploads/products/e617cc8b-b81d-4b2c-b622-8c9cc407fd85.webp"}', '500grms', 28.00, 25.00, 41, 5, 'active', true, true),
('344f868a-89e0-425c-aeef-8d34533b29f0', 'Lady Finger', 'lady-finger', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh organic tender lady fingers (bhindi)', '{"/uploads/products/3fde6e03-c8c8-495d-9698-94fe1cae6f37.jpg"}', '50Grms', 81.00, 71.00, 40, 5, 'active', true, true),
('1a9b98b2-0629-4cac-9318-c2c65107989d', 'Fresh Onion', 'fresh-onion', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Locally grown crisp and flavorful onions', '{"/uploads/products/0d811c27-2289-4ab1-98a9-e244529e039c.jpg"}', '1Kg', 50.00, 50.00, 40, 5, 'active', true, false),
('52bf6893-9533-495d-b1db-6621b568f666', 'Organically Grown Coriander Leaves', 'organically-grown-coriander-leaves', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Fresh and aromatic organically grown coriander', '{"/uploads/products/45d16aa7-365d-425f-8180-dc1237bbfe20.jpg"}', '100grms', 45.00, 30.00, 40, 5, 'active', true, false),
('378716d3-0609-4c9f-90b1-b5dc2eb6dbc6', 'Potato', 'potato', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Farm-fresh premium quality organic potatoes', '{"/uploads/products/57ba83f7-4556-49cb-9bdf-ff77b63be99a.jpg"}', '1kg', 60.00, 55.00, 40, 5, 'active', true, false),
('7720acc5-22d6-4cbb-be3d-334d823dccca', 'Carrot Local', 'carrot-local', '8e8bbc30-1625-4f6b-8b5f-6c33ae7501cd', 'Sweet and crunchy locally harvested carrots', '{"/uploads/products/5a3e8a3b-9bdf-4350-b461-c481dc76e502.jpg"}', '250grms', 52.00, 30.00, 40, 5, 'active', true, false)
ON CONFLICT (slug) DO UPDATE SET
  selling_price = EXCLUDED.selling_price,
  mrp = EXCLUDED.mrp,
  stock_quantity = EXCLUDED.stock_quantity,
  images = EXCLUDED.images,
  status = 'active';

