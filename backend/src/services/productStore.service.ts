import fs from 'fs';
import path from 'path';
import { memoryStore } from '../config/mockDb';

const PRODUCTS_FILE = path.join(__dirname, '..', 'config', 'products.json');
const VARIANTS_FILE = path.join(__dirname, '..', 'config', 'product_variants.json');

export interface PersistedProduct {
  id: string;
  category_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  images?: string[];
  unit: string;
  mrp: number;
  selling_price: number;
  purchase_price?: number;
  stock_quantity: number;
  minimum_stock: number;
  status: string;
  featured?: boolean;
  best_seller?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PersistedVariant {
  id: string;
  product_id: string;
  name: string;
  unit: string;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  status: string;
  created_at?: string;
}

export function readProductsFromFile(): PersistedProduct[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      const data = fs.readFileSync(PRODUCTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading products.json:', err);
  }
  return [];
}

export function writeProductsToFile(products: PersistedProduct[]): void {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing products.json:', err);
  }
}

export function readVariantsFromFile(): PersistedVariant[] {
  try {
    if (fs.existsSync(VARIANTS_FILE)) {
      const data = fs.readFileSync(VARIANTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed reading product_variants.json:', err);
  }
  return [];
}

export function writeVariantsToFile(variants: PersistedVariant[]): void {
  try {
    fs.writeFileSync(VARIANTS_FILE, JSON.stringify(variants, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing product_variants.json:', err);
  }
}

// Initial hydration on module load
const initialProducts = readProductsFromFile();
if (initialProducts && initialProducts.length > 0) {
  memoryStore.products = initialProducts;
} else if (memoryStore.products && memoryStore.products.length > 0) {
  writeProductsToFile(memoryStore.products);
}

const initialVariants = readVariantsFromFile();
if (initialVariants && initialVariants.length > 0) {
  memoryStore.product_variants = initialVariants;
}

export function getPersistedProducts(): PersistedProduct[] {
  return memoryStore.products;
}

export function savePersistedProducts(products: PersistedProduct[]): PersistedProduct[] {
  memoryStore.products = products;
  writeProductsToFile(products);
  return products;
}

export function getPersistedVariants(): PersistedVariant[] {
  return memoryStore.product_variants;
}

export function savePersistedVariants(variants: PersistedVariant[]): PersistedVariant[] {
  memoryStore.product_variants = variants;
  writeVariantsToFile(variants);
  return variants;
}
