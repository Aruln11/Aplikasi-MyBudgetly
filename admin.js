const SUPABASE_URL = "https://kycmnkibuxtzrbzrhezo.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y21ua2lidXh0enJienJoZXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI3NDAsImV4cCI6MjA3NzA1ODc0MH0.WtZhCS8qRUQNX5cSJAKdyA4G7Df7izGeWcjbWZTSbE4"

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ⚡ EVENT LISTENER (Cek Login & Load Tab Terakhir)
document.addEventListener("DOMContentLoaded", () => {
  // Cek Login
  const isAdmin = localStorage.getItem("isAdminLoggedIn")

  if (isAdmin === "true") {
    document.getElementById("admin-login-modal").style.display = "none"

    // 🔥 FITUR BARU: Load tab terakhir yang dibuka
    const lastTab = localStorage.getItem("activeTab") || "pending"
    switchTab(lastTab)

    // Load data dashboard
    initDashboard()
  } else {
    document.getElementById("admin-login-modal").style.display = "flex"
  }

  // Listener Tombol Close & Klik Luar
  const closeBtn = document.getElementById("close-admin-login-btn")
  if (closeBtn) closeBtn.addEventListener("click", closeAdminLoginModal)
})

function closeAdminLoginModal() {
  window.location.href = "index.html"
}

// 🚀 SISTEM LOGIN ADMIN
async function checkAdminLogin() {
  const inputField = document.getElementById("admin-code-input")
  const input = inputField.value.trim()
  const errorMsg = document.getElementById("login-error")
  const btn = document.querySelector(".btn-login")

  if (!input) {
    inputField.focus()
    return
  }

  btn.innerText = "Memproses..."
  btn.disabled = true
  errorMsg.innerText = ""

  try {
    const { data, error } = await supabaseClient.from("admin").select("id").eq("kode_akses", input).maybeSingle()

    if (data) {
      localStorage.setItem("isAdminLoggedIn", "true")
      document.getElementById("admin-login-modal").style.display = "none"
      initDashboard()
      switchTab("pending") // Default masuk ke pending
    } else {
      throw new Error("Kode Salah")
    }
  } catch (err) {
    errorMsg.innerText = "Kode akses salah."
    btn.innerText = "Masuk"
    btn.disabled = false
    inputField.value = ""
    inputField.focus()
    inputField.classList.add("error-shake")
    setTimeout(() => inputField.classList.remove("error-shake"), 300)
  }
}

function adminLogout() {
  if (confirm("Keluar dari Dashboard?")) {
    localStorage.removeItem("isAdminLoggedIn")
    localStorage.removeItem("activeTab") // Hapus history tab
    location.reload()
  }
}

// 📊 DASHBOARD LOGIC
function initDashboard() {
  loadAdminData();
  loadPendingUsers();
  loadDataPelanggan();
  loadDevicePelanggan();
  loadSettings();
  startAdminRealtime();
}
// admin.js

