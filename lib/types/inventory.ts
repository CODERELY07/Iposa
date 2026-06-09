export type Category = {
  id: number
  name: string
  created_at: string
}

export type Product = {
  id: number
  category_id: number | null
  name: string
  sku: string | null
  barcode: string | null
  price: number
  stock: number
  created_at: string
  categories?: { name: string } | null
}

export type CartItem = {
  product: Product
  quantity: number
}