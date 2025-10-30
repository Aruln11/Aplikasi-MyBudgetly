const SUPABASE_URL = 'https://kycmnkibuxtzrbzrhezo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y21ua2lidXh0enJienJoZXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI3NDAsImV4cCI6MjA3NzA1ODc0MH0.WtZhCS8qRUQNX5cSJAKdyA4G7Df7izGeWcjbWZTSbE4';

// Klien UTAMA untuk API (Login, dll.) - Definisikan ini dulu
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Klien KHUSUS HANYA untuk Realtime
const supabaseRealtimeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let realtimeChannel = null; // Channel untuk Realtime

// Variabel global
let transaksi = JSON.parse(localStorage.getItem('transaksi')) || [];
let editIndex = null;
let currentFilteredDate = null;
let currentConfirmCallback = null;
let itemRowCounter = 0;

// Variabel Paginasi
let currentPage = 1;
const transactionsPerPage = 10;

// Variabel untuk Fitur Scan
let cameraStream = null;
let cropper = null; // [BARU] Variabel untuk instance Cropper.js

// Inisialisasi Tema Lengkap
// GANTI SELURUH FUNGSI LAMA DENGAN INI
// Inisialisasi Tema Lengkap
// GANTI SELURUH FUNGSI LAMA DENGAN INI
function initTheme() {
  // Logika pengaturan tema (setAttribute, setProperty) TELAH DIPINDAH
  // ke inline script di <head> index.html untuk mencegah "flash".
  
  // Fungsi ini sekarang hanya bertugas menginisialisasi UI
  // yang bergantung pada DOM (seperti color picker) agar nilainya sesuai.

  const savedColorTheme = localStorage.getItem('colorTheme') || 'ocean';
  const customAccentColor = localStorage.getItem('customAccentColor');

  const colorPicker = document.getElementById('custom-color-input');

  if (colorPicker) {
    if (savedColorTheme === 'custom' && customAccentColor) {
      // Atur nilai color picker ke warna kustom yang tersimpan
      colorPicker.value = customAccentColor;
    } else {
      // Atur nilai color picker ke default
      colorPicker.value = '#4f46e5';
    }
  }
}

// Mengubah Tema
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// Fungsi untuk menerapkan tema warna preset
function applyColorTheme(themeName) {
  document.documentElement.style.removeProperty('--primary-gradient');
  document.documentElement.style.removeProperty('--primary-accent-color');
  document.documentElement.style.removeProperty('--primary-accent-color-glow');
  document.documentElement.setAttribute('data-color-theme', themeName);
  localStorage.setItem('colorTheme', themeName);
  localStorage.removeItem('customAccentColor');
  const capitalizedThemeName = themeName.charAt(0).toUpperCase() + themeName.slice(1);
  showNotification(`Tema ${capitalizedThemeName} diterapkan`, 'success');
  updateActiveThemeButton(themeName);
  updateActiveSwatch();

  const colorPicker = document.getElementById('custom-color-input');
  if (colorPicker) colorPicker.value = '#4f46e5';
}

function resetColorTheme() {
  applyColorTheme('ocean');
  showNotification('Tema dikembalikan ke default', 'info');
}

// Fungsi helper untuk mencerahkan warna & membuat gradien
function lightenHexColor(hex, percent) {
  hex = hex.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const newR = Math.min(255, r + (255 - r) * (percent / 100));
  const newG = Math.min(255, g + (255 - g) * (percent / 100));
  const newB = Math.min(255, b + (255 - b) * (percent / 100));

  return `#${Math.round(newR).toString(16).padStart(2, '0')}${Math.round(newG).toString(16).padStart(2, '0')}${Math.round(newB).toString(16).padStart(2, '0')}`;
}

function generateGradient(hexColor) {
  const lighterColor = lightenHexColor(hexColor, 30);
  return `linear-gradient(135deg, ${hexColor} 0%, ${lighterColor} 100%)`;
}

function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Fungsi untuk update tombol tema aktif
function updateActiveThemeButton(activeThemeName) {
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeName === activeThemeName);
  });
}

// Fungsi untuk mengelola palet warna kustom
function initializeCustomColorPalette() {
  const paletteContainer = document.getElementById('color-palette');
  if (!paletteContainer) return;

  const colors = [{
    name: 'Slate',
    value: '#475569'
  }, {
    name: 'Sky',
    value: '#0ea5e9'
  }, {
    name: 'Emerald',
    value: '#10b981'
  }, {
    name: 'Amber',
    value: '#f59e0b'
  }, {
    name: 'Rose',
    value: '#f43f5e'
  }, {
    name: 'Indigo',
    value: '#4f46e5'
  }];

  paletteContainer.innerHTML = ''; // Hapus isi sebelumnya

  colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color.value;
    swatch.title = color.name;
    swatch.dataset.color = color.value;

    swatch.addEventListener('click', () => {
      const customColor = swatch.dataset.color;
      const gradient = generateGradient(customColor);
      applyCustomColor(customColor);

      showNotification(`Warna kustom ${color.name} diterapkan`, 'success');
    });
    paletteContainer.appendChild(swatch);
  });
}

function updateActiveSwatch() {
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));

  const colorTheme = localStorage.getItem('colorTheme');
  const customColor = localStorage.getItem('customAccentColor');

  if (colorTheme === 'custom' && customColor) {
    const activeSwatch = document.querySelector(`.color-swatch[data-color="${customColor}"]`);
    if (activeSwatch) {
      activeSwatch.classList.add('active');
    }
    updateActiveThemeButton(null);
  }
}


// Mengelola Foto Profil
function handleProfilePhotoChange(event) {
  if (!checkLoginStatus()) {
        event.target.value = null; // Batalkan pemilihan file
        return;
  }
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const profilePhoto = document.getElementById('profile-photo');
      const profilePlaceholder = document.getElementById('profile-placeholder');

      profilePhoto.src = e.target.result;
      profilePhoto.classList.add('show');
      profilePlaceholder.classList.add('hide');

      localStorage.setItem('profilePhoto', e.target.result);

      showNotification('Foto profil berhasil diperbarui', 'success');
    };
    reader.readAsDataURL(file);
  }
}

// Memuat Foto Profil
function loadProfilePhoto() {
  const savedPhoto = localStorage.getItem('profilePhoto');
  if (savedPhoto) {
    const profilePhoto = document.getElementById('profile-photo');
    const profilePlaceholder = document.getElementById('profile-placeholder');

    profilePhoto.src = savedPhoto;
    profilePhoto.classList.add('show');
    profilePlaceholder.classList.add('hide');
  }
}

// Fungsionalitas Pengeditan Judul Modern
function editTitle() {
  if (!checkLoginStatus()) return;
  const titleElement = document.getElementById('app-title');
  const modal = document.getElementById('title-edit-modal');
  const input = document.getElementById('title-edit-input');

  input.value = titleElement.textContent;
  modal.classList.add('show');

  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
}

function closeTitleEditModal() {
  const modal = document.getElementById('title-edit-modal');
  modal.classList.remove('show');
}

function saveTitleFromModal() {
  const titleElement = document.getElementById('app-title');
  const input = document.getElementById('title-edit-input');

  const newTitle = input.value.trim();
  if (newTitle) {
    titleElement.textContent = newTitle;
    localStorage.setItem('appTitle', newTitle);
    showNotification(`Nama aplikasi berhasil diubah`, 'success');
  }

  closeTitleEditModal();
}

document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('title-edit-input');
  input.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveTitleFromModal();
    } else if (event.key === 'Escape') {
      closeTitleEditModal();
    }
  });

  const modal = document.getElementById('title-edit-modal');
  modal.addEventListener('click', function(event) {
    if (event.target === modal) {
      closeTitleEditModal();
    }
  });

  document.getElementById('confirmActionBtn').addEventListener('click', () => {
    if (currentConfirmCallback) {
      currentConfirmCallback();
      currentConfirmCallback = null;
    }
    closeConfirmationModal();
  });

  initializeCustomColorPalette();

});

function loadAppTitle() {
  const savedTitle = localStorage.getItem('appTitle');
  if (savedTitle) {
    document.getElementById('app-title').textContent = savedTitle;
  }
}

// Elemen DOM
const form = document.getElementById('form-transaksi');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const submitBtn = document.getElementById('submit-btn');
const submitText = document.getElementById('submit-text');
const formTitle = document.getElementById('form-title');
const emptyState = document.getElementById('empty-state');
const pdfSettingsModal = document.getElementById('pdfSettingsModal');
const deleteModal = document.getElementById('deleteModal');
const pdfOrientationSelect = document.getElementById('pdf-orientation');
const pdfFilenameInput = document.getElementById('pdf-filename');
const pdfModalBtn = document.getElementById('pdf-modal-btn');
const confirmationModal = document.getElementById('confirmationModal');
const confirmationModalMessage = document.getElementById('confirmationModalMessage');
const importModal = document.getElementById('importModal');
const importFileInput = document.getElementById('import-file');
const confirmImportBtn = document.getElementById('confirm-import-btn');
const dataActionsDropdown = document.getElementById('data-actions-dropdown');
const dataActionsToggleBtn = document.getElementById('data-actions-toggle-btn');
const calendarFilterIcon = document.getElementById('calendar-filter-icon');
const hiddenDateFilterInput = document.getElementById('hidden-date-filter');
const activeDateFilterDisplay = document.getElementById('active-date-filter-display');
const clearDateFilterBtn = document.getElementById('clear-date-filter-btn');
const deleteFilterSelect = document.getElementById('delete-filter');
const dateRangeDeleteGroup = document.getElementById('date-range-delete-group');
const deleteStartDateInput = document.getElementById('delete-start-date');
const deleteEndDateInput = document.getElementById('delete-end-date');

