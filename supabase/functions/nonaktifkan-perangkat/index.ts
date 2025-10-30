// supabase/functions/nonaktifkan-perangkat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Tangani preflight request (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Saat logout, kita hanya perlu menghapus deviceId ini dari daftar
    const { deviceId } = await req.json()
    if (!deviceId) {
      throw new Error('Device ID tidak ada.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Hapus perangkat ini dari tabel perangkat_terdaftar
    // Kita tidak perlu tahu kodenya, cukup deviceId-nya
    await supabaseAdmin
      .from('perangkat_terdaftar') // Nama tabel Anda
      .delete()
      .eq('device_id', deviceId)

    return new Response(JSON.stringify({ success: true, message: 'Perangkat dinonaktifkan.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})