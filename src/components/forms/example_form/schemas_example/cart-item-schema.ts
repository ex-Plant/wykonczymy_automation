import { z } from 'zod'

export const cartItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Product name is required'),
  price: z.number().min(0, 'Price must be positive'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  image: z.string().optional(),
})

export const cartStoreSchema = z.object({
  items: z.array(cartItemSchema),
  totalPrice: z.number().min(0),
})

export type CartItemT = z.infer<typeof cartItemSchema>
export type CartStoreSchemaT = z.infer<typeof cartStoreSchema>