async function loadPendingUsers() {
    const tbody = document.getElementById("tbody-pending");
    const badge = document.getElementById("badge-pending");
    const searchQuery = document.getElementById("search-pending")?.value.trim().toLowerCase() || "";
    const sortOrder = document.getElementById("sort-pending")?.value || "desc";

    // 1. Ambil semua data pending dari database terlebih dahulu
    const { data, error } = await supabaseClient
        .from("pelanggan")
        .select("*")
        .eq("status", "pending")
        .order("dibuat_tanggal", { ascending: sortOrder === "asc" });

    if (error) return;

    // 2. Filter data secara cerdas di sisi klien (Omnisearch)
    const filteredData = !searchQuery ? data : data.filter(p => {
        // Format tanggal daftar persis seperti yang tampil di tabel untuk dicocokkan
        const displayDate = new Date(p.dibuat_tanggal).toLocaleString("id-ID", { 
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false 
        }).replace(',', '').replace('.', ':').toLowerCase();

        // Cek apakah kata kunci ada di Nama, Kode Akses, atau Tanggal Lengkap (termasuk bulan & jam)
        return (
            p.username.toLowerCase().includes(searchQuery) || 
            p.kode_akses.toLowerCase().includes(searchQuery) || 
            displayDate.includes(searchQuery)
        );
    });

    // Update Badge (tetap berdasarkan total data asli di database)
    if (data && data.length > 0) {
        badge.innerText = data.length;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }

    // 3. Render hasil filter ke tabel
    tbody.innerHTML = "";
    if (filteredData && filteredData.length > 0) {
        filteredData.forEach(p => {
            const date = new Date(p.dibuat_tanggal).toLocaleString("id-ID", { 
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: false 
            }).replace(',', '').replace('.', ':');

            tbody.innerHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${p.username}</td>
                    <td><span style="font-family:monospace; color:var(--primary)">${p.kode_akses}</span></td>
                    <td><span class="status-badge pending">Pending</span></td>
                    <td class="text-right">
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button class="btn-terima-modern" onclick="activateUser('${p.kode_akses}')">Terima</button>
                            <button class="btn-tolak-modern" onclick="rejectUser('${p.kode_akses}')">Tolak</button>
                        </div>
                    </td>
                </tr>`;
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:2rem; color:var(--text-gray)">Data tidak ditemukan</td></tr>';
    }
}

// admin.js

// --- 1. Fungsi Tolak SEMUA Antrean (DIPERBAIKI) ---
async function rejectAllPending() {
    // Ambil data menggunakan 'kode_akses' karena kolom 'id' tidak ada
    const { data: list, error: fetchError } = await supabaseClient
        .from("pelanggan")
        .select("kode_akses") 
        .eq("status", "pending");

    if (fetchError) return alert("Gagal cek database: " + fetchError.message);
    if (!list || list.length === 0) return alert("Tidak ada antrean untuk dibersihkan.");

    // Konfirmasi dengan jumlah data yang akurat
    if (!confirm(`Hapus permanen seluruh (${list.length}) permintaan antrean?`)) return;

    // Hapus massal berdasarkan status 'pending'
    const { error: deleteError } = await supabaseClient
        .from("pelanggan")
        .delete()
        .eq("status", "pending");

    if (deleteError) {
        alert("Gagal menghapus: " + deleteError.message);
    } else {
        alert("Seluruh antrean berhasil dihapus.");
        loadPendingUsers(); // Refresh tampilan
    }
}

// --- 2. Fungsi Tolak Satu User (DIPERBAIKI) ---
async function rejectUser(kode) {
    if (!confirm(`Tolak permintaan akses untuk kode "${kode}"?`)) return;
    
    // Gunakan 'kode_akses' sebagai kunci penghapusan
    const { error } = await supabaseClient
        .from("pelanggan")
        .delete()
        .eq("kode_akses", kode);

    if (error) {
        alert("Gagal menolak: " + error.message);
    } else {
        // Tampilan akan otomatis refresh karena sistem Realtime Anda aktif
        loadPendingUsers();
    }
}

// --- 3. Fungsi Terima/Aktivasi User (DIPERBAIKI) ---
async function activateUser(kode) {
    if (!confirm(`Aktifkan akses untuk user "${kode}"?`)) return;
    
    // Update status menjadi 'aktif' berdasarkan 'kode_akses'
    const { error } = await supabaseClient
        .from("pelanggan")
        .update({ status: "aktif" })
        .eq("kode_akses", kode);

    if (error) {
        alert("Gagal mengaktifkan: " + error.message);
    } else {
        alert("User berhasil diaktifkan!");
        loadPendingUsers();
        loadDataPelanggan();
    }
}
async function loadDevicePelanggan() {
  const tbody = document.getElementById("tbody-device-pelanggan");
  const { data, error } = await supabaseClient.from("device_pelanggan").select("*");
  if (error) return;
  tbody.innerHTML = "";
  if (data && data.length > 0) {
    data.forEach(d => {
      tbody.innerHTML += `<tr><td>${d.username || '-'}</td><td>${d.kode_akses}</td><td>${d.device_model}</td><td>${d.device_id}</td><td>${d.last_login || '-'}</td></tr>`;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Tidak Ada Device Terhubung</td></tr>';
  }
}

// 🔥 CRUD ADMIN - FITUR BARU
let editingAdminId = null

async function loadAdminData() {
  const tbody = document.getElementById("tbody-admin")
  const { data, error } = await supabaseClient.from("admin").select("*").order("dibuat_tanggal", { ascending: false })

  tbody.innerHTML = ""

  if (data && data.length > 0) {
    data.forEach((admin) => {
      // admin.js
const date = new Date(admin.dibuat_tanggal).toLocaleString("id-ID", { 
    timeZone: "Asia/Jakarta",
    day: "numeric", 
    month: "short", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false
}).replace(',', '').replace('.', ':');
      const row = `
        <tr>
            <td><strong>${admin.id}</strong></td>
            <td>${admin.username}</td>
            <td style="font-family:monospace; color:var(--primary)">${admin.kode_akses}</td>
            <td>${date}</td>
            <td class="text-center">
                <div class="action-buttons" style="display: flex; justify-content: center !important; gap: 8px;">
                    <button class="btn-outline-black" onclick="editAdmin(${admin.id}, '${admin.username}', '${admin.kode_akses}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <button class="btn-solid-black" onclick="deleteAdmin(${admin.id})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Hapus
                    </button>
                </div>
            </td>
        </tr>`
      tbody.innerHTML += row
    })
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:1.5rem; color:#999">Belum ada data admin</td></tr>'
  }
}

function openAdminModal() {
  editingAdminId = null
  document.getElementById("admin-modal-title").innerText = "Tambah Admin"
  document.getElementById("admin-username-input").value = ""
  document.getElementById("admin-kode-input-new").value = ""
  document.getElementById("admin-crud-error").innerText = ""
  document.getElementById("admin-crud-modal").style.display = "flex"
}

function closeAdminModal() {
  document.getElementById("admin-crud-modal").style.display = "none"
}

function editAdmin(id, username, kode) {
  editingAdminId = id
  document.getElementById("admin-modal-title").innerText = "Edit Admin"
  document.getElementById("admin-username-input").value = username
  document.getElementById("admin-kode-input-new").value = kode
  document.getElementById("admin-crud-error").innerText = ""
  document.getElementById("admin-crud-modal").style.display = "flex"
}

async function saveAdmin() {
  const username = document.getElementById("admin-username-input").value.trim()
  const kode = document.getElementById("admin-kode-input-new").value.trim()
  const errorMsg = document.getElementById("admin-crud-error")

  if (!username || !kode) {
    errorMsg.innerText = "Semua field harus diisi!"
    return
  }

  try {
    if (editingAdminId) {
      // Update
      const { error } = await supabaseClient
        .from("admin")
        .update({ username, kode_akses: kode })
        .eq("id", editingAdminId)

      if (error) throw error
      alert("Admin berhasil diupdate!")
    } else {
      // Insert
      const { error } = await supabaseClient.from("admin").insert({ username, kode_akses: kode })

      if (error) throw error
      alert("Admin berhasil ditambahkan!")
    }

    closeAdminModal()
    loadAdminData()
  } catch (err) {
    console.error(err)
    errorMsg.innerText = "Terjadi kesalahan. Kode mungkin sudah digunakan."
  }
}

async function deleteAdmin(id) {
  if (!confirm("Hapus admin ini?")) return

  try {
    const { error } = await supabaseClient.from("admin").delete().eq("id", id)

    if (error) throw error
    alert("Admin berhasil dihapus!")
    loadAdminData()
  } catch (err) {
    console.error(err)
    alert("Gagal menghapus admin.")
  }
}

// ==========================================
// 👥 MANAJEMEN PELANGGAN (CRUD + INDIKATOR)
// ==========================================
let editingPelangganId = null; // Variabel untuk menyimpan ID saat edit

async function loadDataPelanggan() {
  const tbody = document.getElementById("tbody-data-pelanggan");
  
  const { data, error } = await supabaseClient
    .from("pelanggan")
    .select(`*, device_pelanggan (id)`)
    .neq("status", "pending")
    .order("dibuat_tanggal", { ascending: false });

  tbody.innerHTML = "";

  if (data && data.length > 0) {
    data.forEach((pelanggan) => {
      const date = new Date(pelanggan.dibuat_tanggal).toLocaleString("id-ID", { 
    timeZone: "Asia/Jakarta",
    day: "numeric", 
    month: "short", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false
}).replace(',', '').replace('.', ':');
      let statusBadge = "";
      if (pelanggan.status === "aktif") statusBadge = '<span class="status-badge active">Aktif</span>';
      else if (pelanggan.status === "pending") statusBadge = '<span class="status-badge pending">Pending</span>';
      else statusBadge = '<span class="status-badge blocked">Diblokir</span>';

      const usedDevices = pelanggan.device_pelanggan ? pelanggan.device_pelanggan.length : 0;
      const maxDevices = pelanggan.batas_perangkat || 3;
      let deviceColor = usedDevices >= maxDevices ? '#ef4444' : '#10b981';
      const deviceIndicator = `<span style="font-weight:bold; color:${deviceColor}">${usedDevices}</span> / ${maxDevices}`;

      const row = `
        <tr>
            <td><strong>${pelanggan.username}</strong></td>
            <td style="font-family:monospace; color:var(--primary)">${pelanggan.kode_akses}</td>
            <td>${statusBadge}</td>
            <td class="text-center" style="font-size: 1rem;">${deviceIndicator}</td>
            <td>${date}</td>
            <td class="text-center">
                <div class="action-buttons" style="display: flex; justify-content: center !important; gap: 8px;">
                    <button class="btn-outline-black" onclick="editPelanggan('${pelanggan.id}', '${pelanggan.username}', '${pelanggan.kode_akses}', ${pelanggan.batas_perangkat})">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    
                    ${pelanggan.status === 'aktif' 
                        ? `<button class="btn-solid-black" onclick="blockUser('${pelanggan.kode_akses}')">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                             Blokir
                           </button>` 
                        : `<button class="btn-solid-black" onclick="activateUser('${pelanggan.kode_akses}')">
                             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                             Aktifkan
                           </button>`
                    }
                    
                    <button class="btn-solid-black" onclick="deletePelanggan('${pelanggan.kode_akses}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Hapus
                    </button>
                </div>
            </td>
        </tr>`;
      tbody.innerHTML += row;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:1.5rem; color:#999">Belum ada data pelanggan</td></tr>';
  }
}

// --- FUNGSI CRUD PELANGGAN ---

function openPelangganModal() {
    editingPelangganId = null; // Reset ID (Mode Tambah)
    document.getElementById('pelanggan-modal-title').innerText = "Tambah Pelanggan";
    document.getElementById('pelanggan-username').value = "";
    document.getElementById('pelanggan-kode').value = "";
    document.getElementById('pelanggan-kode').disabled = false; // Kode bisa diedit kalau baru
    document.getElementById('pelanggan-batas').value = "3";
    document.getElementById('pelanggan-error').innerText = "";
    document.getElementById('pelanggan-crud-modal').style.display = "flex";
}

function closePelangganModal() {
    document.getElementById('pelanggan-crud-modal').style.display = "none";
}

function editPelanggan(id, username, kode, batas) {
    editingPelangganId = id; // Set ID (Mode Edit)
    document.getElementById('pelanggan-modal-title').innerText = "Edit Pelanggan";
    document.getElementById('pelanggan-username').value = username;
    document.getElementById('pelanggan-kode').value = kode;
    document.getElementById('pelanggan-kode').disabled = false; // Kode TIDAK boleh diganti saat edit (biar tidak error relasi)
    document.getElementById('pelanggan-batas').value = batas;
    document.getElementById('pelanggan-error').innerText = "";
    document.getElementById('pelanggan-crud-modal').style.display = "flex";
}

async function savePelanggan() {
    const username = document.getElementById('pelanggan-username').value.trim();
    const kode = document.getElementById('pelanggan-kode').value.trim();
    const batas = document.getElementById('pelanggan-batas').value;
    const errorMsg = document.getElementById('pelanggan-error');

    if (!username || !kode || !batas) {
        errorMsg.innerText = "Semua kolom wajib diisi!";
        return;
    }

    try {
        if (editingPelangganId) {
            // MODE EDIT: Tambahkan kode_akses agar ikut diperbarui
            const { error } = await supabaseClient
                .from('pelanggan')
                .update({ 
                    username: username, 
                    kode_akses: kode, // PERBAIKAN: Masukkan kode_akses di sini
                    batas_perangkat: batas 
                })
                .eq('id', editingPelangganId);

            if (error) throw error;
            alert('Data pelanggan berhasil diperbarui!');
        } else {
            // MODE TAMBAH BARU (Tetap sama)
            const { data: existing } = await supabaseClient.from('pelanggan').select('id').eq('kode_akses', kode).maybeSingle();
            if (existing) throw new Error("Kode akses sudah digunakan!");

            await supabaseClient.from('pelanggan').insert({ 
                username, 
                kode_akses: kode, 
                batas_perangkat: batas, 
                status: 'aktif',
                dibuat_tanggal: new Date().toISOString() 
            });
            alert('Pelanggan baru berhasil ditambahkan!');
        }
        closePelangganModal();
        loadDataPelanggan(); 
    } catch (err) {
        errorMsg.innerText = err.message;
    }
}
async function deletePelanggan(kode) {
    if (!confirm(`Yakin hapus pelanggan dengan kode "${kode}"?\n\nPERINGATAN: Semua data transaksi dan perangkat user ini akan dihapus permanen!`)) return;

    // Hapus dari tabel pelanggan (karena Cascade Delete biasanya aktif, data device & transaksi ikut terhapus)
    // Jika tidak cascade, hapus manual satu-satu. Kita asumsikan Cascade atau hapus Parent dulu.
    const { error } = await supabaseClient.from('pelanggan').delete().eq('kode_akses', kode);

    if (error) {
        alert("Gagal menghapus: " + error.message);
    } else {
        alert("Pelanggan berhasil dihapus.");
        loadDataPelanggan();
        loadDevicePelanggan(); // Refresh tabel device juga
    }
}

// Fungsi Aktivasi & Blokir (Updated)
async function activateUser(kode) {
  if (!confirm("Aktifkan user ini?")) return
  await supabaseClient.from("pelanggan").update({ status: "aktif" }).eq("kode_akses", kode)
  loadDataPelanggan()
}

async function blockUser(kode) {
  if (!confirm("Blokir user ini? User tidak akan bisa login.")) return
  await supabaseClient.from("pelanggan").update({ status: "diblokir" }).eq("kode_akses", kode)
  loadDataPelanggan()
}

function filterTable(type) {
  const searchId = `search-${type}`
  const tbodyId = `tbody-${type}`
  const input = document.getElementById(searchId).value.toLowerCase()
  const rows = document.querySelectorAll(`#${tbodyId} tr`)
  rows.forEach((row) => {
    const text = row.innerText.toLowerCase()
    row.style.display = text.includes(input) ? "" : "none"
  })
}

// Ganti fungsi loadSettings lama kamu dengan ini
async function loadSettings() {
    // 1. Load status Auto-ACC
    const { data: autoAcc } = await supabaseClient.from("pengaturan_admin").select("status").eq("setting_fitur", "auto acc").maybeSingle();
    
    // 2. Load status Maintenance DAN Pesannya
    const { data: maintenance } = await supabaseClient
        .from("pengaturan_admin")
        .select("status, value") // Ambil kolom value juga
        .eq("setting_fitur", "maintenance mode")
        .maybeSingle();

    // 3. Load Batas Perangkat
    const { data: limitSetting } = await supabaseClient
        .from("pengaturan_admin")
        .select("value") 
        .eq("setting_fitur", "default device limit")
        .maybeSingle();

    // Tampilkan ke UI
    if (autoAcc) document.getElementById("toggle-auto-acc").checked = autoAcc.status;
    
    if (maintenance) {
        document.getElementById("toggle-maintenance").checked = maintenance.status;
        // Masukkan pesan dari database ke kotak teks
        document.getElementById("input-maintenance-msg").value = maintenance.value || "";
    }

    if (limitSetting) {
        document.getElementById("input-default-limit").value = limitSetting.value;
    }
}
async function updateDefaultLimit() {
    const newLimit = document.getElementById("input-default-limit").value;
    if (!newLimit || newLimit < 1) return alert("Batas perangkat minimal 1!");

    const { error } = await supabaseClient
        .from("pengaturan_admin")
        .update({ value: newLimit.toString() }) // Simpan ke kolom 'value'
        .eq("setting_fitur", "default device limit");

    if (!error) {
        alert("Batas perangkat default berhasil diperbarui!");
    }
}
// Tambahkan sebagai fungsi baru di bawah updateDefaultLimit
async function saveMaintenanceMessage() {
    const msg = document.getElementById("input-maintenance-msg").value;
    
    const { error } = await supabaseClient
        .from("pengaturan_admin")
        .update({ value: msg })
        .eq("setting_fitur", "maintenance mode");

    if (!error) {
        alert("Pesan maintenance berhasil diperbarui!");
    } else {
        alert("Gagal menyimpan pesan: " + error.message);
    }
}
async function toggleMaintenance(el) {
  const { error } = await supabaseClient
    .from("pengaturan_admin")
    .update({ status: el.checked })
    .eq("setting_fitur", "maintenance mode");
  
  if (!error) {
    alert(el.checked ? "Mode Maintenance telah DIAKTIFKAN." : "Mode Maintenance telah DINONAKTIFKAN.");
  }
}

// admin.js
async function toggleAutoAcc(el) {
    const isAutoAccOn = el.checked;

    // 1. Simpan pengaturan ke database
    const { error: settingsError } = await supabaseClient
        .from("pengaturan_admin")
        .update({ status: isAutoAccOn })
        .eq("setting_fitur", "auto acc");

    if (settingsError) return alert("Gagal mengubah pengaturan Auto-ACC");

    // 2. Jika ON, langsung proses ACC semua user yang sedang pending
    if (isAutoAccOn) {
        const { error: updateError } = await supabaseClient
            .from("pelanggan")
            .update({ status: "aktif" })
            .eq("status", "pending");

        if (!updateError) {
            alert("Auto-ACC Aktif: Semua antrean telah disetujui otomatis!");
            loadPendingUsers(); // Refresh tabel antrean
            loadDataPelanggan(); // Refresh tabel pelanggan
        }
    }
}
function switchTab(tab) {
  // 1. Simpan tab aktif ke localStorage
  localStorage.setItem("activeTab", tab)

  // 2. Sembunyikan semua section
  document.querySelectorAll(".content-section").forEach((el) => (el.style.display = "none"))

  // 3. Reset semua menu & submenu
  document.querySelectorAll(".menu-item").forEach((el) => el.classList.remove("active", "expanded"))
  document.querySelectorAll(".submenu-item").forEach((el) => el.classList.remove("active"))

  // 4. Tampilkan section yang dipilih
  const targetSection = document.getElementById(`view-${tab}`)
  if (targetSection) targetSection.style.display = "block"

  // 5. Update page title
  const titles = {
    admin: "Data Admin",
    "data-pelanggan": "Data Pelanggan",
    "device-pelanggan": "Device Pelanggan",
    pending: "Menunggu Persetujuan",
    settings: "Pengaturan",
  }
  document.getElementById("page-title").innerText = titles[tab] || "Dashboard"

  // 6. Set active state pada menu yang sesuai
  const menuItems = document.querySelectorAll(".menu-item")
  const submenuItems = document.querySelectorAll(".submenu-item")

  if (tab === "admin") {
    menuItems[0].classList.add("active")
  } else if (tab === "data-pelanggan" || tab === "device-pelanggan" || tab === "pending") {
    // Expand submenu pelanggan
    menuItems[1].classList.add("expanded")
    document.getElementById("submenu-pelanggan").classList.add("open")

    // Set active pada submenu item
    if (tab === "data-pelanggan") submenuItems[0].classList.add("active")
    if (tab === "device-pelanggan") submenuItems[1].classList.add("active")
    if (tab === "pending") submenuItems[2].classList.add("active")
  } else if (tab === "settings") {
    menuItems[2].classList.add("active")
  }
}

function toggleSubmenu(menu) {
  const submenu = document.getElementById(`submenu-${menu}`)
  const menuItem = event.currentTarget

  submenu.classList.toggle("open")
  menuItem.classList.toggle("expanded")
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar")
  const overlay = document.querySelector(".sidebar-overlay")
  const body = document.body

  // Cek apakah mode mobile atau desktop (batas 1024px)
  if (window.innerWidth <= 1024) {
    // --- LOGIC MOBILE ---
    sidebar.classList.toggle("open")
    overlay.classList.toggle("open")
  } else {
    // --- LOGIC DESKTOP ---
    body.classList.toggle("sidebar-closed")
  }
}

function toggleSidebarMobile() {
  if (window.innerWidth <= 1024) {
    const sidebar = document.getElementById("sidebar")
    const overlay = document.querySelector(".sidebar-overlay")
    sidebar.classList.remove("open")
    overlay.classList.remove("open")
  }
}
// --- 2. FUNGSI IMPORT (UPLOAD CSV) - VERSI BERSIH ---
function importCSV(input, table) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        // Bersihkan header dari spasi/karakter aneh
        const headers = rows[0].split(',').map(h => h.trim().replace(/[\r\n]+/gm, ""));
        
        let successCount = 0;
        let failCount = 0;

        // Loop baris data (mulai index 1)
        for (let i = 1; i < rows.length; i++) {
            // Bersihkan baris dari spasi kosong dan enter
            const rowString = rows[i].trim(); 
            if (!rowString) continue; // Skip baris kosong

            const rowData = rowString.split(',');
            
            // Validasi jumlah kolom
            if (rowData.length !== headers.length) {
                console.warn("Baris tidak valid (jumlah kolom beda):", rowString);
                failCount++;
                continue; 
            }

            const record = {};
            headers.forEach((header, index) => {
                let value = rowData[index].trim();
                // Hapus tanda kutip jika ada (biasanya CSV pakai "value")
                value = value.replace(/^"|"$/g, '');
                
                if (value !== 'null' && value !== '') {
                    record[header] = value;
                }
            });

            // Hapus ID agar auto-increment database bekerja (untuk menghindari konflik ID ganda)
            delete record.id; 

            const { error } = await supabaseClient.from(table).insert(record);
            if (!error) successCount++;
            else {
                console.error("Gagal import:", error);
                failCount++;
            }
        }

        // Alert Tanpa Emoji (Profesional)
        alert(`Impor Selesai.\nBerhasil: ${successCount}\nGagal: ${failCount}`);
        
        if (table === 'pelanggan') loadDataPelanggan();
        if (table === 'admin') loadAdminData();
    };

    reader.readAsText(file);
    input.value = ''; 
}
// --- FUNGSI EKSPOR (DOWNLOAD CSV) ---
// --- FUNGSI EKSPOR TERUPDATE (FIX ERROR ID) ---
async function exportCSV(table) {
    try {
        console.log(`Memulai ekspor tabel: ${table}...`);
        
        // PERBAIKAN: Gunakan 'dibuat_tanggal' untuk mengurutkan, bukan 'id'
        const { data, error } = await supabaseClient
            .from(table)
            .select('*')
            .order('dibuat_tanggal', { ascending: false }); 

        if (error) throw error;

        if (!data || data.length === 0) {
            alert(`Tidak ada data di tabel ${table} untuk diekspor.`);
            return;
        }

        // Ambil nama kolom (header) dari data pertama
        const headers = Object.keys(data[0]);
        
        // Gabungkan header dan isi data menjadi format CSV
        const csvContent = [
            headers.join(','), 
            ...data.map(row => 
                headers.map(fieldName => {
                    let value = row[fieldName] === null ? '' : row[fieldName];
                    // Bungkus dengan tanda kutip jika data mengandung koma agar tidak berantakan
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        // Proses Download Otomatis
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        const date = new Date().toISOString().split('T')[0];
        link.setAttribute("href", url);
        link.setAttribute("download", `backup-${table}-${date}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`Ekspor ${table} berhasil!`);

    } catch (err) {
        console.error("Gagal mengekspor data:", err);
        alert("Gagal ekspor: " + err.message);
    }
}

// admin.js

async function loadDevicePelanggan() {
  const tbody = document.getElementById("tbody-device-pelanggan");
  
  // KUNCI: Gunakan .select("*, pelanggan(username)") untuk mengambil nama pemilik perangkat
  const { data, error } = await supabaseClient
    .from("device_pelanggan")
    .select(`*, pelanggan(username)`); 

  if (error) return;
  
  tbody.innerHTML = "";
  if (data && data.length > 0) {
    data.forEach(d => {
      // Ambil username dari tabel pelanggan yang terhubung
      const ownerName = d.pelanggan ? d.pelanggan.username : (d.username || 'Tamu');
      
      const date = d.last_login ? new Date(d.last_login).toLocaleString("id-ID", { 
          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      }).replace('.', ':') : '-';

      const cleanModel = formatDeviceModel(d.device_model);

      tbody.innerHTML += `
        <tr>
          <td style="font-weight:600; color:#0f172a;">${ownerName}</td>
          <td><span style="font-family:monospace; color:var(--primary)">${d.kode_pelanggan}</span></td>
          <td title="${d.device_model}">${cleanModel}</td>
          <td><small style="color:#94a3b8">${d.device_id.substring(0, 8)}...</small></td>
          <td>${date}</td>
          <td class="text-center">
            <button class="btn-mini btn-reset" onclick="deleteDevice('${d.device_id}')">Hapus</button>
          </td>
        </tr>`;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding:2rem;">Tidak ada device terhubung</td></tr>';
  }
}

// Fungsi Hapus Device Spesifik
async function deleteDevice(deviceId) {
    if (!confirm("Cabut akses perangkat ini?")) return;
    const { error } = await supabaseClient.from("device_pelanggan").delete().eq("device_id", deviceId);
    if (!error) {
        alert("Akses perangkat dicabut!");
        loadDevicePelanggan();
        loadDataPelanggan();
    }
}
// admin.js

function startAdminRealtime() {
    // 1. Monitor Perubahan Data Pelanggan (ACC/Tolak/Edit)
    supabaseClient
        .channel('admin-updates')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'pelanggan' 
        }, () => {
            loadPendingUsers();
            loadDataPelanggan();
        })
        .subscribe();

    // 2. MONITOR PERANGKAT (KUNCI BARU: Agar realtime saat user login/logout)
    supabaseClient
        .channel('device-updates')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'device_pelanggan' 
        }, () => {
            console.log("Ada aktivitas perangkat baru...");
            loadDevicePelanggan(); // Refresh tabel device otomatis
            loadDataPelanggan();   // Refresh indikator kuota device di menu Pelanggan
        })
        .subscribe();
}
// admin.js

// Fungsi untuk buka/tutup menu urutan
function toggleSortMenu() {
    document.getElementById('sortMenu').classList.toggle('show');
}

// admin.js

function selectSort(value, label) {
    // 1. Update teks tombol utama
    document.getElementById('current-sort-text').innerText = label;
    
    // 2. Update nilai input hidden untuk query
    document.getElementById('sort-pending').value = value;
    
    // 3. Reset semua item, lalu beri tanda aktif pada yang dipilih
    const items = document.querySelectorAll('.sort-item');
    items.forEach(item => {
        if (item.innerText === label) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 4. Tutup menu & load data
    document.getElementById('sortMenu').classList.remove('show');
    loadPendingUsers(); 
}

// Tutup menu jika klik di luar
window.addEventListener('click', function(e) {
    if (!document.getElementById('customSort').contains(e.target)) {
        document.getElementById('sortMenu').classList.remove('show');
    }
});
// admin.js

function formatDeviceModel(ua) {
    if (!ua) return "Perangkat Tidak Dikenal";

    let brand = "Android";
    let browser = "Chrome";

    // 1. DETEKSI BROWSER
    if (ua.includes("FBAN") || ua.includes("FBAV")) browser = "Facebook";
    else if (ua.includes("Instagram")) browser = "Instagram";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    // 2. DETEKSI MEREK BERDASARKAN KODE MODEL ANDROID
    if (ua.includes("Android")) {
        // Daftar pemetaan kode model ke Merek
        const brandPatterns = [
            { name: "Samsung", patterns: ["Samsung", "SM-", "GT-", "SCH-", "SGH-"] },
            { name: "Xiaomi/Redmi", patterns: ["Xiaomi", "Redmi", "POCO", "MI ", "210", "220", "230"] },
            { name: "Oppo", patterns: ["OPPO", "CPH", "PHT", "PGG"] },
            { name: "Vivo", patterns: ["vivo", "V2", "V1", "PD"] },
            { name: "Realme", patterns: ["Realme", "RMX"] },
            { name: "Infinix", patterns: ["Infinix", "X6", "X5"] },
            { name: "Huawei", patterns: ["HUAWEI", "VOG", "ELE", "ANA"] }
        ];

        for (const b of brandPatterns) {
            if (b.patterns.some(p => ua.includes(p))) {
                brand = b.name;
                break;
            }
        }

        // Coba ambil kode model spesifik (misal: SM-A525F)
        const modelMatch = ua.match(/Android\s\d+;\s([^;]+)\)/);
        let modelCode = modelMatch ? modelMatch[1].trim() : "";
        
        // Bersihkan hasil jika hanya angka atau huruf K
        if (modelCode === "K" || !isNaN(modelCode)) modelCode = "";

        return `${brand}${modelCode ? ' (' + modelCode + ')' : ''} — ${browser}`;
    } 
    
    // 3. DETEKSI PERANGKAT NON-ANDROID
    if (ua.includes("iPhone")) return `iPhone — ${browser}`;
    if (ua.includes("Windows NT 10.0")) return `Windows PC — ${browser}`;
    if (ua.includes("Mac OS X")) return `MacBook — ${browser}`;

    return `Lainnya — ${browser}`;
}