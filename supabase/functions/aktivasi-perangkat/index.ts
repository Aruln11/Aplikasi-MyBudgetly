// supabase/functions/aktivasi-perangkat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, deviceId } = await req.json()
    if (!code || !deviceId) {
      throw new Error('Kode atau Device ID tidak ada.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lisensi, error: lisensiError } = await supabaseAdmin
      .from('kode_akses')
      .select('batas_perangkat')
      .eq('kode', code)
      .single()

    // 1. Pesan jika kode salah
    if (lisensiError || !lisensi) {
      return new Response(JSON.stringify({ success: false, message: 'Kode akses salah.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }

    const batasPerangkat = lisensi.batas_perangkat
    
    // 2. Pesan jika batas masih 0
    if (batasPerangkat < 1) { 
        return new Response(JSON.stringify({ success: false, message: 'Lisensi ini belum diatur (batas 0).' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        })
    }

    const { data: perangkatIni } = await supabaseAdmin
      .from('perangkat_terdaftar')
      .select('id, kode_ref') 
      .eq('device_id', deviceId) 
      .single()

    if (perangkatIni) {
      if (perangkatIni.kode_ref === code) {
        return new Response(JSON.stringify({ success: true, message: 'Login kembali berhasil.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        // 3. Pesan jika perangkat terikat kode lain
        return new Response(JSON.stringify({ success: false, message: 'Perangkat ini terikat kode lain.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, 
        })
      }
    }

    const { count, error: countError } = await supabaseAdmin
      .from('perangkat_terdaftar')
      .select('*', { count: 'exact', head: true }) 
      .eq('kode_ref', code)

    if (countError) throw countError

    // 4. PESAN JIKA BATAS PERANGKAT PENUH (SESUAI PERMINTAAN ANDA)
    if (count >= batasPerangkat) {
      return new Response(JSON.stringify({ success: false, message: `Kode akses melebihi jumlah batas.` }), { // <-- DIUBAH
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }

    // 5. Jika sukses...
    const { error: insertError } = await supabaseAdmin
      .from('perangkat_terdaftar')
      .insert({ kode_ref: code, device_id: deviceId })

    if (insertError) throw insertError

    return new Response(JSON.stringify({ success: true, message: 'Perangkat baru berhasil diaktifkan.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    // 6. Pesan jika server crash (biarkan ini)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})