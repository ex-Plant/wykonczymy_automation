import { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '*',
    },
    sitemap: `${env.NEXT_PUBLIC_FRONTEND_URL}/sitemap.xml`,
  }
}
