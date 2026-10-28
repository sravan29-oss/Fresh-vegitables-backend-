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
INSERT INTO categories (name, slug, description, image, status, display_order) VALUES
('Fresh Vegetables', 'fresh-vegetables', 'Farm-fresh vegetables delivered to your doorstep', '/uploads/categories/fresh-vegetables.jpg', 'active', 1),
('Leafy Greens', 'leafy-greens', 'Fresh and nutritious leafy greens', '/uploads/categories/leafy-greens.jpg', 'active', 2),
('Root Vegetables', 'root-vegetables', 'Fresh root vegetables from local farms', '/uploads/categories/root-vegetables.jpg', 'active', 3),
('Exotic Vegetables', 'exotic-vegetables', 'Premium exotic vegetables', '/uploads/categories/exotic-vegetables.jpg', 'active', 4),
('Herbs & Seasonings', 'herbs-seasonings', 'Fresh herbs and seasonings', '/uploads/categories/herbs-seasonings.jpg', 'active', 5),
('Organic Vegetables', 'organic-vegetables', 'Certified organic vegetables', '/uploads/categories/organic-vegetables.jpg', 'active', 6)
ON CONFLICT (slug) DO NOTHING;

