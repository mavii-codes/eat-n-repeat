import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://eatnrepeat.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/customer', '/customer/menu', '/customer/about'],
      disallow: [
        '/admin/',
        '/staff/',
        '/checkout/',
        '/payment/',
        '/customer/account/',
        '/customer/orders/',
        '/customer/favorites/',
        '/customer/notifications/',
        '/customer/settings/',
        '/customer/profile/',
        '/login',
        '/order/',
        '/api/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