const themeSettingsModal = document.getElementById('themeSettingsModal');


function setTodayDate() {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  document.getElementById('tanggal').value = dateString;
}

function setupMidnightDateUpdate() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    setTodayDate();
    setInterval(() => {
      setTodayDate();
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

document.addEventListener('DOMContentLoaded', function() {
  initTheme();
  loadProfilePhoto();
  loadAppTitle();
  setTodayDate();
  setupMidnightDateUpdate();
  setupEventListeners();
  initializeCustomSelect();
  initializeMonthFilter(); 
  initializePdfOrientationSelect();
  document.getElementById('modal-login-form').addEventListener('submit', handleLogin);
  document.getElementById('close-login-modal-btn').addEventListener('click', closeLoginModal);
  if (localStorage.getItem('isLoggedIn') === 'true') {
      startRealtimeSessionListener();
  }
  updateAuthUI();
  updateUI();
});

function setupEventListeners() {
  cancelEditBtn.addEventListener('click', cancelEdit);
  // [BARU] Event Listener untuk Dropdown Menu Pengaturan
  const settingsMenu = document.getElementById('settings-menu');
  const settingsToggle = document.getElementById('settings-menu-toggle');
  const openThemeModalBtn = document.getElementById('open-theme-modal-btn');

  if (settingsMenu && settingsToggle && openThemeModalBtn) {
    
    // 1. Buka/Tutup menu saat ikon hamburger diklik
    settingsToggle.addEventListener('click', (e) => {
      e.stopPropagation(); // Mencegah window click listener di bawah tertutup
      settingsMenu.classList.toggle('open');
    });

    // 2. Buka modal tema dan tutup dropdown
    openThemeModalBtn.addEventListener('click', () => {
      openThemeModal(); // Panggil fungsi yang sudah ada
      settingsMenu.classList.remove('open'); // Tutup dropdown
    });

    // 3. Tutup dropdown saat klik di luar area menu
    window.addEventListener('click', (e) => {
      if (!settingsMenu.contains(e.target)) {
        settingsMenu.classList.remove('open');
      }
    });
  }
  // Akhir Event Listener Baru

  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.getElementById('jumlah').value = this.dataset.amount;
      this.style.background = 'var(--border)';
      setTimeout(() => {
        this.style.background = 'var(--background-secondary)';
      }, 200);
    });
  });

  dataActionsToggleBtn.addEventListener('click', () => {
    dataActionsDropdown.classList.toggle('open');
  });

  window.addEventListener('click', function(e) {
    if (!dataActionsDropdown.contains(e.target)) {
      dataActionsDropdown.classList.remove('open');
    }
  });

  document.getElementById('filter-bulan').addEventListener('change', () => {
    currentPage = 1;
    updateUI();
  });

  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  const debouncedUpdate = debounce(() => {
    currentPage = 1;
    updateUI(); // Panggil updateUI HANYA setelah user berhenti mengetik
  }, 300); // 300ms delay

  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    if (searchTerm) {
      searchClear.style.display = 'flex';
    } else {
      searchClear.style.display = 'none';
    }
    
    // [DIUBAH] Panggil fungsi yang sudah di-debounce, bukan updateUI() langsung
    debouncedUpdate();
  });

  document.getElementById('deskripsi').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('jumlah').focus();
    }
  });

  document.getElementById('jumlah').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('tanggal').focus();
    }
  });

  window.addEventListener('click', function(event) {
    if (event.target == themeSettingsModal) closeThemeModal();
    if (event.target == pdfSettingsModal) closePdfSettingsModal();
    if (event.target == deleteModal) closeDeleteModal();
    if (event.target == importModal) closeImportModal();
    if (event.target == confirmationModal) closeConfirmationModal();
    if (event.target == document.getElementById('login-modal')) closeLoginModal();
  });

  calendarFilterIcon.addEventListener('click', () => {
    hiddenDateFilterInput.showPicker();
  });

  hiddenDateFilterInput.addEventListener('change', function() {
    currentPage = 1;
    currentFilteredDate = this.value;
    updateUI();
    updateDateFilterDisplay();
  });

  clearDateFilterBtn.addEventListener('click', clearDateFilter);

  importFileInput.addEventListener('change', function() {
    confirmImportBtn.disabled = this.files.length === 0;
  });
  confirmImportBtn.disabled = true;

  deleteFilterSelect.addEventListener('change', function() {
    if (this.value === 'custom-range') {
      dateRangeDeleteGroup.style.display = 'block';
      if (!deleteStartDateInput.value) {
        deleteStartDateInput.value = '2000-01-01';
      }
      if (!deleteEndDateInput.value) {
        const today = new Date();
        deleteEndDateInput.value = today.toISOString().split('T')[0];
      }
    } else {
      dateRangeDeleteGroup.style.display = 'none';
    }
  });

  setupScanEventListeners();

  const colorPicker = document.getElementById('custom-color-input');
  if (colorPicker) {
    colorPicker.addEventListener('input', (event) => {
      const newColor = event.target.value;
      applyCustomColor(newColor);
    });
  }
}

// ===============================================
// [PEMBARUAN LENGKAP] FUNGSI-FUNGSI UNTUK FITUR SCAN STRUK
// ===============================================

function setupScanEventListeners() {
  const scanModal = document.getElementById('scan-modal');
  const scannerHelpBtn = document.getElementById('scanner-help-btn');
  const toggleEditBtn = document.getElementById('toggle-edit-btn');
  const toggleImageBtn = document.getElementById('toggle-image-btn');

  document.getElementById('scan-receipt-btn').addEventListener('click', openScanner);
  document.getElementById('capture-btn').addEventListener('click', captureImage);
  document.getElementById('rescan-btn').addEventListener('click', resetScanner);
  // Tombol 'process-btn' onclick diatur secara dinamis
  document.getElementById('cancel-scan-btn').addEventListener('click', closeScanner);
  document.getElementById('save-scanned-btn').addEventListener('click', saveScannedTransaction);
  document.getElementById('add-item-btn').addEventListener('click', () => addScannedItemRow());

  scannerHelpBtn.addEventListener('click', () => {
    const helpMessage = `
                <div style='text-align: left;'>
                    <b style='display: block; margin-bottom: 8px; font-size: 1.1em;'>💡 Tips untuk Hasil Pindai Terbaik</b>
                    <ul style='margin: 0; padding-left: 20px;'>
                        <li style='margin-bottom: 5px;'><b>Cahaya Terang:</b> Pastikan struk berada di area dengan pencahayaan yang baik dan merata.</li>
                        <li style='margin-bottom: 5px;'><b>Permukaan Datar:</b> Letakkan struk di atas permukaan yang rata dan tidak terlipat.</li>
                        <li style='margin-bottom: 5px;'><b>Hindari Bayangan:</b> Posisikan kamera agar tidak ada bayangan dari tangan atau ponsel Anda yang menutupi struk.</li>
                        <li style='margin-bottom: 5px;'><b>Fokus & Jelas:</b> Pastikan kamera fokus dan seluruh teks pada struk terlihat tajam dan tidak buram sebelum mengambil gambar.</li>
                        <li style='margin-bottom: 0;'><b>Isi Bingkai:</b> Posisikan struk agar memenuhi area di dalam bingkai pemindai.</li>
                    </ul>
                </div>
            `;
    showNotification(helpMessage, 'info', null);
  });


  toggleEditBtn.addEventListener('click', () => setCorrectionView('edit'));
  toggleImageBtn.addEventListener('click', () => setCorrectionView('image'));

  scanModal.addEventListener('click', (e) => {
    if (e.target === scanModal) {
      closeScanner();
    }
  });
}

async function openScanner() {
  if (!checkLoginStatus()) return;
  const scanModal = document.getElementById('scan-modal');
  scanModal.style.display = 'flex';
  resetScannerState();

  try {
    const constraints = {
      video: {
        facingMode: 'environment'
      }
    };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    const cameraView = document.getElementById('camera-view');
    cameraView.srcObject = cameraStream;
  } catch (err) {
    console.error("Error accessing camera: ", err);
    let message = 'Gagal mengakses kamera.';
    if (err.name === 'NotAllowedError') {
      message = 'Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda untuk menggunakan fitur ini.';
    }
    showNotification(message, 'error', 6000);
    closeScanner();
  }
}

function closeScanner() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (cropper) {
      cropper.destroy();
      cropper = null;
  }
  document.getElementById('scan-modal').style.display = 'none';
}

function resetScannerState() {
  document.getElementById('scanner-title').textContent = "Pindai Struk Belanja";
  
  // Tampilkan view kamera, sembunyikan yang lain
  document.getElementById('scanner-view-container').style.display = 'block';
  document.getElementById('cropper-container').style.display = 'none';
  document.getElementById('scanner-results-container').style.display = 'none';

  // Reset tombol-tombol
  document.getElementById('capture-btn').style.display = 'inline-flex';
  document.getElementById('preview-controls').style.display = 'none';
  document.getElementById('correction-controls').style.display = 'none';

  // Sembunyikan status OCR dan bersihkan list item
  document.getElementById('ocr-status').style.display = 'none';
  document.getElementById('item-list-container').innerHTML = '';
}

