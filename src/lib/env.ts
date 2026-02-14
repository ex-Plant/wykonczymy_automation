import { z } from 'zod'
import isValidUrl from './isValidUrl'

// Schema defines expected env vars and their types
const envSchema = z.object({
  // Public vars (available in browser)
  NEXT_PUBLIC_FRONTEND_URL: z.string().refine(isValidUrl, 'Invalid URL'),
  // Server-only vars
  DATABASE_URL: z.string().min(1),
  PAYLOAD_SECRET: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),
  EMAIL_HOST: z.string().min(1),
})

type EnvT = z.infer<typeof envSchema>

// Validate env vars at startup
function validateEnv(): EnvT {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:', error)
    process.exit(1)
  }
}

// Export validated, typed env object
export const env = validateEnv()
