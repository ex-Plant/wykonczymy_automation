import type { Payload } from 'payload'

const SEED_ADMIN = {
  email: 'admin@wykonczymy.pl',
  password: 'admin123',
  name: 'Admin',
  role: 'ADMIN' as const,
}

export const seed = async (payload: Payload): Promise<void> => {
  const existingUsers = await payload.count({ collection: 'users' })

  if (existingUsers.totalDocs > 0) return

  await payload.create({
    collection: 'users',
    data: SEED_ADMIN,
  })

  payload.logger.info(`Seeded admin user: ${SEED_ADMIN.email} (password: ${SEED_ADMIN.password})`)
}
