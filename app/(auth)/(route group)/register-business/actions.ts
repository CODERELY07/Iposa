'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function registerBusinessAction(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null

  if (!name) {
    return { success: false as const, message: 'Business name is required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('register_business', {
    p_name: name,
    p_slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
    p_description: description,
  })

  if (error) {
    return { success: false as const, message: error.message }
  }

  redirect('/sell')
}
