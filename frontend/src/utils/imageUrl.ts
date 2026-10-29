import { API_BASE_URL } from '../services/api';

const PRODUCT_FALLBACKS: Record<string, string> = {
  tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
  onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop&q=80',
  potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80',
  carrot: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80',
  'lady finger': 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80',
  bhindi: 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=600&auto=format&fit=crop&q=80',
  coriander: 'https://images.unsplash.com/photo-1514733670139-4d87a1941d55?w=600&auto=format&fit=crop&q=80',
  spinach: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
  palak: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
  capsicum: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop&q=80',
  cucumber: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=600&auto=format&fit=crop&q=80',
  cauliflower: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=600&auto=format&fit=crop&q=80',
  cabbage: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&auto=format&fit=crop&q=80',
  garlic: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=600&auto=format&fit=crop&q=80',
  ginger: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80',
};

/**
 * Resolves product image URLs:
 * 1. Handles full URLs (http, https, data).
 * 2. Handles relative /uploads/... paths ensuring they resolve correctly on both local dev and production.
 */
export function getProductImageUrl(imagePath?: string, productName?: string): string {
  if (!imagePath || typeof imagePath !== 'string' || !imagePath.trim()) {
    return getFallbackImageUrl(productName);
  }

  const trimmed = imagePath.trim();

  // If already absolute URL or base64 data
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Ensure leading slash for relative paths
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return cleanPath;
}

/**
 * Returns a specific, high-definition real vegetable image if local image fails to load.
 */
export function getFallbackImageUrl(productName?: string): string {
  if (!productName) return PRODUCT_FALLBACKS.default;

  const lower = productName.toLowerCase();
  for (const [key, url] of Object.entries(PRODUCT_FALLBACKS)) {
    if (key !== 'default' && lower.includes(key)) {
      return url;
    }
  }

  return PRODUCT_FALLBACKS.default;
}