function captureImage() {
    const cameraView = document.getElementById('camera-view');
    const canvas = document.getElementById('image-preview-canvas');
    const imageToCrop = document.getElementById('image-to-crop');

    canvas.width = cameraView.videoWidth;
    canvas.height = cameraView.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);

    imageToCrop.src = canvas.toDataURL('image/jpeg');

    // Sembunyikan tampilan kamera dan tampilkan kontainer cropper
    document.getElementById('scanner-view-container').style.display = 'none';
    document.getElementById('cropper-container').style.display = 'block';

    // Inisialisasi Cropper.js
    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(imageToCrop, {
        viewMode: 1,
        background: false,
        responsive: true,
        autoCropArea: 0.9,
    });

    // Ganti tombol
    document.getElementById('capture-btn').style.display = 'none';
    const processBtn = document.getElementById('process-btn');
    processBtn.querySelector('#process-btn-text').innerHTML = '✂️ Crop & Proses';
    processBtn.onclick = processCroppedImage; // Ganti fungsi on-click
    document.getElementById('preview-controls').style.display = 'flex';
}


function resetScanner() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    resetScannerState(); // Kembali ke tampilan kamera awal
}

async function processCroppedImage() {
    if (!cropper) {
        showNotification('Cropper tidak siap.', 'error');
        return;
    }

    const ocrStatus = document.getElementById('ocr-status');
    const ocrText = document.getElementById('ocr-status-text');
    const ocrProgress = document.getElementById('ocr-progress');
    const processBtn = document.getElementById('process-btn');

    // Dapatkan kanvas hasil crop dari Cropper.js
    const croppedCanvas = cropper.getCroppedCanvas({
        fillColor: '#fff'
    });

    if (!croppedCanvas) {
        showNotification('Gagal mendapatkan gambar hasil crop.', 'error');
        return;
    }

    // Sembunyikan cropper dan tampilkan status loading
    document.getElementById('cropper-container').style.display = 'none';
    document.getElementById('preview-controls').style.display = 'none';
    ocrStatus.style.display = 'block';
    ocrText.textContent = 'Mempersiapkan pemindaian...';
    ocrProgress.value = 0;
    
    processBtn.disabled = true;
    processBtn.querySelector('#process-btn-text').innerHTML = '<span class="loading"></span> Memproses...';

    try {
        const worker = await Tesseract.createWorker('ind', 1, {
            logger: m => {
                ocrProgress.value = (m.progress || 0) * 100;
                if (m.status === 'recognizing text') {
                    ocrText.textContent = `Menganalisis teks... (${Math.round(m.progress * 100)}%)`;
                }
            }
        });

        const { data: { text } } = await worker.recognize(croppedCanvas);
        await worker.terminate();

        parseOCRText(text);

        document.getElementById('scanner-title').textContent = "Koreksi Hasil Pindaian";
        document.getElementById('scanner-results-container').style.display = 'flex';
        document.getElementById('correction-controls').style.display = 'flex';
        document.getElementById('receipt-image-display').src = croppedCanvas.toDataURL();
        setCorrectionView('edit');

    } catch (error) {
        console.error("OCR Error:", error);
        showNotification('Terjadi kesalahan saat pemindaian OCR.', 'error');
        resetScanner();
    } finally {
        ocrStatus.style.display = 'none';
        processBtn.disabled = false;
        processBtn.querySelector('#process-btn-text').innerHTML = '✂️ Crop & Proses';
    }
}


function parseOCRText(text) {
  let cleanedText = text
    .replace(/(\d)[.,](\d{3})/g, '$1$2')
    .replace(/,00/g, '')
    .replace(/Rp\s?/gi, '')
    .replace(/[^\w\s.,-]/g, '');

  const lines = cleanedText.split('\n');
  const items = [];
  const itemRegex = /^(.+?)\s+(?:x\s?)?\d{1,2}\s+(\d{4,})$/;
  const simpleItemRegex = /^(.*?)\s+(\d{4,})$/;
  const junkRegex = /(Total|Subtotal|Tunai|Kembali|PPN|Diskon|Kasir|Indomaret|Alfamart|Alfamidi|Member|Poin|Tgl|Wkt|Struk|Telp)/i;

  lines.forEach(line => {
    line = line.trim();
    if (line.length < 5 || junkRegex.test(line)) {
      return;
    }

    let match = line.match(itemRegex) || line.match(simpleItemRegex);

    if (match) {
      let name = match[1].replace(/\d+$/, '').trim();
      let price = parseInt(match[match.length - 1], 10);

      if (name.length > 2 && /[a-zA-Z]{2,}/.test(name) && !isNaN(price) && price > 0) {
        items.push({
          name,
          price
        });
      }
    }
  });

  displayScannedItems(items);
}

function displayScannedItems(items) {
  const container = document.getElementById('item-list-container');
  container.innerHTML = '';
  if (items.length === 0) {
    showNotification('Tidak ada item yang terdeteksi. Silakan tambah manual.', 'warning');
    addScannedItemRow();
  } else {
    showNotification(`Terdeteksi ${items.length} item. Mohon periksa kembali.`, 'success');
    items.forEach(item => addScannedItemRow(item.name, item.price));
  }
  updateScannedTotal();
}

function addScannedItemRow(name = '', price = '') {
  const container = document.getElementById('item-list-container');
  const div = document.createElement('div');
  div.className = 'item-row';

  // ID unik untuk menghubungkan label dengan input
  const uniqueId = ++itemRowCounter;

  div.innerHTML = `
        <div class="item-details-wrapper">
            <div class="item-input-group item-name-group">
                <label for="item-name-${uniqueId}">Nama Barang</label>
                <input type="text" id="item-name-${uniqueId}" class="input-field item-name-input" value="${name}" placeholder="Contoh: Indomie Goreng">
            </div>
            <div class="item-input-group item-price-group">
                <label for="item-price-${uniqueId}">Harga</label>
                <input type="number" id="item-price-${uniqueId}" class="input-field item-price-input" value="${price}" placeholder="15000" inputmode="numeric">
            </div>
        </div>
        <button class="delete-item-btn" onclick="this.parentElement.remove(); updateScannedTotal();" title="Hapus item ini">✕</button>
      `;

  container.appendChild(div);

  // Tambahkan event listener untuk update total
  const priceInput = div.querySelector('.item-price-input');
  priceInput.addEventListener('input', updateScannedTotal);

  // Perbaikan untuk scroll otomatis di mobile
  const nameInput = div.querySelector('.item-name-input');
  const scrollIntoViewOnFocus = (event) => {
    setTimeout(() => {
      event.target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }, 300);
  };
  nameInput.addEventListener('focus', scrollIntoViewOnFocus);
  priceInput.addEventListener('focus', scrollIntoViewOnFocus);
}

function updateScannedTotal() {
  const prices = document.querySelectorAll('.item-price-input');
  let total = 0;
  prices.forEach(input => {
    total += parseInt(input.value) || 0;
  });
  document.getElementById('total-scanned-amount').textContent = formatCurrency(total);
}

function setCorrectionView(view) {
  const itemListWrapper = document.getElementById('item-list-wrapper');
  const imageWrapper = document.getElementById('receipt-image-wrapper');
  const toggleEditBtn = document.getElementById('toggle-edit-btn');
  const toggleImageBtn = document.getElementById('toggle-image-btn');

  if (view === 'edit') {
    itemListWrapper.style.display = 'block';
    imageWrapper.style.display = 'none';
    toggleEditBtn.classList.add('active');
    toggleImageBtn.classList.remove('active');
  } else { // view === 'image'
    itemListWrapper.style.display = 'none';
    imageWrapper.style.display = 'block';
    toggleEditBtn.classList.remove('active');
    toggleImageBtn.classList.add('active');
  }
}

function saveScannedTransaction() {
  const itemRows = document.querySelectorAll('.item-row');
  if (itemRows.length === 0) {
    showNotification('Tidak ada item untuk disimpan.', 'error');
    return;
  }

  let transactionsAdded = 0;
  const today = new Date().toISOString().split('T')[0];

  itemRows.forEach(row => {
    const name = row.querySelector('.item-name-input').value.trim();
    const price = parseInt(row.querySelector('.item-price-input').value) || 0;

    if (name && price > 0) {
      const newTransaction = {
        deskripsi: name,
        jumlah: price,
        tanggal: today,
        jenis: 'pengeluaran'
      };
      transaksi.push(newTransaction);
      transactionsAdded++;
    }
  });

  if (transactionsAdded > 0) {
    localStorage.setItem('transaksi', JSON.stringify(transaksi));
    updateUI();
    closeScanner();
    showNotification(`${transactionsAdded} transaksi dari struk berhasil disimpan!`, 'success');
  } else {
    showNotification('Tidak ada item valid untuk disimpan.', 'error');
  }
}


// ===============================================
// AKHIR FUNGSI FITUR SCAN STRUK
// ===============================================

function clearSearch() {
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');

  searchInput.value = '';
  searchClear.style.display = 'none';
  currentPage = 1;
  updateUI();
  searchInput.focus();
}

function clearDateFilter() {
  currentFilteredDate = null;
  hiddenDateFilterInput.value = '';
  updateDateFilterDisplay();
  currentPage = 1;
  updateUI();
  showNotification('Filter tanggal dihapus', 'info');
}

