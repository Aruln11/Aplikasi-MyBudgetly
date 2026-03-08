const SUPABASE_URL = "https://kycmnkibuxtzrbzrhezo.supabase.co"
const SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y21ua2lidXh0enJienJoZXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI3NDAsImV4cCI6MjA3NzA1ODc0MH0.WtZhCS8qRUQNX5cSJAKdyA4G7Df7izGeWcjbWZTSbE4"

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

document.addEventListener("DOMContentLoaded", () => {
  const isAdmin = localStorage.getItem("isAdminLoggedIn")

  if (isAdmin === "true") {
    document.getElementById("admin-login-modal").style.display = "none"
    const lastTab = localStorage.getItem("activeTab") || "pending"
    switchTab(lastTab)
    initDashboard()
  } else {
    document.getElementById("admin-login-modal").style.display = "flex"
  }

  const closeBtn = document.getElementById("close-admin-login-btn")
  if (closeBtn) closeBtn.addEventListener("click", closeAdminLoginModal)
})

function closeAdminLoginModal() {
  window.location.href = "index.html"
}

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
      switchTab("pending")
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
    localStorage.removeItem("activeTab")
    location.reload()
  }
}

function initDashboard() {
  loadAdminData();
  loadPendingUsers();
  loadDataPelanggan();
  loadDevicePelanggan();
  loadSettings();
  startAdminRealtime();
}

