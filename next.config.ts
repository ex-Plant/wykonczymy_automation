import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    // next build's type checker doesn't pick up declare module augmentations from payload-types.ts
    // on Vercel's clean builds. We run tsc --noEmit separately in the build script instead.
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['payload', 'pino', 'pino-pretty', 'thread-stream'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
}

export default withPayload(nextConfig)
