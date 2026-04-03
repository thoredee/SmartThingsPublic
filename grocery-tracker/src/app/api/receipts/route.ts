import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { ParsedReceipt } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Get the user's household
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const body: ParsedReceipt = await request.json()

  // Save the receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      household_id: profile.household_id,
      uploaded_by: user.id,
      store: body.store,
      purchase_date: body.purchase_date,
      total_amount: body.total_amount,
    })
    .select()
    .single()

  if (receiptError || !receipt) {
    return NextResponse.json({ error: 'Failed to save receipt' }, { status: 500 })
  }

  // Save all items
  const items = body.items.map(item => ({
    receipt_id: receipt.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unit_price,
    total_price: item.total_price,
    category: item.category,
  }))

  const { error: itemsError } = await supabase.from('receipt_items').insert(items)

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to save items' }, { status: 500 })
  }

  // Update pantry estimates for each item
  for (const item of body.items) {
    await supabase.rpc('upsert_pantry_item', {
      p_household_id: profile.household_id,
      p_name: item.name,
      p_category: item.category,
      p_quantity: item.quantity,
      p_unit: item.unit,
      p_purchased_at: body.purchase_date,
    })
  }

  return NextResponse.json({ id: receipt.id })
}

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: receipts } = await supabase
    .from('receipts')
    .select('*, items:receipt_items(*)')
    .eq('household_id', profile.household_id)
    .order('purchase_date', { ascending: false })
    .limit(50)

  return NextResponse.json(receipts ?? [])
}