async function loadPendingUsers() {
    const tbody = document.getElementById("tbody-pending");
    const badge = document.getElementById("badge-pending");
    const searchQuery = document.getElementById("search-pending")?.value.trim().toLowerCase() || "";
    const sortOrder = document.getElementById("sort-pending")?.value || "desc";

    const { data, error } = await supabaseClient
        .from("pelanggan")
        .select("*")
        .eq("status", "pending")
        .order("dibuat_tanggal", { ascending: sortOrder === "asc" });

    if (error) return;

    const filteredData = !searchQuery ? data : data.filter(p => {
        const displayDate = new Date(p.dibuat_tanggal).toLocaleString("id-ID", { 
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false 
        }).replace(',', '').replace('.', ':').toLowerCase();

        return (
            p.username.toLowerCase().includes(searchQuery) || 
            p.kode_akses.toLowerCase().includes(searchQuery) || 
            displayDate.includes(searchQuery)
        );
    });

    if (data && data.length > 0) {
        badge.innerText = data.length;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }

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

async function rejectAllPending() {
    const { data: list, error: fetchError } = await supabaseClient
        .from("pelanggan")
        .select("kode_akses") 
        .eq("status", "pending");

    if (fetchError) return alert("Gagal cek database: " + fetchError.message);
    if (!list || list.length === 0) return alert("Tidak ada antrean untuk dibersihkan.");

    if (!confirm(`Hapus permanen seluruh (${list.length}) permintaan antrean?`)) return;

    const { error: deleteError } = await supabaseClient
        .from("pelanggan")
        .delete()
        .eq("status", "pending");

    if (deleteError) {
        alert("Gagal menghapus: " + deleteError.message);
    } else {
        alert("Seluruh antrean berhasil dihapus.");
        loadPendingUsers();
    }
}

async function rejectUser(kode) {
    if (!confirm(`Tolak permintaan akses untuk kode "${kode}"?`)) return;
    const { error } = await supabaseClient
        .from("pelanggan")
        .delete()
        .eq("kode_akses", kode);

    if (error) {
        alert("Gagal menolak: " + error.message);
    } else {
        loadPendingUsers();
    }
}

async function activateUser(kode) {
    if (!confirm(`Aktifkan akses untuk user "${kode}"?`)) return;
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

let editingAdminId = null

async function loadAdminData() {
  const tbody = document.getElementById("tbody-admin");
  const urutan = document.getElementById("val-sort-admin")?.value || "desc";

  const { data, error } = await supabaseClient
    .from("admin")
    .select("*")
    .order("dibuat_tanggal", { ascending: urutan === "asc" });

  tbody.innerHTML = "";

  if (data && data.length > 0) {
    data.forEach((admin) => {
      const date = new Date(admin.dibuat_tanggal).toLocaleString("id-ID", { 
          timeZone: "Asia/Jakarta",
          day: "numeric", 
          month: "short", 
          year: "numeric",
          hour: "2-digit", 
          minute: "2-digit",
          hour12: false
      }).replace(',', '').replace('.', ':');

      tbody.innerHTML += `
        <tr>
            <td><strong>${admin.id}</strong></td>
            <td>${admin.username}</td>
            <td style="font-family:monospace; color:var(--primary)">${admin.kode_akses}</td>
            <td>${date}</td>
            <td class="text-center">
                <div class="action-buttons" style="display: flex; justify-content: center !important; gap: 8px;">
                    <button class="btn-outline-black" onclick="editAdmin(${admin.id}, '${admin.username}', '${admin.kode_akses}')">
                        Edit
                    </button>
                    <button class="btn-solid-black" onclick="deleteAdmin(${admin.id})">
                        Hapus
                    </button>
                </div>
            </td>
        </tr>`;
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:1.5rem; color:#999">Belum ada data admin</td></tr>';
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
      const { error } = await supabaseClient
        .from("admin")
        .update({ username, kode_akses: kode })
        .eq("id", editingAdminId)

      if (error) throw error
      alert("Admin berhasil diupdate!")
    } else {
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

let editingPelangganId = null;

async function loadDataPelanggan() {
  const tbody = document.getElementById("tbody-data-pelanggan");
  const urutan = document.getElementById("val-sort-pelanggan").value;
  
  const { data, error } = await supabaseClient
    .from("pelanggan")
    .select(`*, device_pelanggan (id)`)
    .neq("status", "pending")
    .order("dibuat_tanggal", { ascending: urutan==="asc" });

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

function openPelangganModal() {
    editingPelangganId = null;
    document.getElementById('pelanggan-modal-title').innerText = "Tambah Pelanggan";
    document.getElementById('pelanggan-username').value = "";
    document.getElementById('pelanggan-kode').value = "";
    document.getElementById('pelanggan-kode').disabled = false;
    document.getElementById('pelanggan-batas').value = "3";
    document.getElementById('pelanggan-error').innerText = "";
    document.getElementById('pelanggan-crud-modal').style.display = "flex";
}

function closePelangganModal() {
    document.getElementById('pelanggan-crud-modal').style.display = "none";
}

function editPelanggan(id, username, kode, batas) {
    editingPelangganId = id;
    document.getElementById('pelanggan-modal-title').innerText = "Edit Pelanggan";
    document.getElementById('pelanggan-username').value = username;
    document.getElementById('pelanggan-kode').value = kode;
    document.getElementById('pelanggan-kode').disabled = false;
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
            const { error } = await supabaseClient
                .from('pelanggan')
                .update({ 
                    username: username, 
                    kode_akses: kode,
                    batas_perangkat: batas 
                })
                .eq('id', editingPelangganId);

            if (error) throw error;
            alert('Data pelanggan berhasil diperbarui!');
        } else {
            const { data: existing } = await supabaseClient.from('pelanggan').select('id').eq('kode_akses', kode).maybeSingle();
            if (existing) throw new Error("Kode akses sudah digunakan!");

            const tanggalSekarang = new Date().toLocaleString("sv-SE").replace(' ', 'T');

            await supabaseClient.from('pelanggan').insert({ 
                username, 
                kode_akses: kode, 
                batas_perangkat: batas, 
                status: 'aktif',
                dibuat_tanggal: tanggalSekarang
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

    const { error } = await supabaseClient.from('pelanggan').delete().eq('kode_akses', kode);

    if (error) {
        alert("Gagal menghapus: " + error.message);
    } else {
        alert("Pelanggan berhasil dihapus.");
        loadDataPelanggan();
        loadDevicePelanggan();
    }
}

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

async function loadSettings() {
    const { data: autoAcc } = await supabaseClient.from("pengaturan_admin").select("status").eq("setting_fitur", "auto acc").maybeSingle();
    const { data: maintenance } = await supabaseClient
        .from("pengaturan_admin")
        .select("status, value")
        .eq("setting_fitur", "maintenance mode")
        .maybeSingle();

    const { data: limitSetting } = await supabaseClient
        .from("pengaturan_admin")
        .select("value") 
        .eq("setting_fitur", "default device limit")
        .maybeSingle();

    if (autoAcc) document.getElementById("toggle-auto-acc").checked = autoAcc.status;
    if (maintenance) {
        document.getElementById("toggle-maintenance").checked = maintenance.status;
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
        .update({ value: newLimit.toString() })
        .eq("setting_fitur", "default device limit");

    if (!error) {
        alert("Batas perangkat default berhasil diperbarui!");
    }
}
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

async function toggleAutoAcc(el) {
    const isAutoAccOn = el.checked;

    const { error: settingsError } = await supabaseClient
        .from("pengaturan_admin")
        .update({ status: isAutoAccOn })
        .eq("setting_fitur", "auto acc");

    if (settingsError) return alert("Gagal mengubah pengaturan Auto-ACC");

    if (isAutoAccOn) {
        const { error: updateError } = await supabaseClient
            .from("pelanggan")
            .update({ status: "aktif" })
            .eq("status", "pending");

        if (!updateError) {
            alert("Auto-ACC Aktif: Semua antrean telah disetujui otomatis!");
            loadPendingUsers();
            loadDataPelanggan();
        }
    }
}
function switchTab(tab) {
  localStorage.setItem("activeTab", tab)
  document.querySelectorAll(".content-section").forEach((el) => (el.style.display = "none"))
  document.querySelectorAll(".menu-item").forEach((el) => el.classList.remove("active", "expanded"))
  document.querySelectorAll(".submenu-item").forEach((el) => el.classList.remove("active"))

  const targetSection = document.getElementById(`view-${tab}`)
  if (targetSection) targetSection.style.display = "block"

  const titles = {
    admin: "Data Admin",
    "data-pelanggan": "Data Pelanggan",
    "device-pelanggan": "Device Pelanggan",
    pending: "Menunggu Persetujuan",
    settings: "Pengaturan",
  }
  document.getElementById("page-title").innerText = titles[tab] || "Dashboard"

  const menuItems = document.querySelectorAll(".menu-item")
  const submenuItems = document.querySelectorAll(".submenu-item")

  if (tab === "admin") {
    menuItems[0].classList.add("active")
  } else if (tab === "data-pelanggan" || tab === "device-pelanggan" || tab === "pending") {
    menuItems[1].classList.add("expanded")
    document.getElementById("submenu-pelanggan").classList.add("open")

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

  if (window.innerWidth <= 1024) {
    sidebar.classList.toggle("open")
    overlay.classList.toggle("open")
  } else {
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

function importCSV(input, table) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const text = e.target.result;
        const rows = text.split('\n');
        const headers = rows[0].split(',').map(h => h.trim().replace(/[\r\n]+/gm, ""));
        
        let successCount = 0;
        let failCount = 0;

        for (let i = 1; i < rows.length; i++) {
            const rowString = rows[i].trim(); 
            if (!rowString) continue;

            const rowData = rowString.split(',');
            if (rowData.length !== headers.length) {
                failCount++;
                continue; 
            }

            const record = {};
            headers.forEach((header, index) => {
                let value = rowData[index].trim();
                value = value.replace(/^"|"$/g, '');
                
                if (value !== 'null' && value !== '') {
                    record[header] = value;
                }
            });

            delete record.id; 

            const { error } = await supabaseClient.from(table).insert(record);
            if (!error) successCount++;
            else {
                failCount++;
            }
        }

        alert(`Impor Selesai.\nBerhasil: ${successCount}\nGagal: ${failCount}`);
        if (table === 'pelanggan') loadDataPelanggan();
        if (table === 'admin') loadAdminData();
    };

    reader.readAsText(file);
    input.value = ''; 
}

async function exportCSV(table) {
    try {
        const { data, error } = await supabaseClient
            .from(table)
            .select('*')
            .order('dibuat_tanggal', { ascending: false }); 

        if (error) throw error;
        if (!data || data.length === 0) {
            alert(`Tidak ada data di tabel ${table} untuk diekspor.`);
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','), 
            ...data.map(row => 
                headers.map(fieldName => {
                    let value = row[fieldName] === null ? '' : row[fieldName];
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

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
    } catch (err) {
        console.error(err);
        alert("Gagal ekspor: " + err.message);
    }
}

async function loadDevicePelanggan() {
  const tbody = document.getElementById("tbody-device-pelanggan");
  const urutan = document.getElementById("val-sort-device")?.value || "desc";

  const { data, error } = await supabaseClient
    .from("device_pelanggan")
    .select(`*, pelanggan(username)`)
    .order("terhubung_pada", { ascending: urutan === "asc" });

  if (error) return;
  
  tbody.innerHTML = "";
  if (data && data.length > 0) {
    data.forEach(d => {
      const ownerName = d.pelanggan ? d.pelanggan.username : (d.username || 'Tamu');
      const date = d.terhubung_pada ? new Date(d.terhubung_pada).toLocaleString("id-ID", { 
          timeZone: "Asia/Jakarta",
          day: "numeric", 
          month: "short", 
          year: "numeric",
          hour: "2-digit", 
          minute: "2-digit",
          hour12: false
      }).replace(',', '') : '-';

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

async function deleteDevice(deviceId) {
    if (!confirm("Cabut akses perangkat ini?")) return;
    const { error } = await supabaseClient.from("device_pelanggan").delete().eq("device_id", deviceId);
    if (!error) {
        alert("Akses perangkat dicabut!");
        loadDevicePelanggan();
        loadDataPelanggan();
    }
}

function startAdminRealtime() {
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

    supabaseClient
        .channel('device-updates')
        .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'device_pelanggan' 
        }, () => {
            loadDevicePelanggan();
            loadDataPelanggan();
        })
        .subscribe();
}

function toggleSortMenu() {
    document.getElementById('sortMenu').classList.toggle('show');
}

function selectSort(value, label) {
    document.getElementById('current-sort-text').innerText = label;
    document.getElementById('sort-pending').value = value;
    const items = document.querySelectorAll('.sort-item');
    items.forEach(item => {
        if (item.innerText === label) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    document.getElementById('sortMenu').classList.remove('show');
    loadPendingUsers(); 
}

window.addEventListener('click', function(e) {
    const sortPending = document.getElementById('customSort');
    if (sortPending && !sortPending.contains(e.target)) {
        document.getElementById('sortMenu').classList.remove('show');
    }

    const sortPelanggan = document.getElementById('sortContainerPelanggan');
    if (sortPelanggan && !sortPelanggan.contains(e.target)) {
        document.getElementById('menuSortPelanggan').classList.remove('show');
    }

    const sortDevice = document.getElementById('sortContainerDevice');
    if (sortDevice && !sortDevice.contains(e.target)) {
        document.getElementById('menuSortDevice').classList.remove('show');
    }

    const sortAdmin = document.getElementById('sortContainerAdmin');
    if (sortAdmin && !sortAdmin.contains(e.target)) {
        document.getElementById('menuSortAdmin').classList.remove('show');
    }
});

function formatDeviceModel(ua) {
    if (!ua) return "Perangkat Tidak Dikenal";
    let brand = "Android";
    let browser = "Chrome";

    if (ua.includes("FBAN") || ua.includes("FBAV")) browser = "Facebook";
    else if (ua.includes("Instagram")) browser = "Instagram";
    else if (ua.includes("Edg/")) browser = "Edge";
    else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
    else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";

    if (ua.includes("Android")) {
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

        const modelMatch = ua.match(/Android\s\d+;\s([^;]+)\)/);
        let modelCode = modelMatch ? modelMatch[1].trim() : "";
        if (modelCode === "K" || !isNaN(modelCode)) modelCode = "";
        return `${brand}${modelCode ? ' (' + modelCode + ')' : ''} — ${browser}`;
    } 
    
    if (ua.includes("iPhone")) return `iPhone — ${browser}`;
    if (ua.includes("Windows NT 10.0")) return `Windows PC — ${browser}`;
    if (ua.includes("Mac OS X")) return `MacBook — ${browser}`;
    return `Lainnya — ${browser}`;
}

async function deleteAllAdmins() {
    const yakin = confirm("PERINGATAN: Anda akan menghapus SELURUH data admin. Anda akan otomatis logout setelah ini. Lanjutkan?");
    if (!yakin) return;

    const verifikasi = prompt("Ketik 'HAPUS SEMUA' untuk mengonfirmasi:");
    if (verifikasi !== "HAPUS SEMUA") {
        alert("Konfirmasi salah. Penghapusan dibatalkan.");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("admin")
            .delete()
            .neq("id", 0); 

        if (error) throw error;
        alert("All data admin deleted.");
        adminLogout(); 
    } catch (err) {
        alert("Gagal: " + err.message);
    }
}

async function deleteAllPelanggan() {
    const jumlahData = document.querySelectorAll("#tbody-data-pelanggan tr").length;
    if (jumlahData === 0) return alert("Tidak ada data pelanggan untuk dihapus.");

    const yakin = confirm(`Apakah Anda benar-benar ingin menghapus ${jumlahData} data pelanggan? Semua device dan riwayat mereka akan hilang permanen.`);
    if (!yakin) return;

    try {
        const { error } = await supabaseClient
            .from("pelanggan")
            .delete()
            .neq("status", "pending"); 

        if (error) throw error;
        alert("Seluruh data pelanggan berhasil dibersihkan.");
        loadDataPelanggan();
        loadDevicePelanggan();
    } catch (err) {
        alert("Gagal: " + err.message);
    }
}

function toggleSortMenuPelanggan() {
    document.getElementById('menuSortPelanggan').classList.toggle('show');
}

function pilihSortPelanggan(value, label) {
    document.getElementById('text-sort-pelanggan').innerText = label;
    document.getElementById('val-sort-pelanggan').value = value;
    document.getElementById('menuSortPelanggan').classList.remove('show');
    loadDataPelanggan();
}

function toggleSortMenuDevice() {
    document.getElementById('menuSortDevice').classList.toggle('show');
}

function pilihSortDevice(value, label) {
    document.getElementById('text-sort-device').innerText = label;
    document.getElementById('val-sort-device').value = value;
    document.getElementById('menuSortDevice').classList.remove('show');
    loadDevicePelanggan();
}

function toggleSortMenuAdmin() {
    document.getElementById('menuSortAdmin').classList.toggle('show');
}

function pilihSortAdmin(value, label) {
    document.getElementById('text-sort-admin').innerText = label;
    document.getElementById('val-sort-admin').value = value;
    document.getElementById('menuSortAdmin').classList.remove('show');
    loadAdminData();
}