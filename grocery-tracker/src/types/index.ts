export type Category =
  | 'fresh-produce'
  | 'dairy'
  | 'meat-fish'
  | 'bakery'
  | 'frozen'
  | 'drinks'
  | 'snacks'
  | 'cleaning'
  | 'personal-care'
  | 'baby'
  | 'other'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  household_id: string
  name: string
  email: string
}

export interface Receipt {
  id: string
  household_id: string
  uploaded_by: string
  store: string
  purchase_date: string
  total_amount: number
  image_url: string | null
  created_at: string
  items?: ReceiptItem[]
}

export interface ReceiptItem {
  id: string
  receipt_id: string
  name: string
  quantity: number
  unit: string | null
  unit_price: number
  total_price: number
  category: Category
  created_at: string
}

export interface PantryItem {
  id: string
  household_id: string
  name: string
  category: Category
  estimated_quantity: number
  unit: string | null
  last_purchased_at: string
  avg_days_between_purchase: number | null
  updated_at: string
}

export interface ShoppingListItem {
  id: string
  household_id: string
  name: string
  category: Category
  quantity: number
  unit: string | null
  added_by: string
  is_checked: boolean
  created_at: string
}

// What Claude returns when parsing a receipt
export interface ParsedReceipt {
  store: string
  purchase_date: string // ISO date string
  total_amount: number
  items: ParsedItem[]
}

export interface ParsedItem {
  name: string
  quantity: number
  unit: string | null
  unit_price: number
  total_price: number
  category: Category
}
