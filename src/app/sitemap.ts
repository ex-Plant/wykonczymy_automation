import { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: env.NEXT_PUBLIC_FRONTEND_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
