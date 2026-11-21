/**
 * Centralized Product 3D Asset Registry
 *
 * Maps every product in Fresh Vegetables Organic to its authoritative
 * 3D presentation profile, guaranteeing that:
 * 1. Every product's 3D experience is visually anchored to its genuine original product image.
 * 2. No unrelated vegetable (e.g. Tomato for Cucumber) is EVER shown.
 * 3. Option B (Full 3D mesh) is used where accurate botanical geometry exists.
 * 4. Option A (Original-Image-Based Volumetric 2.5D) is used for single-image and specialized products.
 * 5. If 3D rendering cannot be performed, it falls back to the clean 2D Photo.
 */

export type ProductRenderMode = '3d-mesh' | '2.5d-volumetric' | 'photo-fallback';

export interface Product3DProfile {
  slug: string;
  name: string;
  categorySlug: string;
  renderMode: ProductRenderMode;
  meshType?:
    | 'tomato'
    | 'cucumber'
    | 'carrot'
    | 'potato'
    | 'onion'
    | 'lady-finger'
    | 'chilli'
    | 'cauliflower'
    | 'leafy-greens'
    | 'dairy-pack';
  themeColor: string; // Hex color for rim, depth bevel, and subtle ambient studio bounce
  accentColor: string;
  roughness: number;
  clearcoat: number;
  aspectRatio: number; // width / height of original photo to eliminate distortion
  depth: number; // Volumetric extrusion depth
  curvature: number; // Organic camber/curvature factor
  rotationLimits: {
    canRotate360: boolean;
    minAzimuth: number; // radians
    maxAzimuth: number;
    minPolar: number;
    maxPolar: number;
  };
  lightingPreset?: 'farm' | 'studio' | 'harvest';
}

/**
 * Authoritative registry of all audited catalog products
 */
