// supabase/functions/aktivasi-perangkat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Tangani preflight request (CORS)
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

    // 1. Cek kodenya ada dan ambil batas perangkatnya
    const { data: lisensi, error: lisensiError } = await supabaseAdmin
      .from('kode_akses') // Nama tabel Anda
      .select('batas_perangkat')
      .eq('kode', code)
      .single()

    if (lisensiError || !lisensi) {
      return new Response(JSON.stringify({ success: false, message: 'Kode lisensi tidak ditemukan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const batasPerangkat = lisensi.batas_perangkat
    
    // Jika batas_perangkat adalah 0 (default), tolak login
    if (batasPerangkat < 1) { 
        return new Response(JSON.stringify({ success: false, message: 'Lisensi ini belum diatur (batas perangkat masih 0).' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        })
    }

    // 2. Cek apakah perangkat ini sudah terdaftar
    const { data: perangkatIni, error: perangkatIniError } = await supabaseAdmin
      .from('perangkat_terdaftar') // Nama tabel Anda
      .select('id, kode_ref') // Ambil juga kode_ref
      .eq('device_id', deviceId) // Cek berdasarkan deviceId
      .single()

    if (perangkatIni) {
      // Perangkat ini sudah terdaftar. Cek apakah kodenya sama.
      if (perangkatIni.kode_ref === code) {
         // Ya, deviceId ini sudah terdaftar dengan kode ini. Izinkan login.
        return new Response(JSON.stringify({ success: true, message: 'Login kembali berhasil.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else {
        // DeviceId ini sudah dipakai, TAPI OLEH KODE LAIN.
        return new Response(JSON.stringify({ success: false, message: 'Perangkat ini sudah terikat dengan kode lisensi lain.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    // 3. Perangkat ini BARU. Cek sisa slot.
    const { count, error: countError } = await supabaseAdmin
      .from('perangkat_terdaftar') // Nama tabel Anda
      .select('*', { count: 'exact', head: true }) // 'head:true' hanya hitung
      .eq('kode_ref', code)

    if (countError) throw countError

    // 4. Bandingkan jumlah (count) dengan batas
    if (count >= batasPerangkat) {
      // Slot penuh!
      return new Response(JSON.stringify({ success: false, message: `Akses penuh. Kode ini hanya untuk ${batasPerangkat} perangkat.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 5. Masih ada slot! Daftarkan perangkat baru ini.
    const { error: insertError } = await supabaseAdmin
      .from('perangkat_terdaftar') // Nama tabel Anda
      .insert({ kode_ref: code, device_id: deviceId })

    if (insertError) throw insertError

    // Sukses
    return new Response(JSON.stringify({ success: true, message: 'Perangkat baru berhasil diaktifkan.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})