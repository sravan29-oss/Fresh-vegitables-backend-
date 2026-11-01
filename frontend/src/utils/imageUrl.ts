import { API_BASE_URL } from '../services/api';

const PRODUCT_FALLBACKS: Record<string, string> = {
  'green chilli': 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  chilli: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  chili: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  mirchi: 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&auto=format&fit=crop&q=80',
  lemon: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&auto=format&fit=crop&q=80',
  lime: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&auto=format&fit=crop&q=80',
  nimbu: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&auto=format&fit=crop&q=80',
  mint: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=600&auto=format&fit=crop&q=80',
  pudina: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=600&auto=format&fit=crop&q=80',
  beetroot: 'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&auto=format&fit=crop&q=80',
  chukandar: 'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600&auto=format&fit=crop&q=80',
  radish: 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600&auto=format&fit=crop&q=80',
  mooli: 'https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600&auto=format&fit=crop&q=80',
  beans: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600&auto=format&fit=crop&q=80',
  peas: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&auto=format&fit=crop&q=80',
  matar: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&auto=format&fit=crop&q=80',
  mushroom: 'https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600&auto=format&fit=crop&q=80',
  brinjal: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80',
  eggplant: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80',
  baingan: 'https://images.unsplash.com/photo-1590779033100-9f60a05a013d?w=600&auto=format&fit=crop&q=80',
  methi: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
  fenugreek: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600&auto=format&fit=crop&q=80',
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
 * Extracts backend origin (e.g. https://fresh-vegitables-backend.onrender.com)
 */
function getBackendOrigin(): string {
  if (API_BASE_URL && (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://'))) {
    try {
      const parsed = new URL(API_BASE_URL);
      return parsed.origin;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Resolves product and category image URLs:
 * 1. Handles full URLs (http, https, data, blob).
 * 2. Handles relative /uploads/... paths ensuring they resolve to the backend server.
 */
export function getProductImageUrl(imagePath?: string, productName?: string): string {
  if (!imagePath || typeof imagePath !== 'string' || !imagePath.trim()) {
    return getFallbackImageUrl(productName);
  }

  const trimmed = imagePath.trim();

  // If the product currently has the default placeholder (salad bowl) assigned,
  // resolve to the accurate real vegetable image if one matches the product name
  if (productName && trimmed.includes('photo-1540420773420-3366772f4999')) {
    const specificImage = getFallbackImageUrl(productName);
    if (specificImage && !specificImage.includes('photo-1540420773420-3366772f4999')) {
      return specificImage;
    }
  }

  // If already absolute URL, base64 data, or browser blob object URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Ensure leading slash for relative paths
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // If path is a backend upload (/uploads/...), route to the backend origin
  if (cleanPath.startsWith('/uploads')) {
    const origin = getBackendOrigin();
    if (origin) {
      return `${origin}${cleanPath}`;
    }
  }

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