export const PRODUCT_3D_REGISTRY: Record<string, Product3DProfile> = {
  // 1. Green Cucumber (Kheera)
  'green-cucumber-kheera': {
    slug: 'green-cucumber-kheera',
    name: 'Green Cucumber (Kheera)',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'cucumber',
    themeColor: '#2d6a4f',
    accentColor: '#52b788',
    roughness: 0.28,
    clearcoat: 0.45,
    aspectRatio: 0.65,
    depth: 0.32,
    curvature: 0.15,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 2. Tomato
  tomato: {
    slug: 'tomato',
    name: 'Tomato',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'tomato',
    themeColor: '#dc2626',
    accentColor: '#16a34a',
    roughness: 0.18,
    clearcoat: 0.7,
    aspectRatio: 1.0,
    depth: 0.4,
    curvature: 0.25,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 3. Carrot Local
  'carrot-local': {
    slug: 'carrot-local',
    name: 'Carrot Local',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'carrot',
    themeColor: '#ea580c',
    accentColor: '#22c55e',
    roughness: 0.35,
    clearcoat: 0.3,
    aspectRatio: 0.55,
    depth: 0.28,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 4. Potato
  potato: {
    slug: 'potato',
    name: 'Potato',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'potato',
    themeColor: '#a16207',
    accentColor: '#ca8a04',
    roughness: 0.55,
    clearcoat: 0.1,
    aspectRatio: 1.15,
    depth: 0.38,
    curvature: 0.22,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 5. Fresh Onion
  'fresh-onion': {
    slug: 'fresh-onion',
    name: 'Fresh Onion',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'onion',
    themeColor: '#c2410c',
    accentColor: '#ea580c',
    roughness: 0.25,
    clearcoat: 0.5,
    aspectRatio: 1.05,
    depth: 0.36,
    curvature: 0.2,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 6. Lady Finger
  'lady-finger': {
    slug: 'lady-finger',
    name: 'Lady Finger',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'lady-finger',
    themeColor: '#15803d',
    accentColor: '#166534',
    roughness: 0.32,
    clearcoat: 0.35,
    aspectRatio: 0.45,
    depth: 0.25,
    curvature: 0.1,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 7. Green Chilli
  'green-chilli': {
    slug: 'green-chilli',
    name: 'Green Chilli',
    categorySlug: 'fresh',
    renderMode: '3d-mesh',
    meshType: 'chilli',
    themeColor: '#16a34a',
    accentColor: '#15803d',
    roughness: 0.22,
    clearcoat: 0.6,
    aspectRatio: 0.4,
    depth: 0.22,
    curvature: 0.18,
    rotationLimits: {
      canRotate360: true,
      minAzimuth: -Infinity,
      maxAzimuth: Infinity,
      minPolar: Math.PI / 4,
      maxPolar: (3 * Math.PI) / 4,
    },
  },

  // 8. Bottle Gourd
  'bottle-gourd': {
    slug: 'bottle-gourd',
    name: 'Bottle Gourd',
    categorySlug: 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#65a30d',
    accentColor: '#84cc16',
    roughness: 0.3,
    clearcoat: 0.4,
    aspectRatio: 0.6,
    depth: 0.3,
    curvature: 0.14,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 9. Organically Grown Cauliflower
  'organically-grown-cauliflower': {
    slug: 'organically-grown-cauliflower',
    name: 'Organically Grown Cauliflower',
    categorySlug: 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#15803d',
    accentColor: '#fef08a',
    roughness: 0.45,
    clearcoat: 0.2,
    aspectRatio: 1.1,
    depth: 0.32,
    curvature: 0.18,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 10. Baby Banana
  'baby-banana': {
    slug: 'baby-banana',
    name: 'Baby Banana',
    categorySlug: 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#ca8a04',
    accentColor: '#eab308',
    roughness: 0.28,
    clearcoat: 0.4,
    aspectRatio: 0.85,
    depth: 0.26,
    curvature: 0.16,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 11. Goruchikkudu (Cluster Beans)
  goruchikkudu: {
    slug: 'goruchikkudu',
    name: 'Goruchikkudu',
    categorySlug: 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#166534',
    accentColor: '#22c55e',
    roughness: 0.35,
    clearcoat: 0.25,
    aspectRatio: 0.9,
    depth: 0.24,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 12. Green palak (Palakura)
  'green-palak-palakura': {
    slug: 'green-palak-palakura',
    name: 'Green palak (Palakura)',
    categorySlug: 'leafy-vegetables',
    renderMode: '2.5d-volumetric',
    themeColor: '#14532d',
    accentColor: '#22c55e',
    roughness: 0.38,
    clearcoat: 0.35,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 13. Gongura Leaves
  'gongura-leaves': {
    slug: 'gongura-leaves',
    name: 'Gongura Leaves',
    categorySlug: 'leafy-vegetables',
    renderMode: '2.5d-volumetric',
    themeColor: '#15803d',
    accentColor: '#86efac',
    roughness: 0.36,
    clearcoat: 0.32,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 14. Thotakura
  thotakura: {
    slug: 'thotakura',
    name: 'Thotakura',
    categorySlug: 'leafy-vegetables',
    renderMode: '2.5d-volumetric',
    themeColor: '#166534',
    accentColor: '#4ade80',
    roughness: 0.36,
    clearcoat: 0.3,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 15. Coriander
  coriander: {
    slug: 'coriander',
    name: 'Coriander',
    categorySlug: 'coriander-others',
    renderMode: '2.5d-volumetric',
    themeColor: '#15803d',
    accentColor: '#4ade80',
    roughness: 0.38,
    clearcoat: 0.3,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 16. Organically Grown Coriander Leaves
  'organically-grown-coriander-leaves': {
    slug: 'organically-grown-coriander-leaves',
    name: 'Organically Grown Coriander Leaves',
    categorySlug: 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#15803d',
    accentColor: '#4ade80',
    roughness: 0.38,
    clearcoat: 0.3,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 17. Pudina (Mint)
  pudina: {
    slug: 'pudina',
    name: 'Pudina',
    categorySlug: 'coriander-others',
    renderMode: '2.5d-volumetric',
    themeColor: '#166534',
    accentColor: '#86efac',
    roughness: 0.35,
    clearcoat: 0.32,
    aspectRatio: 1.0,
    depth: 0.22,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 18. Heritage milk
  'heritage-milk': {
    slug: 'heritage-milk',
    name: 'Heritage milk',
    categorySlug: 'dairy',
    renderMode: '2.5d-volumetric',
    themeColor: '#0284c7',
    accentColor: '#f8fafc',
    roughness: 0.2,
    clearcoat: 0.7,
    aspectRatio: 0.8,
    depth: 0.25,
    curvature: 0.08,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3.5,
      maxAzimuth: Math.PI / 3.5,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 19. Organic buffalo milk
  'organic-buffalo-milk': {
    slug: 'organic-buffalo-milk',
    name: 'Organic buffalo milk',
    categorySlug: 'dairy',
    renderMode: '2.5d-volumetric',
    themeColor: '#0f766e',
    accentColor: '#f1f5f9',
    roughness: 0.2,
    clearcoat: 0.7,
    aspectRatio: 0.8,
    depth: 0.25,
    curvature: 0.08,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3.5,
      maxAzimuth: Math.PI / 3.5,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },

  // 20. Organic Curd
  'organic-curd': {
    slug: 'organic-curd',
    name: 'Organic Curd',
    categorySlug: 'dairy',
    renderMode: '2.5d-volumetric',
    themeColor: '#0369a1',
    accentColor: '#ffffff',
    roughness: 0.25,
    clearcoat: 0.65,
    aspectRatio: 0.95,
    depth: 0.3,
    curvature: 0.1,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3.5,
      maxAzimuth: Math.PI / 3.5,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  },
};

/**
 * Resolves a product's 3D profile reliably by slug or name
 * GUARANTEES: Never falls back to a mismatched procedural vegetable!
 */
export function resolveProduct3DProfile(
  slug?: string,
  name?: string,
  categorySlug?: string
): Product3DProfile {
  // 1. Direct slug match in registry
  if (slug && PRODUCT_3D_REGISTRY[slug]) {
    return PRODUCT_3D_REGISTRY[slug];
  }

  // 2. Normalized name check against registry keys
  const normName = (name || slug || '').toLowerCase().trim();

  for (const [key, profile] of Object.entries(PRODUCT_3D_REGISTRY)) {
    if (normName.includes(key) || key.includes(normName)) {
      return profile;
    }
  }

  // 3. Keyword matching for botanical produce
  if (normName.includes('cucumber') || normName.includes('kheera')) {
    return PRODUCT_3D_REGISTRY['green-cucumber-kheera'];
  }
  if (normName.includes('tomato')) {
    return PRODUCT_3D_REGISTRY['tomato'];
  }
  if (normName.includes('carrot') || normName.includes('gajar')) {
    return PRODUCT_3D_REGISTRY['carrot-local'];
  }
  if (normName.includes('potato') || normName.includes('aloo')) {
    return PRODUCT_3D_REGISTRY['potato'];
  }
  if (normName.includes('onion') || normName.includes('pyaz')) {
    return PRODUCT_3D_REGISTRY['fresh-onion'];
  }
  if (normName.includes('finger') || normName.includes('bhindi') || normName.includes('okra')) {
    return PRODUCT_3D_REGISTRY['lady-finger'];
  }
  if (normName.includes('chilli') || normName.includes('mirchi')) {
    return PRODUCT_3D_REGISTRY['green-chilli'];
  }
  if (normName.includes('bottle gourd') || normName.includes('sorakaya') || normName.includes('lauki')) {
    return PRODUCT_3D_REGISTRY['bottle-gourd'];
  }
  if (normName.includes('cauliflower') || normName.includes('gobi')) {
    return PRODUCT_3D_REGISTRY['organically-grown-cauliflower'];
  }
  if (normName.includes('banana')) {
    return PRODUCT_3D_REGISTRY['baby-banana'];
  }
  if (normName.includes('milk')) {
    return PRODUCT_3D_REGISTRY['heritage-milk'];
  }
  if (normName.includes('curd') || normName.includes('dahi') || normName.includes('yogurt')) {
    return PRODUCT_3D_REGISTRY['organic-curd'];
  }
  if (normName.includes('coriander') || normName.includes('kothimeera')) {
    return PRODUCT_3D_REGISTRY['coriander'];
  }
  if (normName.includes('mint') || normName.includes('pudina')) {
    return PRODUCT_3D_REGISTRY['pudina'];
  }
  if (normName.includes('palak') || normName.includes('spinach')) {
    return PRODUCT_3D_REGISTRY['green-palak-palakura'];
  }

  // 4. Fallback: Default to Volumetric 2.5D Image-based presentation using the product's own photo!
  // NEVER default to tomato or unrelated shapes!
  return {
    slug: slug || 'custom-product',
    name: name || 'Fresh Produce',
    categorySlug: categorySlug || 'fresh',
    renderMode: '2.5d-volumetric',
    themeColor: '#15803d',
    accentColor: '#22c55e',
    roughness: 0.35,
    clearcoat: 0.4,
    aspectRatio: 1.0,
    depth: 0.25,
    curvature: 0.12,
    rotationLimits: {
      canRotate360: false,
      minAzimuth: -Math.PI / 3,
      maxAzimuth: Math.PI / 3,
      minPolar: Math.PI / 3,
      maxPolar: (2 * Math.PI) / 3,
    },
  };
}
