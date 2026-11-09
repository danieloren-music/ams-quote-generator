'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: String(formData.get('name')),
      customer: String(formData.get('customer') || ''),
      description: String(formData.get('description') || ''),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/');
  redirect(`/projects/${data.id}`);
}
