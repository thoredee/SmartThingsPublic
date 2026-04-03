import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()

  const { data } = await supabase
    .from('shopping_list')
    .update({ is_checked: body.is_checked })
    .eq('id', params.id)
    .select()
    .single()

  return NextResponse.json(data)
}
