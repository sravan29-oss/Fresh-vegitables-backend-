import React, { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'product' | 'article';
  ogImage?: string;
  schema?: Record<string, any> | Array<Record<string, any>>;
  noindex?: boolean;
}

const BASE_URL = 'https://fresh-vegetables-organic.vercel.app';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop';
const DEFAULT_TITLE = 'Fresh Vegetables Organic | Farm-Fresh Vegetables Online';
const DEFAULT_DESCRIPTION = 'Shop fresh daily vegetables online with Fresh Vegetables Organic. Local doorstep delivery within our 5 km service zone in Hyderabad.';
const DEFAULT_KEYWORDS = 'Fresh Vegetables Organic, fresh vegetables online, buy vegetables online, fresh vegetable delivery, online vegetable shopping';

function setMetaTag(attributeName: 'name' | 'property', attributeValue: string, content: string) {
  let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export const SEOHead: React.FC<SEOProps> = ({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  canonicalUrl,
  ogType = 'website',
  ogImage = DEFAULT_IMAGE,
  schema,
  noindex = false,
}) => {
  useEffect(() => {
    // Determine canonical URL
    const canonical = canonicalUrl || (typeof window !== 'undefined' ? `${BASE_URL}${window.location.pathname}` : BASE_URL);

    // 1. Dynamic document title
    document.title = title;

    // 2. Robots Indexing Control
    if (noindex) {
      setMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      setMetaTag('name', 'robots', 'index, follow');
    }

    // 3. Standard Search Meta Tags
    setMetaTag('name', 'description', description);
    setMetaTag('name', 'keywords', keywords);

    // 4. Canonical Link
    setCanonicalLink(canonical);

    // 4. Open Graph Tags
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:url', canonical);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:site_name', 'Fresh Vegetables Organic');

    // 5. Twitter Card Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);

    // 6. Schema.org JSON-LD Structured Data
    const defaultSchema = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Fresh Vegetables Organic',
        url: BASE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${BASE_URL}/products?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Fresh Vegetables Organic',
        url: BASE_URL,
        logo: `${BASE_URL}/favicon.png`,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+91 8106970384',
          email: 'freshvegitables29@gmail.com',
          contactType: 'Customer Support',
          areaServed: 'IN',
        },
      },
    ];

    const finalSchema = schema || defaultSchema;
    let scriptTag = document.getElementById('json-ld-schema') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'json-ld-schema';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(finalSchema);

    return () => {
      // Cleanup is handled on the next page update
    };
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, schema]);

  return null;
};