function updateDateFilterDisplay() {
  if (currentFilteredDate) {
    activeDateFilterDisplay.textContent = `(${formatDate(currentFilteredDate)})`;
    activeDateFilterDisplay.style.display = 'inline';
    clearDateFilterBtn.style.display = 'inline';
  } else {
    activeDateFilterDisplay.textContent = '';
    activeDateFilterDisplay.style.display = 'none';
    clearDateFilterBtn.style.display = 'none';
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!checkLoginStatus()) {
        return; // Hentikan jika belum login
    }

  const deskripsi = document.getElementById('deskripsi').value.trim();
  const jumlah = parseFloat(document.getElementById('jumlah').value);
  const tanggal = document.getElementById('tanggal').value;
  const jenis = document.getElementById('jenis').value;

  if (!deskripsi || !jumlah || !tanggal) {
    showNotification('Data tidak lengkap', 'error');
    return;
  }

  if (jumlah <= 0) {
    showNotification('Jumlah tidak valid', 'error');
    return;
  }

  submitText.innerHTML = '<span class="loading"></span> Menyimpan...';
  submitBtn.disabled = true;

  setTimeout(() => {
    if (editIndex !== null) {
      transaksi[editIndex] = {
        deskripsi,
        jumlah,
        tanggal,
        jenis
      };
      showNotification('Transaksi berhasil diupdate', 'success');
      cancelEdit();
    } else {
      transaksi.push({
        deskripsi,
        jumlah,
        tanggal,
        jenis
      });
      showNotification('Transaksi berhasil ditambahkan', 'success');
    }

    localStorage.setItem('transaksi', JSON.stringify(transaksi));

    form.reset();
    setTodayDate();

    updateUI();

    submitText.textContent = 'Simpan Transaksi';
    submitBtn.disabled = false;

    document.getElementById('deskripsi').focus();
  }, 500);
}

function cancelEdit() {
  editIndex = null;
  form.reset();
  setTodayDate();

  formTitle.textContent = '📝 Tambah Transaksi Baru';
  submitText.textContent = 'Simpan Transaksi';
  cancelEditBtn.style.display = 'none';

  document.getElementById('deskripsi').focus();
  showNotification('Edit dibatalkan', 'info');
}

// [GANTI FUNGSI LAMA ANDA DENGAN YANG INI]
function updateUI() {
  if (localStorage.getItem('isLoggedIn') !== 'true') {
        // Jika pengguna adalah tamu, tampilkan UI tamu dan stop
        loadGuestUI();
        return; 
    }

  // ▼▼▼ PERUBAHAN UTAMA ADA DI SINI ▼▼▼
  // Reset empty state ke default "Tidak Ada Transaksi"
  // Ini penting agar pesan "Selamat Datang" (demo) hilang setelah login.
  const emptyState = document.getElementById('empty-state');
  emptyState.innerHTML = `
    <div class="empty-state-icon">📊</div>
    <h3>Belum ada transaksi</h3>
    <p>Mulai tambahkan transaksi pertama Anda!</p>
  `;
  // ▲▲▲ AKHIR PERUBAHAN ▲▲▲

  updateSummaryCards();
  updateTransactionsTable();
  updateMonthFilter();
  updateDateFilterDisplay();

  const tbody = document.getElementById('tbody-tabel');
  const filteredTransactions = getFilteredTransactions();

  if (filteredTransactions.length === 0 && document.getElementById('search-input').value.trim() === '' && !currentFilteredDate) {
    emptyState.style.display = 'block';
    document.querySelector('.table-container table').style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    document.querySelector('.table-container table').style.display = 'table';
  }
}

function updateSummaryCards() {
  let pemasukan = 0,
    pengeluaran = 0;
  const filtered = getFilteredTransactions();

  filtered.forEach(t => {
    if (t.jenis === 'pemasukan') pemasukan += t.jumlah;
    if (t.jenis === 'pengeluaran') pengeluaran += t.jumlah;
  });

  const saldo = pemasukan - pengeluaran;

  const pemasukanEl = document.getElementById('pemasukan');
  const pengeluaranEl = document.getElementById('pengeluaran');
  const saldoEl = document.getElementById('saldo');

  pemasukanEl.classList.add('value-updated');
  pengeluaranEl.classList.add('value-updated');
  saldoEl.classList.add('value-updated');

  setTimeout(() => {
    pemasukanEl.classList.remove('value-updated');
    pengeluaranEl.classList.remove('value-updated');
    saldoEl.classList.remove('value-updated');
  }, 400);

  pemasukanEl.textContent = formatCurrency(pemasukan);
  pengeluaranEl.textContent = formatCurrency(pengeluaran);
  saldoEl.textContent = formatCurrency(saldo);
}

function getFilteredTransactions() {
  const filter = document.getElementById('filter-bulan').value;
  const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

  return transaksi.filter(t => {
    const matchesBulan = filter === 'semua' || t.tanggal.startsWith(filter);

    const transactionDate = new Date(t.tanggal);
    const transactionYear = transactionDate.getFullYear().toString();
    const transactionMonth = transactionDate.toLocaleString('id-ID', {
      month: 'long'
    }).toLowerCase();

    const isNumericSearch = !isNaN(searchTerm) && searchTerm !== '';

    const matchesSearch = !searchTerm ||
      t.deskripsi.toLowerCase().includes(searchTerm) ||
      t.jenis.toLowerCase().includes(searchTerm) ||
      (isNumericSearch && (transactionYear.includes(searchTerm) || t.jumlah.toString().includes(searchTerm))) ||
      transactionMonth.includes(searchTerm);

    const matchesDate = !currentFilteredDate || t.tanggal === currentFilteredDate;

    return matchesBulan && matchesSearch && matchesDate;
  });
}

function updateTransactionsTable() {
  const tbody = document.getElementById('tbody-tabel');
  tbody.innerHTML = '';

  const filteredTransactions = getFilteredTransactions();

  const sortedRelevantTransactions = [...filteredTransactions]
    .map((t, index) => ({
      ...t,
      originalIndex: transaksi.indexOf(t)
    }))
    .sort((a, b) => {
      const dateCompare = new Date(a.tanggal) - new Date(b.tanggal);
      if (dateCompare === 0) {
        return a.originalIndex - b.originalIndex;
      }
      return dateCompare;
    });

  let currentRunningBalance = 0;
  const transactionsWithRunningBalance = sortedRelevantTransactions.map(t => {
    currentRunningBalance += t.jenis === 'pemasukan' ? t.jumlah : -t.jumlah;
    return { ...t,
      runningBalance: currentRunningBalance
    };
  });

  const sortedForDisplay = [...transactionsWithRunningBalance].reverse();

  const startIndex = (currentPage - 1) * transactionsPerPage;
  const endIndex = startIndex + transactionsPerPage;
  const paginatedTransactions = sortedForDisplay.slice(startIndex, endIndex);

  paginatedTransactions.forEach(t => {
    let highlightedDeskripsi = t.deskripsi;
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    if (searchTerm) {
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      highlightedDeskripsi = t.deskripsi.replace(regex, '<mark style="background: rgba(79, 70, 229, 0.2); padding: 0.1rem 0.2rem; border-radius: 3px;">$1</mark>');
    }

    const row = document.createElement('tr');
    row.className = 'fade-in-up';
    row.innerHTML = `
                <td class="text-left">${formatDate(t.tanggal)}</td>
                <td class="text-left" style="font-weight: 500;">${highlightedDeskripsi}</td>
                <td class="amount-positive text-right">${t.jenis === 'pemasukan' ? formatCurrency(t.jumlah) : '-'}</td>
                <td class="amount-negative text-right">${t.jenis === 'pengeluaran' ? formatCurrency(t.jumlah) : '-'}</td>
                <td class="balance-amount text-right">${formatCurrency(t.runningBalance)}</td>
                <td class="text-center">
                    <div class="transaction-actions">
                        <button class="action-btn edit-btn" onclick="editTransaksi(${t.originalIndex})" data-tooltip="Edit transaksi" tabindex="0">
                            <div class="action-icon edit-icon"></div>
                        </button>
                        <button class="action-btn delete-btn" onclick="hapusTransaksi(${t.originalIndex})" data-tooltip="Hapus transaksi" tabindex="0">
                            <div class="action-icon delete-icon"></div>
                        </button>
                    </div>
                </td>
            `;
    tbody.appendChild(row);
  });

  updatePaginationControls(filteredTransactions.length);

  if (paginatedTransactions.length === 0 && (document.getElementById('search-input').value.trim() || currentFilteredDate || document.getElementById('filter-bulan').value !== 'semua')) {
    const noResultsRow = document.createElement('tr');
    noResultsRow.innerHTML = `<td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Tidak ada hasil untuk filter yang diterapkan. <a href="#" onclick="event.preventDefault(); clearAllFilters();">Hapus filter</a></td>`;
    tbody.appendChild(noResultsRow);
  }
}

// GANTI FUNGSI updatePaginationControls LAMA DENGAN YANG INI
function updatePaginationControls(totalTransactions) {
  const paginationControls = document.getElementById('pagination-controls');
  paginationControls.innerHTML = '';

  const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

  if (totalPages <= 1) {
    return;
  }

  // Tombol "Sebelumnya"
  const prevButton = document.createElement('button');
  prevButton.innerHTML = '&lt;';
  prevButton.className = 'pagination-btn';
  prevButton.disabled = currentPage === 1;
  prevButton.title = "Halaman Sebelumnya";
  prevButton.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      updateUI();
    }
  };
  paginationControls.appendChild(prevButton);

  // Elemen info halaman (sekarang bisa diklik)
  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info clickable'; // Tambahkan kelas 'clickable'
  pageInfo.textContent = `${currentPage}/${totalPages}`;
  pageInfo.title = "Klik untuk lompat ke halaman"; // Tambahkan tooltip
  
  // [BARU] Tambahkan event listener untuk memunculkan input
  pageInfo.onclick = () => showPageInput(totalPages); 
  
  paginationControls.appendChild(pageInfo);

  // Tombol "Berikutnya"
  const nextButton = document.createElement('button');
  nextButton.innerHTML = '&gt;';
  nextButton.className = 'pagination-btn';
  nextButton.disabled = currentPage === totalPages;
  nextButton.title = "Halaman Berikutnya";
  nextButton.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      updateUI();
    }
  };
  paginationControls.appendChild(nextButton);
}

