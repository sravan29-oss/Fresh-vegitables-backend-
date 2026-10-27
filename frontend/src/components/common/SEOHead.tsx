import React, { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  schema?: Record<string, any>;
}

export const SEOHead: React.FC<SEOProps> = ({
  title = 'Fresh Vegetables — 100% Farm-Fresh Organic Greens in 30 Mins',
  description = 'Shop daily harvested organic vegetables, leafy greens, and native root vegetables directly from farmers with 30-minute doorstep delivery.',
  keywords = 'fresh vegetables, organic produce, online vegetable delivery, leafy greens, daily essentials, farm direct',
  canonicalUrl,
  ogImage = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop',
  schema,
}) => {
  useEffect(() => {
    // 1. Dynamic Title
    document.title = title;

    // 2. Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // 3. Open Graph Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]') || document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    ogTitle.setAttribute('content', title);
    document.head.appendChild(ogTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]') || document.createElement('meta');
    ogDesc.setAttribute('property', 'og:description');
    ogDesc.setAttribute('content', description);
    document.head.appendChild(ogDesc);

    const ogImg = document.querySelector('meta[property="og:image"]') || document.createElement('meta');
    ogImg.setAttribute('property', 'og:image');
    ogImg.setAttribute('content', ogImage);
    document.head.appendChild(ogImg);

    // 4. Schema.org JSON-LD Structured Data
    const defaultSchema = {
      '@context': 'https://schema.org',
      '@type': 'GroceryStore',
      name: 'Fresh Vegetables Platform',
      image: ogImage,
      description,
      telephone: '+91-9876543210',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Madhapur Express Hub',
        addressLocality: 'Hyderabad',
        postalCode: '500081',
        addressCountry: 'IN',
      },
      priceRange: '₹₹',
    };

    const finalSchema = schema || defaultSchema;
    let scriptTag = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'json-ld-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(finalSchema);
  }, [title, description, keywords, canonicalUrl, ogImage, schema]);

  return null;
};