// [BARU] Tambahkan FUNGSI BARU ini di bawah fungsi updatePaginationControls
function showPageInput(totalPages) {
  const pageInfo = document.querySelector('.page-info');
  if (!pageInfo) return; // Keluar jika elemen tidak ditemukan

  // Simpan tombol prev/next untuk dikembalikan nanti
  const prevButton = document.querySelector('.pagination-btn:first-child');
  const nextButton = document.querySelector('.pagination-btn:last-child');
  
  const paginationControls = document.getElementById('pagination-controls');
  paginationControls.innerHTML = ''; // Kosongkan sementara

  // Buat input field
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'pagination-input'; // Kelas baru untuk styling
  input.value = currentPage;
  input.min = 1;
  input.max = totalPages;

  const handleJump = () => {
    let newPage = parseInt(input.value);
    // Validasi input
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      updateUI(); // Perbarui tampilan ke halaman baru
    } else {
      // Jika input tidak valid, cukup render ulang UI tanpa mengubah halaman
      showNotification(`Masukkan halaman antara 1 dan ${totalPages}`, 'error', 2000);
      updateUI();
    }
  };

  // Event listener untuk tombol 'Enter'
  input.onkeydown = (event) => {
    if (event.key === 'Enter') {
      handleJump();
    } else if (event.key === 'Escape') {
      updateUI(); // Batalkan dengan 'Escape'
    }
  };

  // Event listener jika pengguna klik di luar input (blur)
  input.onblur = () => {
    // Beri sedikit jeda agar tidak konflik dengan event lain
    setTimeout(() => updateUI(), 100);
  };
  
  // Masukkan kembali tombol dan input baru
  if (prevButton) paginationControls.appendChild(prevButton);
  paginationControls.appendChild(input);
  if (nextButton) paginationControls.appendChild(nextButton);

  input.focus();
  input.select();
}


function clearAllFilters() {
  document.getElementById('filter-bulan').value = 'semua';
  clearSearch();
  clearDateFilter();
  showNotification('Semua filter dihapus', 'info');
}

function updateMonthFilter() {
  const bulanSet = new Set();
  transaksi.forEach(t => bulanSet.add(t.tanggal.slice(0, 7)));

  const hiddenSelect = document.getElementById('filter-bulan');
  const currentFilter = hiddenSelect.value;

  // Referensi ke dropdown kustom
  const customContainer = document.getElementById('custom-filter-bulan');
  const selectedDisplay = customContainer.querySelector('.select-selected');
  const optionsContainer = customContainer.querySelector('.select-items');

  // Kosongkan pilihan yang lama
  hiddenSelect.innerHTML = '';
  optionsContainer.innerHTML = '';

  // Fungsi helper untuk membuat pilihan
  const createOption = (text, value) => {
    // Buat untuk <select> tersembunyi
    const option = document.createElement('option');
    option.value = value;
    option.innerHTML = text;
    hiddenSelect.appendChild(option);

    // Buat untuk <div> kustom
    const div = document.createElement('div');
    div.innerHTML = text;
    div.setAttribute('data-value', value);
    optionsContainer.appendChild(div);

    // Tambahkan event listener untuk pilihan kustom
    div.addEventListener('click', function() {
      hiddenSelect.value = this.getAttribute('data-value');
      selectedDisplay.innerHTML = this.innerHTML;
      // Picu event 'change' pada select tersembunyi agar filter berjalan
      hiddenSelect.dispatchEvent(new Event('change'));
    });
  };

  // Buat pilihan "Semua Bulan"
  createOption('Semua Bulan', 'semua');

  // Buat pilihan untuk setiap bulan yang ada
  ([...bulanSet].sort()).reverse().forEach(bulan => {
    createOption(`Data ${formatMonth(bulan)}`, bulan);
  });

  // Atur nilai yang terpilih saat ini
  hiddenSelect.value = currentFilter;
  // Perbarui tampilan dropdown kustom agar sesuai
  const selectedOptionDiv = optionsContainer.querySelector(`[data-value="${hiddenSelect.value}"]`);
  if (selectedOptionDiv) {
    selectedDisplay.innerHTML = selectedOptionDiv.innerHTML;
  }
}

function editTransaksi(index) {
  if (!checkLoginStatus()) return;
  const t = transaksi[index];

  document.getElementById('deskripsi').value = t.deskripsi;
  document.getElementById('jumlah').value = t.jumlah;
  document.getElementById('tanggal').value = t.tanggal;
  document.getElementById('jenis').value = t.jenis;

  editIndex = index;
  formTitle.textContent = '✏️ Edit Transaksi';
  submitText.textContent = 'Update Transaksi';
  cancelEditBtn.style.display = 'inline-flex';

  document.querySelector('.form-container').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
  document.getElementById('deskripsi').focus();

  showNotification('Mode edit aktif', 'info');
}

function hapusTransaksi(index) {
  if (!checkLoginStatus()) return;
  const t = transaksi[index];
  openConfirmationModal(`Yakin ingin menghapus transaksi "${t.deskripsi}"?`, () => {
    transaksi.splice(index, 1);
    localStorage.setItem('transaksi', JSON.stringify(transaksi));

    if (editIndex === index) {
      cancelEdit();
    }

    updateUI();
    showNotification('Transaksi berhasil dihapus', 'success');
  });
}

function openThemeModal() {
  themeSettingsModal.style.display = 'flex';
  const currentTheme = localStorage.getItem('colorTheme') || 'ocean';
  updateActiveThemeButton(currentTheme);
  updateActiveSwatch();
}

function closeThemeModal() {
  themeSettingsModal.style.display = 'none';
}

function openDeleteModal() {
  if (!checkLoginStatus()) return;
  if (transaksi.length === 0) {
    showNotification('Tidak ada data untuk dihapus!', 'info');
    return;
  }
  deleteModal.style.display = 'flex';
  if (deleteFilterSelect.value === 'custom-range') {
    dateRangeDeleteGroup.style.display = 'block';
  } else {
    dateRangeDeleteGroup.style.display = 'none';
  }
}

function closeDeleteModal() {
  deleteModal.style.display = 'none';
}

function confirmBulkDelete() {
  const deleteFilter = document.getElementById('delete-filter').value;
  let toDelete = [];
  let filterName = '';

  if (deleteFilter === 'semua') {
    toDelete = [...transaksi];
    filterName = 'semua data';
  } else if (deleteFilter === 'pemasukan') {
    toDelete = transaksi.filter(t => t.jenis === 'pemasukan');
    filterName = 'data pemasukan';
  } else if (deleteFilter === 'pengeluaran') {
    toDelete = transaksi.filter(t => t.jenis === 'pengeluaran');
    filterName = 'data pengeluaran';
  } else if (deleteFilter === 'custom-range') {
    const startDate = deleteStartDateInput.value;
    const endDate = deleteEndDateInput.value;

    if (!startDate || !endDate) {
      showNotification('Pilih tanggal mulai dan tanggal akhir untuk rentang kustom.', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      showNotification('Tanggal mulai tidak boleh setelah tanggal akhir.', 'error');
      return;
    }

    toDelete = transaksi.filter(t => {
      const transactionDate = new Date(t.tanggal);
      return transactionDate >= new Date(startDate) && transactionDate <= new Date(endDate);
    });
    filterName = `data dari ${formatDate(startDate)} sampai ${formatDate(endDate)}`;
  } else {
    toDelete = transaksi.filter(t => t.tanggal.startsWith(deleteFilter));
    filterName = `data ${formatMonth(deleteFilter)}`;
  }

  if (toDelete.length === 0) {
    showNotification('Tidak ada data untuk dihapus', 'info');
    return;
  }

  const deleteAllBtn = document.querySelector('#deleteModal .btn-delete-all');

  openConfirmationModal(`Yakin ingin menghapus ${toDelete.length} transaksi (${filterName})?`, () => {
    deleteAllBtn.style.opacity = '0.6';
    deleteAllBtn.style.pointerEvents = 'none';
    deleteAllBtn.querySelector('span:last-child').textContent = 'Menghapus...';

    setTimeout(() => {
      if (deleteFilter === 'semua') {
        transaksi = [];
      } else if (deleteFilter === 'pemasukan') {
        transaksi = transaksi.filter(t => t.jenis !== 'pemasukan');
      } else if (deleteFilter === 'pengeluaran') {
        transaksi = transaksi.filter(t => t.jenis !== 'pengeluaran');
      } else if (deleteFilter === 'custom-range') {
        const startDate = deleteStartDateInput.value;
        const endDate = deleteEndDateInput.value;
        transaksi = transaksi.filter(t => {
          const transactionDate = new Date(t.tanggal);
          return !(transactionDate >= new Date(startDate) && transactionDate <= new Date(endDate));
        });
      } else {
        transaksi = transaksi.filter(t => !t.tanggal.startsWith(deleteFilter));
      }

      localStorage.setItem('transaksi', JSON.stringify(transaksi));

      closeDeleteModal();
      editIndex = null;
      form.reset();
      setTodayDate();

      formTitle.textContent = '📝 Tambah Transaksi Baru';
      submitText.textContent = 'Simpan Transaksi';
      cancelEditBtn.style.display = 'none';

      updateUI();
      showNotification(`${toDelete.length} transaksi berhasil dihapus!`, 'success');

      deleteAllBtn.style.opacity = '1';
      deleteAllBtn.style.pointerEvents = 'auto';
      deleteAllBtn.querySelector('span:last-child').textContent = 'Hapus Data';
    }, 800);
  });
}

function openPdfSettingsModal() {
  pdfSettingsModal.style.display = 'flex';
  const currentFilter = document.getElementById('filter-bulan').value;
  const searchTerm = document.getElementById('search-input').value.trim();

  let filenameBase = 'Laporan Keuangan';
  if (currentFilter !== 'semua') {
    filenameBase += ` ${formatMonth(currentFilter)}`;
  }
  if (currentFilteredDate) {
    filenameBase += ` Tanggal ${formatDate(currentFilteredDate)}`;
  }
  if (searchTerm) {
    filenameBase += ` Pencarian ${searchTerm}`;
  }
  pdfFilenameInput.value = filenameBase;
}

function closePdfSettingsModal() {
  pdfSettingsModal.style.display = 'none';
  pdfModalBtn.classList.remove('loading');
  pdfModalBtn.querySelector('span:last-child').textContent = 'Export PDF';
}

function simpanPDF() {
  if (transaksi.length === 0) {
    showNotification('Tidak ada data', 'info');
    closePdfSettingsModal();
    return;
  }

  pdfModalBtn.classList.add('loading');
  pdfModalBtn.querySelector('span:last-child').textContent = 'Generating...';

  showNotification('Membangun PDF...', 'info');

  const relevantTransactionsForPdf = getFilteredTransactions();

  if (relevantTransactionsForPdf.length === 0) {
    showNotification('Tidak ada data untuk periode ini', 'info');
    closePdfSettingsModal();
    return;
  }

  const sortedRelevantTransactionsForPdf = [...relevantTransactionsForPdf]
    .map((t, index) => ({
      ...t,
      originalIndex: transaksi.indexOf(t)
    }))
    .sort((a, b) => {
      const dateCompare = new Date(a.tanggal) - new Date(b.tanggal);
      if (dateCompare === 0) {
        return a.originalIndex - b.originalIndex;
      }
      return dateCompare;
    });

  let currentRunningBalanceForPdf = 0;
  const transactionsWithRunningBalanceForPdf = sortedRelevantTransactionsForPdf.map(t => {
    currentRunningBalanceForPdf += t.jenis === 'pemasukan' ? t.jumlah : -t.jumlah;
    return { ...t,
      runningBalance: currentRunningBalanceForPdf
    };
  });

  let totalPemasukan = 0,
    totalPengeluaran = 0;
  transactionsWithRunningBalanceForPdf.forEach(t => {
    if (t.jenis === 'pemasukan') totalPemasukan += t.jumlah;
    if (t.jenis === 'pengeluaran') totalPengeluaran += t.jumlah;
  });
  const totalSaldo = totalPemasukan - totalPengeluaran;

  const tempTable = document.createElement('table');
  tempTable.style.width = '100%';
  tempTable.style.borderCollapse = 'collapse';
  tempTable.style.fontFamily = 'Inter, sans-serif';
  tempTable.style.fontSize = '12px';
  tempTable.style.color = '#333';

  tempTable.innerHTML = `
            <thead>
                <tr style="background-color: #f0f8ff;">
                    <th style="padding: 0.8rem; text-align: left; font-weight: 600; font-size: 0.9rem; border-bottom: 2px solid #a0dfff; color: #333;">Tanggal</th>
                    <th style="padding: 0.8rem; text-align: left; font-weight: 600; font-size: 0.9rem; border-bottom: 2px solid #a0dfff; color: #333;">Deskripsi</th>
                    <th style="padding: 0.8rem; text-align: right; font-weight: 600; font-size: 0.9rem; border-bottom: 2px solid #a0dfff; color: #333;">Pemasukan</th>
                    <th style="padding: 0.8rem; text-align: right; font-weight: 600; font-size: 0.9rem; border-bottom: 2px solid #a0dfff; color: #333;">Pengeluaran</th>
                    <th style="padding: 0.8rem; text-align: right; font-weight: 600; font-size: 0.9rem; border-bottom: 2px solid #a0dfff; color: #333;">Saldo</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
  const tempTbody = tempTable.querySelector('tbody');

  transactionsWithRunningBalanceForPdf.forEach((t, index) => {
    const row = document.createElement('tr');
    row.style.backgroundColor = (index % 2 === 0) ? '#ffffff' : '#f8f8f8';
    row.innerHTML = `
                <td style="padding: 0.7rem; border-bottom: 1px solid #eee;">${formatDate(t.tanggal)}</td>
                <td style="padding: 0.7rem; border-bottom: 1px solid #eee; text-align: left;">${t.deskripsi}</td>
                <td style="padding: 0.7rem; border-bottom: 1px solid #eee; text-align: right; color: #10b981; font-weight: 500;">${t.jenis === 'pemasukan' ? formatCurrency(t.jumlah) : '-'}</td>
                <td style="padding: 0.7rem; border-bottom: 1px solid #eee; text-align: right; color: #ef4444; font-weight: 500;">${t.jenis === 'pengeluaran' ? formatCurrency(t.jumlah) : '-'}</td>
                <td style="padding: 0.7rem; border-bottom: 1px solid #eee; text-align: right; font-weight: 600; color: #333;">${formatCurrency(t.runningBalance)}</td>
            `;
    tempTbody.appendChild(row);
  });

  const summarySection = document.createElement('div');
  summarySection.style.marginTop = '2rem';
  summarySection.style.padding = '1.5rem';
  summarySection.style.backgroundColor = '#f8fafc';
  summarySection.style.borderRadius = '8px';
  summarySection.style.border = '1px solid #e2e8f0';
  summarySection.innerHTML = `
            <h3 style="font-size: 1.1rem; font-weight: 600; color: #333; margin-bottom: 1rem; text-align: center;">Ringkasan Keuangan</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
                <div style="padding: 1rem; background: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; font-weight: 500;">Total Pemasukan</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: #10b981;">${formatCurrency(totalPemasukan)}</div>
                </div>
                <div style="padding: 1rem; background: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; font-weight: 500;">Total Pengeluaran</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: #ef4444;">${formatCurrency(totalPengeluaran)}</div>
                </div>
                <div style="padding: 1rem; background: #ffffff; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; font-weight: 500;">Saldo Akhir</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: #333;">${formatCurrency(totalSaldo)}</div>
                </div>
            </div>
        `;

  const appTitle = document.getElementById('app-title').textContent;
  const filter = document.getElementById('filter-bulan').value;
  const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
  let periodText = 'Semua Periode';
  if (filter !== 'semua') {
    periodText = formatMonth(filter);
  }
  if (searchTerm) {
    periodText += ` (Pencarian: "${searchTerm}")`;
  }
  if (currentFilteredDate) {
    periodText += ` (Pencarian Tanggal: "${formatDate(currentFilteredDate)}")`;
  }


  const pdfHeader = document.createElement('div');
  pdfHeader.style.textAlign = 'center';
  pdfHeader.style.marginBottom = '1.5rem';
  pdfHeader.style.fontFamily = 'Inter, sans-serif';
  pdfHeader.innerHTML = `
            <h1 style="font-size: 20px; color: #1f2937; margin-bottom: 0.75rem;">${appTitle} - Laporan Keuangan</h1>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 0.5rem;">Periode: ${periodText} • Dibuat: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0;">
        `;

  const pdfContentWrapper = document.createElement('div');
  pdfContentWrapper.appendChild(pdfHeader);
  pdfContentWrapper.appendChild(tempTable);
  pdfContentWrapper.appendChild(summarySection);

  const hiddenDiv = document.createElement('div');
  hiddenDiv.style.position = 'absolute';
  hiddenDiv.style.left = '-9999px';

  document.body.appendChild(hiddenDiv);
  hiddenDiv.appendChild(pdfContentWrapper);

  const orientation = pdfOrientationSelect.value;
  let filename = pdfFilenameInput.value.trim();
  if (!filename) {
    filename = `laporan-keuangan-${filter === 'semua' ? 'semua-periode' : filter}`;
  }
  filename += '.pdf';

  const opt = {
    margin: 0.5,
    filename: filename,
    image: {
      type: 'jpeg',
      quality: 0.98
    },
    html2canvas: {
      scale: 2,
      useCORS: true,
      scrollY: 0,
      windowWidth: document.documentElement.offsetWidth,
      windowHeight: document.documentElement.offsetHeight
    },
    jsPDF: {
      unit: 'in',
      format: 'letter',
      orientation: orientation
    }
  };

  html2pdf().set(opt).from(pdfContentWrapper).save().then(() => {
    showNotification('PDF berhasil dibuat!', 'success');
    document.body.removeChild(hiddenDiv);
    closePdfSettingsModal();
  }).catch(error => {
    console.error('Error generating PDF:', error);
    showNotification('Gagal membuat PDF', 'error');
    document.body.removeChild(hiddenDiv);
    closePdfSettingsModal();
  });
}

let notificationId = 0;

function showNotification(message, type = 'success', duration = 3000) {
  const container = document.getElementById('notification-container');
  const id = ++notificationId;

  let icon;
  switch (type) {
    case 'success':
      icon = '✓';
      break;
    case 'error':
      icon = '✕';
      break;
    case 'info':
      icon = 'i';
      break;
    case 'warning':
      icon = '!';
      break;
    default:
      icon = '•';
  }

  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.id = `notification-${id}`;

  notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="closeNotification(${id})">&times;</button>
      `;

  container.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 50);

  if (duration !== null) {
    setTimeout(() => {
      closeNotification(id);
    }, duration);
  }

  return id;
}

function closeNotification(id) {
  const notification = document.getElementById(`notification-${id}`);
  if (notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 250);
  }
}

function debounce(func, delay = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(isoDate) {
  const date = new Date(isoDate + 'T00:00:00');
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatMonth(isoMonth) {
  const [year, month] = isoMonth.split('-');
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function openConfirmationModal(message, callback) {
  confirmationModalMessage.textContent = message;
  currentConfirmCallback = callback;
  confirmationModal.style.display = 'flex';
}

function closeConfirmationModal() {
  confirmationModal.style.display = 'none';
  currentConfirmCallback = null;
}

function exportData() {
  if (transaksi.length === 0) {
    showNotification('Tidak ada data transaksi untuk diexport.', 'info');
    return;
  }

  const dataStr = JSON.stringify(transaksi, null, 2);
  const blob = new Blob([dataStr], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const appTitle = document.getElementById('app-title').textContent.replace(/\s/g, '-');
  a.href = url;
  a.download = `${appTitle}-data-transaksi-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('Data transaksi berhasil diexport!', 'success');
}

function openImportModal() {
  if (!checkLoginStatus()) return;
  importModal.style.display = 'flex';
  importFileInput.value = '';
  confirmImportBtn.disabled = true;
}

function closeImportModal() {
  importModal.style.display = 'none';
  importFileInput.value = '';
  confirmImportBtn.disabled = true;
}

function confirmImportData() {
  const file = importFileInput.files[0];
  if (!file) {
    showNotification('Pilih file JSON untuk diimport.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const importedData = JSON.parse(event.target.result);
      if (Array.isArray(importedData) && importedData.every(item =>
          typeof item.deskripsi === 'string' &&
          typeof item.jumlah === 'number' &&
          typeof item.tanggal === 'string' &&
          typeof item.jenis === 'string'
        )) {
        openConfirmationModal('Semua data transaksi yang ada saat ini akan diganti. Lanjutkan?', () => {
          transaksi = importedData;
          localStorage.setItem('transaksi', JSON.stringify(transaksi));
          updateUI();
          closeImportModal();
          showNotification('Data transaksi berhasil diimport!', 'success');
          editIndex = null;
          form.reset();
          setTodayDate();
          formTitle.textContent = '📝 Tambah Transaksi Baru';
          submitText.textContent = 'Simpan Transaksi';
          cancelEditBtn.style.display = 'none';
        });
      } else {
        showNotification('Format file JSON tidak valid. Pastikan berisi array transaksi dengan properti yang benar.', 'error');
      }
    } catch (e) {
      showNotification('Gagal membaca file JSON. Pastikan format file benar dan tidak rusak.', 'error');
      console.error('Error parsing JSON:', e);
    }
  };
  reader.onerror = function() {
    showNotification('Gagal membaca file.', 'error');
  };
  reader.readAsText(file);
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    scrollToForm();
    document.getElementById('deskripsi').focus();
  }

  if (e.key === 'Escape' && editIndex !== null) {
    cancelEdit();
  }

  if (e.key === 'Escape') {
    if (themeSettingsModal.style.display === 'flex') closeThemeModal();
    if (pdfSettingsModal.style.display === 'flex') closePdfSettingsModal();
    if (deleteModal.style.display === 'flex') closeDeleteModal();
    if (importModal.style.display === 'flex') closeImportModal();
    if (document.getElementById('title-edit-modal').classList.contains('show')) closeTitleEditModal();
    if (confirmationModal.style.display === 'flex') closeConfirmationModal();
    if (dataActionsDropdown.classList.contains('open')) dataActionsDropdown.classList.remove('open');
    if (document.getElementById('scan-modal').style.display === 'flex') closeScanner();
  }
});


function scrollToForm() {
  document.querySelector('.form-container').scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

// ▼▼▼ TEMPEL KODE BARU ANDA DI SINI ▼▼▼
function initializeCustomSelect() {
  const container = document.getElementById('custom-jenis');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const hiddenInput = document.getElementById('jenis');
  const optionsContainer = container.querySelector('.select-items');
  const options = optionsContainer.querySelectorAll('div');

  // Fungsi untuk menutup dropdown
  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

  // Tetapkan nilai default saat halaman dimuat (Pengeluaran)
  const defaultOption = options[1];
  selectedDisplay.innerHTML = defaultOption.innerHTML;
  hiddenInput.value = defaultOption.getAttribute('data-value');
  
  // Event saat kotak utama diklik (untuk membuka/menutup)
  selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    closeAllSelect(); // Selalu tutup dulu
    if (!isActive) { // Jika tadinya tidak aktif, buka
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
    }
  });

  // Event saat salah satu pilihan di-klik
  options.forEach(option => {
    option.addEventListener('click', function() {
      selectedDisplay.innerHTML = this.innerHTML;
      hiddenInput.value = this.getAttribute('data-value');
      closeAllSelect();
    });
  });

  // Event untuk menutup dropdown jika klik di luar area
  document.addEventListener('click', closeAllSelect);
}

function initializeMonthFilter() {
  const container = document.getElementById('custom-filter-bulan');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const optionsContainer = container.querySelector('.select-items');

  // Fungsi untuk menutup dropdown
  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

  // Event saat kotak utama diklik (untuk membuka/menutup)
  selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    // Tutup semua dropdown lain dulu (jika ada)
    document.querySelectorAll('.custom-select-container').forEach(c => {
        if (c !== container) {
            c.classList.remove('select-active');
            c.querySelector('.select-items').classList.add('select-hide');
        }
    });

    if (!isActive) { // Jika tadinya tidak aktif, buka
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
    } else {
      closeAllSelect();
    }
  });

  // Event untuk menutup dropdown jika klik di luar area
  document.addEventListener('click', closeAllSelect);
}

function initializePdfOrientationSelect() {
  const container = document.getElementById('custom-pdf-orientation');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const hiddenInput = document.getElementById('pdf-orientation');
  const optionsContainer = container.querySelector('.select-items');
  const options = optionsContainer.querySelectorAll('div');

  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

  // Atur nilai default saat modal dibuka
  const defaultOption = options[0];
  selectedDisplay.innerHTML = defaultOption.innerHTML;
  hiddenInput.value = defaultOption.getAttribute('data-value');

  // Event saat kotak utama diklik (untuk membuka/menutup)
  selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    // Tutup dropdown lain dulu (jika ada)
    document.querySelectorAll('.custom-select-container').forEach(c => {
        if (c !== container) {
            c.classList.remove('select-active');
            c.querySelector('.select-items').classList.add('select-hide');
        }
    });

    if (!isActive) { // Jika tadinya tidak aktif, buka
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
    } else {
      closeAllSelect();
    }
  });

  // Event saat salah satu pilihan di-klik
  options.forEach(option => {
    option.addEventListener('click', function() {
      selectedDisplay.innerHTML = this.innerHTML;
      hiddenInput.value = this.getAttribute('data-value');
      closeAllSelect();
    });
  });

  // Event untuk menutup dropdown jika klik di luar area
  document.addEventListener('click', closeAllSelect);
}

// ===============================================
// FUNGSI BARU UNTUK OTENTIKASI (LOGIN)
// ===============================================

// Menampilkan modal login
function showLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-kode').focus();
}

// Menutup modal login
function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'none';
    document.getElementById('modal-error-message').style.display = 'none';
    document.getElementById('modal-kode').value = '';
}

// [BARU] Fungsi helper untuk mendapatkan/membuat ID perangkat unik
function getDeviceId() {
    let deviceId = localStorage.getItem('myBudgetlyDeviceId');
    if (!deviceId) {
        // Membuat ID unik yang sangat kuat dan menyimpannya
        deviceId = crypto.randomUUID(); 
        localStorage.setItem('myBudgetlyDeviceId', deviceId);
    }
    return deviceId;
}

// [MODIFIKASI] Menangani upaya login dari modal
async function handleLogin(event) {
    event.preventDefault(); 
    const kodeInput = document.getElementById('modal-kode');
    const errorMessage = document.getElementById('modal-error-message');
    const kodeYangDimasukkan = kodeInput.value.trim();
    const deviceId = getDeviceId(); // Fungsi ini sudah Anda miliki
    const loginButton = document.querySelector('.login-button');

    loginButton.disabled = true;
    loginButton.textContent = 'Memverifikasi...';

    // GANTI SELURUH BLOK INI (dari try sampai finally)
try {
    const { data, error } = await supabase.functions.invoke('verify-code', {
        body: {
            code: kodeYangDimasukkan,
            deviceId: deviceId
        }
    });

    if (error) {
        // Jika server mengembalikan error (mis. 500, 404)
        throw error;
    }

    // [PERBAIKAN 1] Cek data tidak null SEBELUM cek data.success
    if (data && data.success) {
        // 4. JIKA SERVER BILANG BERHASIL
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('myAccessCode', kodeYangDimasukkan);
        localStorage.setItem('myDeviceId', deviceId);

        closeLoginModal();
        updateAuthUI();
        updateUI();
        showNotification('Login berhasil! Selamat datang.', 'success');

        startRealtimeSessionListener();

    } else {
        // Jika function mengembalikan success: false ATAU data: null
        // [PERBAIKAN 2] Cek data tidak null SEBELUM cek data.message
        errorMessage.textContent = (data && data.message) || 'Kode tidak valid atau sudah digunakan.';
        errorMessage.style.display = 'block';
        kodeInput.value = '';
        kodeInput.focus();
    }
    
} catch (error) {
    // Jika terjadi error (dari throw error atau TypeError)
    console.error('Login API error:', error);
    errorMessage.textContent = 'Gagal terhubung ke server. Coba lagi nanti.';
    errorMessage.style.display = 'block';

} finally {
    // Ini SELALU dijalankan, baik sukses, gagal, atau crash
    loginButton.disabled = false;
    loginButton.textContent = 'Masuk';
}
}

// GANTI FUNGSI LAMA DENGAN VERSI BARU INI
async function startRealtimeSessionListener() {
    // 1. Ambil kode yang sedang dipakai dari localStorage
    const myCode = localStorage.getItem('myAccessCode');

    if (!myCode) return;

    // 2. Bersihkan listener lama jika ada
    if (realtimeChannel) {
        await realtimeChannel.unsubscribe();
        realtimeChannel = null;
    }

    // 3. Buat channel baru yang spesifik mendengarkan KODE INI
    console.log(`Mulai mendengarkan perubahan pada kode: ${myCode}`);
    
    realtimeChannel = supabase
        .channel(`access-code-${myCode}`)
        .on(
            'postgres_changes', 
            {
                event: '*', // Dengarkan SEMUA event (INSERT, UPDATE, DELETE)
                schema: 'public',
                
                // ===============================================
                // PERBAIKAN #2: Nama Tabel sudah benar
                // ===============================================
                table: 'kode_akses',
                
                // ===============================================
                // PERBAIKAN #3: Nama Kolom filter sudah benar
                // ===============================================
                filter: `kode=eq.${myCode}` 
            },
            (payload) => {
                // 4. PERIKSA APA YANG TERJADI
                console.log('Perubahan database terdeteksi:', payload);

                // [KASUS 1: KODE DIHAPUS]
                if (payload.eventType === 'DELETE') {
                    console.log('Kode akses telah DIHAPUS dari server!');
                    showNotification('Sesi Anda telah berakhir (kode dihapus).', 'error');
                    handleLogout();
                } 
                
                // [KASUS 2: KODE DIUBAH]
                else if (payload.eventType === 'UPDATE') {
                    
                    // ===============================================
                    // PERBAIKAN #3: Pengecekan nama kolom sudah benar
                    // ===============================================
                    if (payload.old.kode !== payload.new.kode) {
                        console.log(`Kode akses telah DIUBAH dari '${payload.old.kode}' menjadi '${payload.new.kode}'!`);
                        showNotification('Sesi Anda telah berakhir (kode diubah).', 'error');
                        handleLogout();
                    } else {
                        console.log('Data kode diupdate, tapi kodenya tidak berubah. Sesi lanjut.');
                    }
                }
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Berhasil terhubung ke Realtime untuk session listener.');
            }
            if (status === 'CHANNEL_ERROR' || err) {
                console.error('Koneksi Realtime gagal:', err);
            }
        });
}

async function forceLogout(message) {
    console.warn(`Force logout dipicu: ${message}`);

    if (realtimeChannel) { 
    await supabaseRealtimeClient.removeChannel(realtimeChannel); 
    realtimeChannel = null; 
}

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('myAccessCode');
    localStorage.removeItem('myDeviceId');

    updateAuthUI(); 
    updateUI();     

    showNotification(message, 'error', 6000);
}

// [MODIFIKASI] Menangani logout
async function handleLogout() {
  const codeToRelease = localStorage.getItem('myAccessCode');
  const logoutButton = document.getElementById('auth-button');

  if(logoutButton) logoutButton.disabled = true;

  // 1. Berhenti mendengarkan channel Realtime
  if (realtimeChannel) { 
    await supabaseRealtimeClient.removeChannel(realtimeChannel); 
    realtimeChannel = null; 
  }

  try {
    if (codeToRelease) {
      
      const deviceId = getDeviceId(); // Ambil deviceId

      // ==========================================================
      // INI ADALAH PERBAIKANNYA: deviceId sekarang dikirim ke server
      // ==========================================================
      const { error: invokeError } = await supabase.functions.invoke('release-code', {
          body: { 
            code: codeToRelease,
            deviceId: deviceId  // <-- INI YANG DIPERBAIKI
          }});
      // ==========================================================

      if (invokeError) {
          throw invokeError; // Lemparkan error jika invoke gagal
      }
    }
  } catch (error) {
    console.error('Gagal menghubungi server untuk rilis kode:', error);
  } finally {
    // 3. Bersihkan localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('myAccessCode');
    localStorage.removeItem('myDeviceId'); // Hapus deviceId juga

    if(logoutButton) logoutButton.disabled = false;

    updateAuthUI(); 
    updateUI();     
    showNotification('Anda telah logout.', 'info');

    document.getElementById('settings-menu').classList.remove('open');
  }
}

// Memperbarui UI berdasarkan status login (tombol Login/Logout)
function updateAuthUI() {
    const authButton = document.getElementById('auth-button');
    const authButtonText = authButton.querySelector('span');

    if (localStorage.getItem('isLoggedIn') === 'true') {
        // Jika sudah login
        authButtonText.textContent = 'Logout';
        authButton.onclick = handleLogout;
    } else {
        // Jika masih tamu
        authButtonText.textContent = 'Login';
        authButton.onclick = showLoginModal;
    }
}

// Fungsi "Gatekeeper" (Satpam)
// Ini akan dipanggil oleh setiap fungsi aksi
function checkLoginStatus() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        return true; // Lolos, lanjutkan aksi
    } else {
        showLoginModal(); // Blokir, tampilkan modal login
        return false;     // Gagal
    }
}

// Menampilkan UI untuk mode tamu (data kosong)
function loadGuestUI() {
    // Kosongkan kartu ringkasan
    document.getElementById('pemasukan').textContent = formatCurrency(0);
    document.getElementById('pengeluaran').textContent = formatCurrency(0);
    document.getElementById('saldo').textContent = formatCurrency(0);

    // Kosongkan tabel
    const tbody = document.getElementById('tbody-tabel');
    tbody.innerHTML = '';
    
    // Tampilkan pesan selamat datang
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'block';

    // ▼▼▼ KONTEN HTML TELAH DIMODIFIKASI (Satu Kalimat Saja) ▼▼▼
    emptyState.innerHTML = `
        <div class="empty-state-icon">👋</div>
        <h2>Selamat Datang di MyBudgetly</h2>
        
        <p style="font-size: 1.05rem; max-width: 550px; margin: 0 auto; line-height: 1.6; color: var(--text-secondary);">
            Ini adalah mode demo, miliki aplikasi <b>MyBudgetly</b> versi lengkap di
            <a href="https://lynk.id/arul.n11" target="_blank" rel="noopener noreferrer" 
               style="color: var(--primary-accent-color); 
                      font-weight: 600; 
                      text-decoration: underline;
                      text-decoration-thickness: 2px;">
                lynk.id/arul.n11
            </a>
        </p>
    `;
    // ▲▲▲ AKHIR DARI MODIFIKASI ▲▲▲
    
    document.querySelector('.table-container table').style.display = 'none';
    document.getElementById('pagination-controls').innerHTML = '';

}

// script.js (Tambahkan ini setelah fungsi hexToRgba)

/**
 * Menghitung kecerahan warna hex dan mengembalikan
 * warna teks yang kontras (gelap atau terang).
 * @param {string} hexColor - Warna latar belakang (cth: "#FFFFFF")
 * @returns {string} - Warna teks yang sesuai ("#1f2937" atau "#ffffff")
 */
function getTextColorForBackground(hexColor) {
  try {
    // Bersihkan hex dan konversi ke RGB
    let hex = hexColor.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Hitung 'brightness' menggunakan formula YIQ
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // Jika brightness > 149 (ambang batas untuk terang), kembalikan warna gelap.
    // Jika tidak, kembalikan warna terang (putih).
    return brightness > 149 ? '#1f2937' : '#ffffff';
  } catch (e) {
    console.error("Gagal menghitung warna teks:", e);
    return '#ffffff'; // Default ke putih jika ada error
  }
}

// script.js (Tambahkan ini setelah fungsi getTextColorForBackground)

function applyCustomColor(customColor) {
  const gradient = generateGradient(customColor);
  const glow = hexToRgba(customColor, 0.15);
  // Panggil fungsi baru kita untuk mendapatkan warna teks yang tepat
  const textColor = getTextColorForBackground(customColor);

  const docStyle = document.documentElement.style;
  docStyle.setProperty('--primary-gradient', gradient);
  docStyle.setProperty('--primary-accent-color', customColor); 
  docStyle.setProperty('--primary-accent-color-glow', glow);
  // Atur variabel CSS baru untuk warna teks tombol
  docStyle.setProperty('--primary-btn-text-color', textColor);
  document.documentElement.setAttribute('data-color-theme', 'custom');

  localStorage.setItem('colorTheme', 'custom');
  localStorage.setItem('customAccentColor', customColor);

  updateActiveThemeButton(null);
  updateActiveSwatch();
}