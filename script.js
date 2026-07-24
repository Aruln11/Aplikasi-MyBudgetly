const SUPABASE_URL = 'https://kycmnkibuxtzrbzrhezo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5Y21ua2lidXh0enJienJoZXpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODI3NDAsImV4cCI6MjA3NzA1ODc0MH0.WtZhCS8qRUQNX5cSJAKdyA4G7Df7izGeWcjbWZTSbE4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let realtimeChannel = null;

let transaksi = JSON.parse(localStorage.getItem('transaksi')) || [];
let editIndex = null;
let currentFilteredDate = null;
let currentConfirmCallback = null;
let itemRowCounter = 0;

let currentPage = 1;
const transactionsPerPage = 10;

let cameraStream = null;
let cropper = null;

function initTheme() {
  const savedColorTheme = localStorage.getItem('colorTheme') || 'ocean';
  const customAccentColor = localStorage.getItem('customAccentColor');

  const colorPicker = document.getElementById('custom-color-input');

  if (colorPicker) {
    if (savedColorTheme === 'custom' && customAccentColor) {
      colorPicker.value = customAccentColor;
    } else {
      colorPicker.value = '#4f46e5';
    }
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

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

function updateActiveThemeButton(activeThemeName) {
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeName === activeThemeName);
  });
}

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

  paletteContainer.innerHTML = '';

  colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = color.value;
    swatch.title = color.name;
    swatch.dataset.color = color.value;

    swatch.addEventListener('click', () => {
      const customColor = swatch.dataset.color;
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

function handleProfilePhotoChange(event) {
  if (!checkLoginStatus()) {
        event.target.value = null;
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
      // Sync ke halaman profil jika terbuka
      if (typeof syncProfilPhoto === 'function') syncProfilPhoto();
    };
    reader.readAsDataURL(file);
  }
}

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

async function checkMaintenanceStatus() {
    const screen = document.getElementById('maintenance-screen');
    const textEl = document.getElementById('maintenance-text');
    const mainContent = document.getElementById('main-app-content');
    
    try {
        const { data } = await supabaseClient
            .from('pengaturan_admin')
            .select('status, value')
            .eq('setting_fitur', 'maintenance mode')
            .maybeSingle();

        if (data && data.status === true) {
            textEl.innerText = data.value || "Kami sedang melakukan pemeliharaan rutin.";
            screen.style.display = 'flex';
            mainContent.style.display = 'none';
            document.body.style.overflow = 'hidden'; 
        } else {
            screen.style.display = 'none';
            mainContent.style.display = 'block';
            document.body.style.overflow = 'auto';
        }
    } catch (err) {
        screen.style.display = 'none';
        mainContent.style.display = 'block';
    }
    
}

function startMaintenanceRealtime() {
    supabaseClient
        .channel('maintenance-channel')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'pengaturan_admin',
            filter: 'setting_fitur=eq.maintenance mode' 
        }, 
        (payload) => {
            const statusBaru = payload.new.status;
            const pesanBaru = payload.new.value;
            const screen = document.getElementById('maintenance-screen');
            const textEl = document.getElementById('maintenance-text');
            const mainContent = document.getElementById('main-app-content'); // Tambahkan ini

            if (statusBaru === true) {
                // Jika Maintenance ON: Tampilkan layar update, Sembunyikan aplikasi
                screen.style.display = 'flex';
                if (mainContent) mainContent.style.display = 'none';
                textEl.innerText = pesanBaru || "Kami sedang melakukan pemeliharaan rutin.";
                document.body.style.overflow = 'hidden';
            } else {
                // Jika Maintenance OFF: Sembunyikan layar update, Tampilkan aplikasi
                screen.style.display = 'none';
                if (mainContent) mainContent.style.display = 'block';
                document.body.style.overflow = 'auto';
                
                // Opsional: Jalankan ulang createIcons agar icon Lucide muncul benar
                if (window.lucide) lucide.createIcons();
            }
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', function() {
  checkMaintenanceStatus();
  startMaintenanceRealtime();
  initTheme();
  loadProfilePhoto();
  loadAppTitle();
  setTodayDate();
  setupMidnightDateUpdate();
  setupEventListeners();
  initializeMonthFilter(); 
  initializePdfOrientationSelect();
  document.getElementById('modal-login-form').addEventListener('submit', handleLogin);
  document.getElementById('close-login-modal-btn').addEventListener('click', closeLoginModal);
  if (localStorage.getItem('isLoggedIn') === 'true') {
      startRealtimeSessionListener();
  }
  updateAuthUI();
  updateUI();

  // Restore halaman terakhir yang dibuka
  const savedPage = localStorage.getItem('activePageId');
  if (savedPage && savedPage !== 'home') {
    const navBtn = document.querySelector(`.nav-item[onclick*="'${savedPage}'"]`);
    switchTab(savedPage, navBtn);
  }

  // Auto-refresh countdown tugas setiap 60 detik
  setInterval(() => {
    if (typeof renderTugasList === 'function') renderTugasList();
    if (typeof renderRutinList === 'function') renderRutinList();
  }, 60000);
});

function setupEventListeners() {
  cancelEditBtn.addEventListener('click', cancelEdit);
  const settingsMenu = document.getElementById('settings-menu');
  const settingsToggle = document.getElementById('settings-menu-toggle');
  const openThemeModalBtn = document.getElementById('open-theme-modal-btn');

  if (settingsMenu && settingsToggle && openThemeModalBtn) {
    settingsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsMenu.classList.toggle('open');
    });

    openThemeModalBtn.addEventListener('click', () => {
      openThemeModal();
      settingsMenu.classList.remove('open');
    });

    window.addEventListener('click', (e) => {
      if (!settingsMenu.contains(e.target)) {
        settingsMenu.classList.remove('open');
      }
    });
  }

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
    updateUI();
  }, 300);

  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim();
    if (searchTerm) {
      searchClear.style.display = 'flex';
    } else {
      searchClear.style.display = 'none';
    }
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

function setupScanEventListeners() {
  const scanModal = document.getElementById('scan-modal');
  const scannerHelpBtn = document.getElementById('scanner-help-btn');
  const toggleEditBtn = document.getElementById('toggle-edit-btn');
  const toggleImageBtn = document.getElementById('toggle-image-btn');

  document.getElementById('scan-receipt-btn').addEventListener('click', openScanner);
  document.getElementById('capture-btn').addEventListener('click', captureImage);
  document.getElementById('rescan-btn').addEventListener('click', resetScanner);
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
  document.getElementById('scanner-view-container').style.display = 'block';
  document.getElementById('cropper-container').style.display = 'none';
  document.getElementById('scanner-results-container').style.display = 'none';

  document.getElementById('capture-btn').style.display = 'inline-flex';
  document.getElementById('preview-controls').style.display = 'none';
  document.getElementById('correction-controls').style.display = 'none';

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

    document.getElementById('scanner-view-container').style.display = 'none';
    document.getElementById('cropper-container').style.display = 'block';

    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(imageToCrop, {
        viewMode: 1,
        background: false,
        responsive: true,
        autoCropArea: 0.9,
    });

    document.getElementById('capture-btn').style.display = 'none';
    const processBtn = document.getElementById('process-btn');
    processBtn.querySelector('#process-btn-text').innerHTML = '✂️ Crop & Proses';
    processBtn.onclick = processCroppedImage;
    document.getElementById('preview-controls').style.display = 'flex';
}

function resetScanner() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    resetScannerState();
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

    const croppedCanvas = cropper.getCroppedCanvas({
        fillColor: '#fff'
    });

    if (!croppedCanvas) {
        showNotification('Gagal mendapatkan gambar hasil crop.', 'error');
        return;
    }

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
  // Step 1: Normalisasi teks mentah dari OCR
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const items = [];

  // Kata-kata yang pasti bukan item belanja
  const junkRegex = /^(total|subtotal|tunai|kembali|ppn|tax|diskon|discount|kasir|indomaret|alfamart|alfamidi|member|poin|tgl|wkt|struk|telp|no\.|nota|terima kasih|thank|change|cash|debit|kredit|grand|bayar|kembalian|waktu|tanggal|jam|shift|no\.transaksi|receipt|invoice|alamat|jl\.|npwp|bon)/i;

  // Fungsi bersihkan angka: hapus separator ribuan, simpan nilai asli
  const cleanNumber = (str) => {
    return parseInt(str.replace(/[.,\s]/g, ''), 10);
  };

  // Fungsi cek apakah string adalah angka harga yang valid (min Rp500)
  const isValidPrice = (n) => !isNaN(n) && n >= 500 && n <= 100000000;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Skip baris junk
    if (junkRegex.test(line)) continue;
    // Skip baris yang hanya angka atau terlalu pendek
    if (/^\d+$/.test(line) || line.length < 3) continue;

    // Bersihkan prefix Rp
    line = line.replace(/Rp\.?\s*/gi, '').trim();

    // POLA 1: "Nama Item    Qty x Harga    Total"
    // contoh: "Indomie Goreng  2 x 3.500  7.000"
    const qtyPattern = /^(.+?)\s+(\d{1,3})\s*[xX]\s*([\d.,]+)\s+([\d.,]+)$/;
    let m = line.match(qtyPattern);
    if (m) {
      const name = m[1].trim();
      const qty = parseInt(m[2]);
      const total = cleanNumber(m[4]);
      if (name.length >= 2 && /[a-zA-Z]/.test(name) && isValidPrice(total)) {
        items.push({ name, price: total });
        continue;
      }
    }

    // POLA 2: "Nama Item    Total" (paling umum di struk minimarket)
    // contoh: "AQUA 600ML    5000"
    const simplePattern = /^(.+?)\s{2,}([\d.,]{4,})$/;
    m = line.match(simplePattern);
    if (m) {
      const name = m[1].trim();
      const price = cleanNumber(m[2]);
      if (name.length >= 2 && /[a-zA-Z]/.test(name) && isValidPrice(price) && !junkRegex.test(name)) {
        items.push({ name, price });
        continue;
      }
    }

    // POLA 3: Nama di satu baris, harga di baris berikutnya
    // contoh: "Chitato BBQ\n12.500"
    if (/[a-zA-Z]{2,}/.test(line) && !junkRegex.test(line) && !/[\d.,]{5,}/.test(line)) {
      const nextLine = lines[i + 1] ? lines[i + 1].replace(/Rp\.?\s*/gi, '').trim() : '';
      const priceOnly = /^[\d.,]+$/.test(nextLine) || /^[\d.,]+\s*$/.test(nextLine);
      if (priceOnly) {
        const price = cleanNumber(nextLine);
        if (isValidPrice(price)) {
          items.push({ name: line, price });
          i++; // skip baris harga
          continue;
        }
      }
    }

    // POLA 4: Nama + harga di akhir baris (1 spasi)
    // contoh: "Teh Botol Sosro 5000"
    const endPricePattern = /^(.+?)\s+([\d.,]{4,})$/;
    m = line.match(endPricePattern);
    if (m) {
      const name = m[1].replace(/\d+$/, '').trim();
      const price = cleanNumber(m[2]);
      if (name.length >= 3 && /[a-zA-Z]{2,}/.test(name) && isValidPrice(price) && !junkRegex.test(name)) {
        items.push({ name, price });
      }
    }
  }

  // Hapus duplikat berdasarkan nama + harga
  const unique = items.filter((item, idx, self) =>
    idx === self.findIndex(t => t.name === item.name && t.price === item.price)
  );

  displayScannedItems(unique);
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

  const priceInput = div.querySelector('.item-price-input');
  priceInput.addEventListener('input', updateScannedTotal);

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
  } else {
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
        return;
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

function updateUI() {
  if (localStorage.getItem('isLoggedIn') !== 'true') {
        loadGuestUI();
        return; 
    }

  const emptyState = document.getElementById('empty-state');
  emptyState.innerHTML = `
    <div class="empty-state-icon">📊</div>
    <h3>Belum ada transaksi</h3>
    <p>Mulai tambahkan transaksi pertama Anda!</p>
  `;

  updateSummaryCards();
  updateTransactionsTable();
  updateMonthFilter();
  updateDateFilterDisplay();

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

function updatePaginationControls(totalTransactions) {
  const paginationControls = document.getElementById('pagination-controls');
  paginationControls.innerHTML = '';

  const totalPages = Math.ceil(totalTransactions / transactionsPerPage);

  if (totalPages <= 1) {
    return;
  }

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

  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info clickable';
  pageInfo.textContent = `${currentPage}/${totalPages}`;
  pageInfo.title = "Klik untuk lompat ke halaman";
  pageInfo.onclick = () => showPageInput(totalPages); 
  
  paginationControls.appendChild(pageInfo);

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

function showPageInput(totalPages) {
  const pageInfo = document.querySelector('.page-info');
  if (!pageInfo) return;

  const prevButton = document.querySelector('.pagination-btn:first-child');
  const nextButton = document.querySelector('.pagination-btn:last-child');
  
  const paginationControls = document.getElementById('pagination-controls');
  paginationControls.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'pagination-input';
  input.value = currentPage;
  input.min = 1;
  input.max = totalPages;

  const handleJump = () => {
    let newPage = parseInt(input.value);
    if (newPage >= 1 && newPage <= totalPages) {
      currentPage = newPage;
      updateUI();
    } else {
      showNotification(`Masukkan halaman antara 1 dan ${totalPages}`, 'error', 2000);
      updateUI();
    }
  };

  input.onkeydown = (event) => {
    if (event.key === 'Enter') {
      handleJump();
    } else if (event.key === 'Escape') {
      updateUI();
    }
  };

  input.onblur = () => {
    setTimeout(() => updateUI(), 100);
  };
  
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

  const customContainer = document.getElementById('custom-filter-bulan');
  const selectedDisplay = customContainer.querySelector('.select-selected');
  const optionsContainer = customContainer.querySelector('.select-items');

  hiddenSelect.innerHTML = '';
  optionsContainer.innerHTML = '';

  const createOption = (text, value) => {
    const option = document.createElement('option');
    option.value = value;
    option.innerHTML = text;
    hiddenSelect.appendChild(option);

    const div = document.createElement('div');
    div.innerHTML = text;
    div.setAttribute('data-value', value);
    optionsContainer.appendChild(div);

    div.addEventListener('click', function() {
      hiddenSelect.value = this.getAttribute('data-value');
      selectedDisplay.innerHTML = this.innerHTML;
      hiddenSelect.dispatchEvent(new Event('change'));
    });
  };

  createOption('Semua Bulan', 'semua');

  ([...bulanSet].sort()).reverse().forEach(bulan => {
    createOption(`Data ${formatMonth(bulan)}`, bulan);
  });

  hiddenSelect.value = currentFilter;
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

  const selectedDisplay = document.querySelector('#custom-jenis .select-selected');
  if (t.jenis === 'pemasukan') {
    selectedDisplay.innerHTML = '💰 Pemasukan';
  } else {
    selectedDisplay.innerHTML = '💸 Pengeluaran';
  }

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
    case 'success': icon = '✓'; break;
    case 'error': icon = '✕'; break;
    case 'info': icon = 'i'; break;
    case 'warning': icon = '!'; break;
    default: icon = '•';
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

  // Membuat Header (Judul Kolom)
  const headers = ["Tanggal", "Deskripsi", "Jenis", "Jumlah"];
  
  // Mengubah data transaksi menjadi baris CSV
  const csvRows = transaksi.map(t => {
    return [
      t.tanggal,
      `"${t.deskripsi.replace(/"/g, '""')}"`, // Mengurung deskripsi dengan kutip agar aman jika ada koma
      t.jenis,
      t.jumlah
    ].join(',');
  });

  // Menggabungkan Header dan Data
  const csvContent = ["sep=,", headers.join(','), ...csvRows].join('\n');
  
  // Proses Download File .csv
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const appTitle = document.getElementById('app-title').textContent.replace(/\s/g, '-');
  
  a.href = url;
  a.download = `${appTitle}-data-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotification('Data berhasil diexport ke CSV!', 'success');
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
    showNotification('Pilih file CSV untuk diimport.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const text = event.target.result;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      
      // Ambil data mulai dari baris kedua (indeks 1) karena baris pertama adalah header
      const importedData = lines.slice(1).map(line => {
        // Memecah kolom (mengabaikan koma di dalam tanda kutip)
        const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        
        if (columns.length >= 4) {
          return {
            tanggal: columns[0].trim(),
            // Membersihkan tanda kutip dari deskripsi
            deskripsi: columns[1].replace(/^"|"$/g, '').replace(/""/g, '"').trim(),
            jenis: columns[2].trim(),
            jumlah: parseFloat(columns[3])
          };
        }
        return null;
      }).filter(item => item !== null && !isNaN(item.jumlah));

      if (importedData.length > 0) {
        openConfirmationModal(`Ditemukan ${importedData.length} transaksi. Ganti data saat ini?`, () => {
          transaksi = importedData;
          localStorage.setItem('transaksi', JSON.stringify(transaksi));
          updateUI();
          closeImportModal();
          showNotification('Data CSV berhasil diimport!', 'success');
          
          // Reset form ke kondisi awal
          editIndex = null;
          form.reset();
          setTodayDate();
        });
      } else {
        showNotification('Format CSV tidak dikenali atau file kosong.', 'error');
      }
    } catch (e) {
      showNotification('Gagal membaca CSV. Pastikan file tidak rusak.', 'error');
    }
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


// 1. Tambahkan fungsi global ini agar tidak error saat dipanggil
function closeAllSelect() {
    document.querySelectorAll('.custom-select-container').forEach(c => {
        c.classList.remove('select-active');
        const items = c.querySelector('.select-items');
        if (items) items.classList.add('select-hide');
    });
}

// 2. Ini adalah fungsi initializeMonthFilter yang sudah dirapikan
function initializeMonthFilter() {
    const container = document.getElementById('custom-filter-bulan');
    if (!container) return;

    const selectedDisplay = container.querySelector('.select-selected');
    const optionsContainer = container.querySelector('.select-items');

    selectedDisplay.addEventListener('click', function(e) {
        e.stopPropagation();
        const isActive = container.classList.contains('select-active');
        
        closeAllSelect(); // Tutup dropdown lain yang sedang terbuka

        if (!isActive) {
            container.classList.add('select-active');
            optionsContainer.classList.remove('select-hide');
            // Render ulang ikon saat dibuka
            if (window.lucide) lucide.createIcons();
        }
    });

    // Event listener global untuk menutup dropdown saat klik di luar
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

  const defaultOption = options[0];
  selectedDisplay.innerHTML = defaultOption.innerHTML;
  hiddenInput.value = defaultOption.getAttribute('data-value');

  selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    document.querySelectorAll('.custom-select-container').forEach(c => {
        if (c !== container) {
            c.classList.remove('select-active');
            c.querySelector('.select-items').classList.add('select-hide');
        }
    });

    if (!isActive) {
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
    } else {
      closeAllSelect();
    }
  });

  options.forEach(option => {
    option.addEventListener('click', function() {
      selectedDisplay.innerHTML = this.innerHTML;
      hiddenInput.value = this.getAttribute('data-value');
      closeAllSelect();
    });
  });

  document.addEventListener('click', closeAllSelect);
}

function showLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-kode').focus();
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    modal.style.display = 'none';
    document.getElementById('modal-error-message').style.display = 'none';
    document.getElementById('modal-kode').value = '';
}

function getDeviceId() {
    let deviceId = localStorage.getItem('myBudgetlyDeviceId');
    if (!deviceId) {
        if (window.isSecureContext && typeof crypto.randomUUID === 'function') {
            deviceId = crypto.randomUUID();
        } else {
            deviceId = 'dev-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
        }
        localStorage.setItem('myBudgetlyDeviceId', deviceId);
    }
    return deviceId;
}

async function handleLogin(event) {
    event.preventDefault(); 
    const kodeInput = document.getElementById('modal-kode');
    const errorMessage = document.getElementById('modal-error-message');
    const loginButton = document.querySelector('.login-button');
    
    const kodeYangDimasukkan = kodeInput.value.trim();
    const deviceId = getDeviceId(); 
    const waktuSekarang = new Date().toLocaleString("sv-SE").replace(' ', 'T');
    
    errorMessage.style.display = 'none';
    loginButton.disabled = true;
    loginButton.textContent = 'Memverifikasi...';

    try {
        const { data: user, error: userError } = await supabaseClient
            .from('pelanggan')
            .select('*')
            .eq('kode_akses', kodeYangDimasukkan)
            .single();

        if (userError || !user) throw new Error('Kode akses salah!');
        if (user.status === 'pending') throw new Error('Akun menunggu persetujuan Admin.');
        if (user.status === 'diblokir') throw new Error('Akun ini telah diblokir.');

        const { data: deviceTerdaftar } = await supabaseClient
            .from('device_pelanggan')
            .select('id')
            .eq('kode_pelanggan', kodeYangDimasukkan)
            .eq('device_id', deviceId)
            .maybeSingle();

        if (!deviceTerdaftar) {
            const { count } = await supabaseClient
                .from('device_pelanggan')
                .select('*', { count: 'exact', head: true })
                .eq('kode_pelanggan', kodeYangDimasukkan);

            if (count >= (user.batas_perangkat || 3)) {
                throw new Error(`Kuota penuh! Maksimal ${user.batas_perangkat || 3} perangkat.`);
            }

            await supabaseClient
        .from('device_pelanggan')
        .insert({
            kode_pelanggan: kodeYangDimasukkan,
            device_id: deviceId,
            device_model: navigator.userAgent.slice(0, 50),
            terhubung_pada: waktuSekarang
        });
      } else {
    await supabaseClient
        .from('device_pelanggan')
        .update({ terhubung_pada: waktuSekarang })
        .eq('device_id', deviceId);
}

        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('myAccessCode', kodeYangDimasukkan);
        localStorage.setItem('myDeviceId', deviceId);
        localStorage.setItem('myUsername', user.username || '');

        closeLoginModal();
        updateAuthUI();
        updateUI();
        showNotification('Berhasil Masuk!', 'success');
        
        if (typeof startRealtimeSessionListener === 'function') {
            startRealtimeSessionListener();
        }

    } catch (error) {
        console.error("Login Failed:", error.message);
        errorMessage.textContent = error.message;
        errorMessage.style.display = 'block';
        kodeInput.classList.add('shake');
        setTimeout(() => kodeInput.classList.remove('shake'), 500);
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Masuk';
    }
}

async function startRealtimeSessionListener() {
    const myCode = localStorage.getItem('myAccessCode');
    if (!myCode) return;

    if (realtimeChannel) {
        await supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }

    realtimeChannel = supabaseClient.channel(`access-code-${myCode}`)
        .on(
            'postgres_changes', 
            {
                event: '*', 
                schema: 'public',
                table: 'pelanggan',
                filter: `kode_akses=eq.${myCode}`
            },
            (payload) => {
                if (payload.eventType === 'DELETE') {
                    showNotification('Sesi berakhir (kode dihapus).', 'error');
                    forceLogout("Akses dicabut oleh Admin.");
                } else if (payload.eventType === 'UPDATE') {
                    if (payload.new.status === 'diblokir') {
                        showNotification('Akun Anda diblokir.', 'error');
                        forceLogout("Akun diblokir.");
                    }
                }
            }
        )
        .subscribe();
}

async function forceLogout(message) {
    if (realtimeChannel) { 
   supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null; 
}

    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('myAccessCode');
    localStorage.removeItem('myDeviceId');
    localStorage.removeItem('myUsername');

    updateAuthUI(); 
    updateUI();     

    showNotification(message, 'error', 6000);
}

async function handleLogout() {
  const codeToRelease = localStorage.getItem('myAccessCode');
  const logoutButton = document.getElementById('auth-button');

  if(logoutButton) logoutButton.disabled = true;

  if (realtimeChannel) { 
    await supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null; 
  }

  try {
    if (codeToRelease) {
      const deviceId = getDeviceId();
      await supabaseClient.from('device_pelanggan').delete().eq('device_id', deviceId);
    }
  } catch (error) {
    console.error('Gagal hapus device:', error);
  } finally {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('myAccessCode');
    localStorage.removeItem('myDeviceId');
    localStorage.removeItem('myUsername');

    updateAuthUI(); 
    updateUI();     
    showNotification('Anda telah logout.', 'info');

    document.getElementById('settings-menu').classList.remove('open');
  }
}

function updateAuthUI() {
    const authButton = document.getElementById('auth-button');
    if (!authButton) return;
    const authButtonText = authButton.querySelector('span');
    if (!authButtonText) return;

    if (localStorage.getItem('isLoggedIn') === 'true') {
        authButtonText.textContent = 'Logout';
        authButton.onclick = handleLogout;
    } else {
        authButtonText.textContent = 'Login';
        authButton.onclick = showLoginModal;
    }
}

function handleAuthButtonClick() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        handleLogout();
    } else {
        document.getElementById('settings-menu').classList.remove('open');
        showLoginModal();
    }
}

function checkLoginStatus() {
    if (localStorage.getItem('isLoggedIn') === 'true') {
        return true;
    } else {
        showLoginModal();
        return false;
    }
}

function loadGuestUI() {
    document.getElementById('pemasukan').textContent = formatCurrency(0);
    document.getElementById('pengeluaran').textContent = formatCurrency(0);
    document.getElementById('saldo').textContent = formatCurrency(0);

    const tbody = document.getElementById('tbody-tabel');
    if(tbody) tbody.innerHTML = '';
    
    const emptyState = document.getElementById('empty-state');
    if(emptyState) {
        emptyState.style.display = 'block'; // Pastikan empty state aktif
        emptyState.innerHTML = `
            <div class="empty-state-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-empty-state">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <path d="M4 19l16 0" />
                    <path d="M4 15l4 -6l4 2l4 -5l4 4" />
                </svg>
            </div>
            <h3>Belum ada transaksi</h3>
            <p>Mulai tambahkan transaksi pertama Anda!</p>
        `;
    }
    
    const table = document.querySelector('.table-container table');
    if(table) table.style.display = 'none';
}

function getTextColorForBackground(hexColor) {
  try {
    let hex = hexColor.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return brightness > 149 ? '#1f2937' : '#ffffff';
  } catch (e) {
    console.error("Gagal menghitung warna teks:", e);
    return '#ffffff';
  }
}

function applyCustomColor(customColor) {
  const gradient = generateGradient(customColor);
  const glow = hexToRgba(customColor, 0.15);
  const textColor = getTextColorForBackground(customColor);

  const docStyle = document.documentElement.style;
  docStyle.setProperty('--primary-gradient', gradient);
  docStyle.setProperty('--primary-accent-color', customColor); 
  docStyle.setProperty('--primary-accent-color-glow', glow);
  docStyle.setProperty('--primary-btn-text-color', textColor);
  document.documentElement.setAttribute('data-color-theme', 'custom');
  if (customColor.toLowerCase() === '#ffffff' || customColor.toLowerCase() === '#fff') {
      document.documentElement.setAttribute('data-warna-putih', 'true');
  } else {
      document.documentElement.setAttribute('data-warna-putih', 'false');
  }

  localStorage.setItem('colorTheme', 'custom');
  localStorage.setItem('customAccentColor', customColor);

  updateActiveThemeButton(null);
  updateActiveSwatch();
}

function bukaModalDaftar() {
    document.getElementById('modal-daftar').style.display = 'flex';
}

function tutupModalDaftar() {
    document.getElementById('modal-daftar').style.display = 'none';
    document.getElementById('pesan-daftar').innerText = '';
}

async function kirimPermintaan() {
    const user = document.getElementById('reg-username').value.trim();
    const kode = document.getElementById('reg-kode').value.trim();
    const pesan = document.getElementById('pesan-daftar');

    if(!user || !kode) {
        pesan.innerText = "Isi semua kolom!";
        return;
    }

    // Ubah tombol jadi status loading biar user tahu sistem lagi proses
    const btnSubmit = document.querySelector('#modal-daftar .login-button');
    const textAwal = btnSubmit.innerText;
    btnSubmit.innerText = "Memproses...";
    btnSubmit.disabled = true;

    try {
        const { data: settings, error: fetchError } = await supabaseClient
            .from('pengaturan_admin')
            .select('setting_fitur, status, value')
            .in('setting_fitur', ['auto acc', 'default device limit']);

        if (fetchError) throw fetchError;

        // --- INI SABUK PENGAMANNYA ---
        // Jika settings bernilai null, kita ubah otomatis jadi array kosong []
        const safeSettings = settings || [];

        const configAuto = safeSettings.find(s => s.setting_fitur === 'auto acc');
        const configLimit = safeSettings.find(s => s.setting_fitur === 'default device limit');
        // -----------------------------

        const statusAwal = (configAuto && configAuto.status) ? 'aktif' : 'pending';
        const limitDefault = configLimit ? parseInt(configLimit.value) : 3; 

        const { error: insertError } = await supabaseClient.from('pelanggan').insert({
            username: user,
            kode_akses: kode,
            status: statusAwal,
            batas_perangkat: limitDefault,
            dibuat_tanggal: new Date().toLocaleString("sv-SE").replace(' ', 'T')
        });

        if (insertError) throw insertError;

        alert(statusAwal === 'aktif' ? "Akses Aktif! Silakan Login." : "Berhasil! Tunggu persetujuan Admin.");
        tutupModalDaftar();
        
    } catch (error) {
        console.error("Error pendaftaran:", error);
        pesan.innerText = "Gagal: " + (error.message || "Terjadi kesalahan jaringan.");
    } finally {
        // Kembalikan tombol ke keadaan semula apa pun yang terjadi
        btnSubmit.innerText = textAwal;
        btnSubmit.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  initTransaksiAsetListeners();

  // Counter karakter catatan
  const catatanEl = document.getElementById('input-catatan');
  const counterEl = document.getElementById('catatan-counter');
  if (catatanEl && counterEl) {
    catatanEl.addEventListener('input', () => {
      counterEl.textContent = catatanEl.value.length;
    });
  }
});

let dataAset = JSON.parse(localStorage.getItem('myBudgetly_assets')) || [];

// ===== RUANG DATA =====
let dataTugas  = JSON.parse(localStorage.getItem('myBudgetly_tugas'))  || [];
let dataTodo   = JSON.parse(localStorage.getItem('myBudgetly_todo'))   || [];
let dataCatatanRuang = JSON.parse(localStorage.getItem('myBudgetly_catatan')) || [];
let ruangCalDate = new Date();

function saveTugas()  { localStorage.setItem('myBudgetly_tugas',   JSON.stringify(dataTugas)); }
function saveTodo()   { localStorage.setItem('myBudgetly_todo',    JSON.stringify(dataTodo)); }
function saveCatatanRuang() { localStorage.setItem('myBudgetly_catatan', JSON.stringify(dataCatatanRuang)); }

// ===== SWITCH TAB RUANG =====
function switchRuangTab(tab, el) {
    document.querySelectorAll('.ruang-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.ruang-tab').forEach(t => t.classList.remove('active'));
    // Tutup dropdown jadwal jika ada
    const ddMenu = document.getElementById('jadwal-dropdown-menu');
    if (ddMenu) ddMenu.style.display = 'none';
    const jadwalBtn = document.getElementById('jadwal-tab-btn');
    if (jadwalBtn) jadwalBtn.classList.remove('active');
    // Tampilkan konten yang dipilih
    document.getElementById(`ruang-${tab}`).style.display = 'block';
    if (el) el.classList.add('active');
    if (tab === 'jadwal')  renderJadwal();
    if (tab === 'tugas')   { renderRuangKalender(); }
    if (tab === 'todo')    renderTodo();
    if (tab === 'catatan') renderCatatanRuang();
}

// ===== DROPDOWN JADWAL KELAS / JADWAL RUTIN =====
function toggleJadwalDropdown(e) {
    e.stopPropagation();
    const menu = document.getElementById('jadwal-dropdown-menu');
    const isOpen = menu.style.display === 'block';

    // Tutup semua tab lain dulu, aktifkan tab jadwal
    document.querySelectorAll('.ruang-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.ruang-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('jadwal-tab-btn').classList.add('active');
    document.getElementById('ruang-jadwal').style.display = 'block';

    if (isOpen) {
        // Tutup dropdown
        menu.style.display = 'none';
        const arrow = document.getElementById('jadwal-arrow');
        if (arrow) arrow.style.transform = '';
    } else {
        // Buka dropdown
        menu.style.display = 'block';
        const arrow = document.getElementById('jadwal-arrow');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        // Pastikan sub yang aktif ter-render
        const activeLabel = document.getElementById('jadwal-tab-label').textContent;
        const currentSub = activeLabel === 'Jadwal Rutin' ? 'rutin' : 'kelas';
        switchSubJadwal(currentSub);
    }

    if (window.lucide) lucide.createIcons();
}

function pilihJadwalTab(sub, e) {
    if (e) e.stopPropagation();
    // Tutup dropdown
    const menu = document.getElementById('jadwal-dropdown-menu');
    menu.style.display = 'none';
    const arrow = document.getElementById('jadwal-arrow');
    if (arrow) arrow.style.transform = '';
    // Update label tab
    const labelMap = { kelas: 'Jadwal Kelas', rutin: 'Jadwal Rutin' };
    document.getElementById('jadwal-tab-label').textContent = labelMap[sub];
    // Update active item di dropdown
    document.querySelectorAll('.jadwal-dropdown-item').forEach(i => i.classList.remove('active'));
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
    // Switch konten
    switchSubJadwal(sub);
}

function switchSubJadwal(sub) {
    document.getElementById('sub-jadwal-kelas').style.display = sub === 'kelas' ? 'block' : 'none';
    document.getElementById('sub-jadwal-rutin').style.display = sub === 'rutin'  ? 'block' : 'none';
    const ruangJadwal = document.getElementById('ruang-jadwal');
    if (ruangJadwal) ruangJadwal.style.display = 'block';
    if (sub === 'kelas') renderJadwal();
    if (sub === 'rutin') {
        // Beri browser 1 frame untuk layout sebelum render
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                renderRutinKalender();
                if (window.lucide) lucide.createIcons();
            });
        });
        return;
    }
    if (window.lucide) lucide.createIcons();
}

// Tutup dropdown kalau klik di luar
document.addEventListener('click', function(e) {
    const menu = document.getElementById('jadwal-dropdown-menu');
    const btn  = document.getElementById('jadwal-tab-btn');
    if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.style.display = 'none';
            const arrow = document.getElementById('jadwal-arrow');
            if (arrow) arrow.style.transform = '';
        }
    }
});

// ===== KALENDER TUGAS =====
function renderRuangKalender() {
    const year  = ruangCalDate.getFullYear();
    const month = ruangCalDate.getMonth();
    document.getElementById('ruang-cal-title').textContent =
        new Date(year, month, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('ruang-cal-grid');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const today = new Date();

    // Sel kosong sebelum hari pertama
    for (let i = 0; i < firstDay; i++) {
        const d = daysInPrev - firstDay + 1 + i;
        grid.appendChild(buildCalCell(d, year, month - 1, true));
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        grid.appendChild(buildCalCell(d, year, month, false, isToday));
    }
    // Sisa sel setelah akhir bulan
    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
        grid.appendChild(buildCalCell(d, year, month + 1, true));
    }

    renderTugasList();
    if (window.lucide) lucide.createIcons();
}

function buildCalCell(d, year, month, otherMonth, isToday) {
    const cell = document.createElement('div');
    cell.className = 'ruang-cal-cell' + (otherMonth ? ' other-month' : '') + (isToday ? ' today' : '');

    const dateEl = document.createElement('div');
    dateEl.className = 'ruang-cal-date';
    dateEl.textContent = d;
    cell.appendChild(dateEl);

    if (!otherMonth) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const tugasHariIni = dataTugas.filter(t => t.tanggal === dateStr);

        // Urutkan: belum/proses (sorted deadline terdekat) dulu, selesai di bawah
        const belum = tugasHariIni
            .filter(t => t.status !== 'selesai')
            .sort((a, b) => new Date(a.tanggal + 'T' + (a.jam || '23:59')) - new Date(b.tanggal + 'T' + (b.jam || '23:59')));
        const selesai = tugasHariIni.filter(t => t.status === 'selesai');
        const sorted = [...belum, ...selesai];

        sorted.slice(0, 2).forEach(t => {
            const ev = document.createElement('div');
            ev.className = `ruang-cal-event ${t.status}`;
            ev.textContent = t.judul;
            cell.appendChild(ev);
        });

        if (sorted.length > 2) {
            const sisanya = sorted.slice(2);
            const sisaBelum = sisanya.filter(t => t.status !== 'selesai').length;
            const more = document.createElement('div');
            more.className = `ruang-cal-event ${sisaBelum === 0 ? 'selesai' : 'belum'}`;
            more.textContent = `+${sisaBelum === 0 ? sisanya.length : sisaBelum} lagi`;
            cell.appendChild(more);
        }
        cell.onclick = () => lihatTugasTanggal(dateStr);
    }
    return cell;
}

function ruangPrevMonth() { ruangCalDate.setMonth(ruangCalDate.getMonth() - 1); renderRuangKalender(); }
function ruangNextMonth() { ruangCalDate.setMonth(ruangCalDate.getMonth() + 1); renderRuangKalender(); }

function lihatTugasTanggal(dateStr) {
    window._selectedTanggal = dateStr;
    const tugasHariIni = dataTugas.filter(t => t.tanggal === dateStr);

    const date = new Date(dateStr + 'T00:00:00');
    const label = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('modal-tugas-tanggal-title').textContent = label;

    const list = document.getElementById('modal-tugas-tanggal-list');

    if (tugasHariIni.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:14px;">Tidak ada tugas di tanggal ini</div>`;
    } else {
        list.innerHTML = '';
        tugasHariIni.forEach(t => {
            const div = document.createElement('div');
            div.style.cssText = 'padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;';
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="flex:1;">
                        <div style="font-weight:700;font-size:14px;color:var(--text-primary);margin-bottom:4px;">${t.judul}</div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap;">
                            ${t.label ? `<span class="ruang-tugas-label">${t.label}</span>` : ''}
                            <span class="ruang-status-badge ${t.status}">${t.status.charAt(0).toUpperCase()+t.status.slice(1)}</span>
                            ${t.jam ? `<span style="font-size:11px;color:var(--text-muted);">🕐 ${t.jam}</span>` : ''}
                        </div>
                        ${t.deskripsi ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">${t.deskripsi}</div>` : ''}
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px;">
                        <button class="ruang-icon-btn" onclick="document.getElementById('modal-tugas-tanggal').style.display='none';bukaModalTugas('','${t.id}')" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button class="ruang-icon-btn" style="color:#fca5a5;" onclick="hapusTugasDariModal('${t.id}','${dateStr}')" title="Hapus">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>`;
            list.appendChild(div);
        });
    }

    document.getElementById('modal-tugas-tanggal').style.display = 'flex';
}

function hapusTugasDariModal(idTugas, dateStr) {
    if (!confirm('Hapus tugas ini?')) return;
    dataTugas = dataTugas.filter(t => t.id !== idTugas);
    saveTugas();
    renderRuangKalender();
    lihatTugasTanggal(dateStr); // refresh modal
}

// ===== TUGAS CRUD =====
function bukaModalTugas(tanggal, idEdit) {
    document.getElementById('modal-tugas').style.display = 'flex';
    document.getElementById('tugas-edit-id').value = idEdit || '';
    document.getElementById('modal-tugas-title').textContent = idEdit ? 'Edit Tugas' : 'Tambah Tugas';

    if (idEdit) {
        const t = dataTugas.find(t => t.id === idEdit);
        if (t) {
            document.getElementById('tugas-judul').value    = t.judul;
            document.getElementById('tugas-label').value    = t.label || '';
            document.getElementById('tugas-tanggal').value  = t.tanggal || '';
            document.getElementById('tugas-jam').value      = t.jam || '';
            document.getElementById('tugas-deskripsi').value = t.deskripsi || '';
            pilihStatusTugas(null, t.status);
        }
    } else {
        document.getElementById('form-tugas-reset') && document.getElementById('form-tugas-reset').reset();
        document.getElementById('tugas-judul').value    = '';
        document.getElementById('tugas-label').value    = '';
        document.getElementById('tugas-tanggal').value  = tanggal || '';
        document.getElementById('tugas-jam').value      = '';
        document.getElementById('tugas-deskripsi').value = '';
        pilihStatusTugas(null, 'belum');
    }

    // Update datalist label
    const labels = [...new Set(dataTugas.map(t => t.label).filter(Boolean))];
    const dl = document.getElementById('label-suggestions');
    dl.innerHTML = labels.map(l => `<option value="${l}">`).join('');
}

function tutupModalTugas() { document.getElementById('modal-tugas').style.display = 'none'; }

function pilihStatusTugas(el, forcedStatus) {
    const status = forcedStatus || (el && el.dataset.status);
    document.querySelectorAll('.ruang-status-pill').forEach(p => p.classList.remove('active'));
    const target = el || document.querySelector(`.ruang-status-pill[data-status="${status}"]`);
    if (target) target.classList.add('active');
    document.getElementById('tugas-status').value = status;
}

function simpanTugas() {
    const judul = document.getElementById('tugas-judul').value.trim();
    if (!judul) { showNotification('Judul tugas wajib diisi', 'error'); return; }

    const id    = document.getElementById('tugas-edit-id').value;
    const data  = {
        id:       id || 'tugas_' + Date.now(),
        judul,
        label:     document.getElementById('tugas-label').value.trim(),
        tanggal:   document.getElementById('tugas-tanggal').value,
        jam:       document.getElementById('tugas-jam').value,
        status:    document.getElementById('tugas-status').value,
        deskripsi: document.getElementById('tugas-deskripsi').value.trim(),
    };

    if (id) {
        const idx = dataTugas.findIndex(t => t.id === id);
        if (idx !== -1) dataTugas[idx] = data;
    } else {
        dataTugas.push(data);
    }
    saveTugas();
    tutupModalTugas();
    renderRuangKalender();
    showNotification('Tugas disimpan!', 'success');
}

function hapusTugas(id) {
    if (!confirm('Hapus tugas ini?')) return;
    dataTugas = dataTugas.filter(t => t.id !== id);
    saveTugas();
    renderRuangKalender();
}

function renderTugasList() {
    const list = document.getElementById('ruang-tugas-list');
    list.innerHTML = '';

    if (dataTugas.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">Belum ada tugas</div>`;
        return;
    }

    // Belum/proses: urutkan deadline terdekat di atas
    const belumSelesai = [...dataTugas]
        .filter(t => t.status !== 'selesai')
        .sort((a, b) => {
            if (!a.tanggal) return 1;
            if (!b.tanggal) return -1;
            return new Date(a.tanggal + 'T' + (a.jam || '23:59')) - new Date(b.tanggal + 'T' + (b.jam || '23:59'));
        });

    // Selesai: taruh di bawah
    const sudahSelesai = [...dataTugas]
        .filter(t => t.status === 'selesai')
        .sort((a, b) => {
            if (!a.tanggal) return 1;
            if (!b.tanggal) return -1;
            return new Date(b.tanggal + 'T' + (b.jam || '23:59')) - new Date(a.tanggal + 'T' + (a.jam || '23:59'));
        });

    const sorted = [...belumSelesai, ...sudahSelesai];

    sorted.forEach(t => {
        const countdown = getCountdown(t.tanggal, t.jam);
        const card = document.createElement('div');
        card.className = 'ruang-tugas-card';
        card.innerHTML = `
            <div class="ruang-tugas-card-left">
                <div class="ruang-tugas-judul">${t.judul}</div>
                <div class="ruang-tugas-meta">
                    ${t.label ? `<span class="ruang-tugas-label">${t.label}</span>` : ''}
                    <span class="ruang-status-badge ${t.status}">${t.status.charAt(0).toUpperCase()+t.status.slice(1)}</span>
                    ${t.tanggal && t.status !== 'selesai' ? `<span class="ruang-deadline-countdown ${countdown.kelas}">${countdown.teks}</span>` : (!t.tanggal && t.status !== 'selesai' ? '<span style="font-size:11px;color:var(--text-muted);">Tanpa deadline</span>' : '')}
                </div>
                ${t.deskripsi ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">${t.deskripsi}</div>` : ''}
            </div>
            <div class="ruang-tugas-actions">
                <button class="ruang-icon-btn" onclick="bukaModalTugas('','${t.id}')" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button class="ruang-icon-btn" onclick="hapusTugas('${t.id}')" title="Hapus" style="color:#fca5a5;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        list.appendChild(card);
    });
}

function getCountdown(tanggal, jam) {
    if (!tanggal) return { teks: '', kelas: 'ok' };
    const deadline = new Date(tanggal + 'T' + (jam || '23:59'));
    const now = new Date();
    const diff = deadline - now;
    if (diff < 0) return { teks: 'Terlambat!', kelas: 'late' };
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    if (days === 0 && hours === 0) {
        if (mins <= 0) return { teks: 'Sekarang!', kelas: 'late' };
        return { teks: `${mins} menit lagi`, kelas: 'late' };
    }
    if (days === 0) {
        return { teks: mins > 0 ? `${hours}j ${mins}m lagi` : `${hours}j lagi`, kelas: 'soon' };
    }
    if (days <= 3) return { teks: `${days}h lagi`, kelas: 'soon' };
    return { teks: `${days}h lagi`, kelas: 'ok' };
}

// ===== JADWAL KELAS =====
let dataJadwal = JSON.parse(localStorage.getItem('myBudgetly_jadwal')) || [];

const hariOrder = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
const hariColor = {
    'Senin': '#6366f1', 'Selasa': '#10b981', 'Rabu': '#f59e0b',
    'Kamis': '#3b82f6', 'Jumat': '#ec4899', 'Sabtu': '#8b5cf6', 'Minggu': '#ef4444'
};

function saveJadwal() { localStorage.setItem('myBudgetly_jadwal', JSON.stringify(dataJadwal)); }


function bukaModalJadwal(id) {
    const modal = document.getElementById('modal-jadwal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('jadwal-edit-id').value = id || '';
    document.getElementById('modal-jadwal-title').textContent = id ? 'Edit Jadwal' : 'Tambah Jadwal';
    if (id) {
        const j = dataJadwal.find(j => j.id === id);
        if (j) {
            document.getElementById('jadwal-nama').value        = j.nama;
            document.getElementById('jadwal-hari').value        = j.hari;
            document.getElementById('jadwal-jam-mulai').value   = j.jamMulai;
            document.getElementById('jadwal-jam-selesai').value = j.jamSelesai;
            document.getElementById('jadwal-ruang').value       = j.ruang || '';
            document.getElementById('jadwal-dosen').value       = j.dosen || '';
            document.getElementById('jadwal-ket').value         = j.ket || '';
        }
    } else {
        ['jadwal-nama','jadwal-jam-mulai','jadwal-jam-selesai','jadwal-ruang','jadwal-dosen']
            .forEach(elId => { const el = document.getElementById(elId); if(el) el.value = ''; });
        document.getElementById('jadwal-hari').value = 'Senin';
    }
    setTimeout(() => { document.getElementById('jadwal-nama').focus(); }, 100);
}

function tutupModalJadwal() { document.getElementById('modal-jadwal').style.display = 'none'; }

function lihatDetailJadwal(id) {
    const j = dataJadwal.find(j => j.id === id);
    if (!j) return;

    document.getElementById('detail-jadwal-nama').textContent = j.nama;
    document.getElementById('detail-jadwal-jam').textContent  =
        j.jamMulai ? `${j.jamMulai}${j.jamSelesai ? ' – ' + j.jamSelesai : ''}` : 'Jam belum diatur';
    document.getElementById('detail-jadwal-hari').textContent = j.hari;

    const dosenWrap = document.getElementById('detail-jadwal-dosen-wrap');
    const ruangWrap = document.getElementById('detail-jadwal-ruang-wrap');
    if (j.dosen) {
        document.getElementById('detail-jadwal-dosen').textContent = j.dosen;
        dosenWrap.style.display = 'flex';
    } else { dosenWrap.style.display = 'none'; }
    if (j.ruang) {
        document.getElementById('detail-jadwal-ruang').textContent = j.ruang;
        ruangWrap.style.display = 'flex';
    } else { ruangWrap.style.display = 'none'; }

    document.getElementById('modal-detail-jadwal').dataset.currentId = id;
    document.getElementById('modal-detail-jadwal').style.display = 'flex';
}

function hapusJadwalDariDetail() {
    const id = document.getElementById('modal-detail-jadwal').dataset.currentId;
    if (!id) return;
    if (!confirm('Hapus jadwal ini?')) return;
    document.getElementById('modal-detail-jadwal').style.display = 'none';
    dataJadwal = dataJadwal.filter(j => j.id !== id);
    saveJadwal();
    renderJadwal();
}

function editJadwalDariDetail() {
    const id = document.getElementById('modal-detail-jadwal').dataset.currentId;
    document.getElementById('modal-detail-jadwal').style.display = 'none';
    bukaModalJadwal(id);
}

function simpanJadwal() {
    const nama = document.getElementById('jadwal-nama').value.trim();
    if (!nama) { showNotification('Nama mata kuliah/pelajaran wajib diisi', 'error'); return; }

    const id = document.getElementById('jadwal-edit-id').value;
    const data = {
        id:         id || 'jadwal_' + Date.now(),
        nama,
        hari:       document.getElementById('jadwal-hari').value,
        jamMulai:   document.getElementById('jadwal-jam-mulai').value,
        jamSelesai: document.getElementById('jadwal-jam-selesai').value,
        ruang:      document.getElementById('jadwal-ruang').value.trim(),
        dosen:      document.getElementById('jadwal-dosen').value.trim(),
    };

    if (id) {
        const idx = dataJadwal.findIndex(j => j.id === id);
        if (idx !== -1) dataJadwal[idx] = data;
    } else {
        dataJadwal.push(data);
    }
    saveJadwal();
    tutupModalJadwal();
    renderJadwal();
    showNotification('Jadwal disimpan!', 'success');
}

function hapusJadwal(id) {
    if (!confirm('Hapus jadwal ini?')) return;
    dataJadwal = dataJadwal.filter(j => j.id !== id);
    saveJadwal();
    renderJadwal();
}

function parseJamToMenit(jamStr) {
    if (!jamStr) return 0;
    const [h, m] = jamStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

function renderJadwal() {
    const grid = document.getElementById('ruang-jadwal-kelas-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hariTampil = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

    // Range jam dinamis dari data, default 07-17
    let jamMin = 7, jamMax = 17;
    if (dataJadwal.length > 0) {
        dataJadwal.forEach(j => {
            if (j.jamMulai)   jamMin = Math.min(jamMin,   parseInt(j.jamMulai.split(':')[0]));
            if (j.jamSelesai) jamMax = Math.max(jamMax,   parseInt(j.jamSelesai.split(':')[0]));
            else if (j.jamMulai) jamMax = Math.max(jamMax, parseInt(j.jamMulai.split(':')[0]) + 1);
        });
        jamMin = Math.max(0, jamMin);
        jamMax = Math.min(23, jamMax);
    }
    // Pastikan selalu ada minimal 1 jam buffer bawah
    if (jamMax <= jamMin) jamMax = jamMin + 1;

    const totalJam = jamMax - jamMin;
    const slotH = 60; // px per jam

    const palet = [
        { bg: 'rgba(99,102,241,0.12)',  text: '#4338ca', border: '#6366f1' },
        { bg: 'rgba(16,185,129,0.12)',  text: '#065f46', border: '#10b981' },
        { bg: 'rgba(245,158,11,0.12)',  text: '#92400e', border: '#f59e0b' },
        { bg: 'rgba(59,130,246,0.12)',  text: '#1e40af', border: '#3b82f6' },
        { bg: 'rgba(236,72,153,0.12)',  text: '#9d174d', border: '#ec4899' },
        { bg: 'rgba(139,92,246,0.12)',  text: '#5b21b6', border: '#8b5cf6' },
        { bg: 'rgba(239,68,68,0.12)',   text: '#991b1b', border: '#ef4444' },
        { bg: 'rgba(20,184,166,0.12)',  text: '#134e4a', border: '#14b8a6' },
    ];
    const namaList = [...new Set(dataJadwal.map(j => j.nama))];
    const warnaMap = {};
    namaList.forEach((n, i) => { warnaMap[n] = palet[i % palet.length]; });

    // ===== HEADER ROW =====
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;border-bottom:2px solid var(--border);background:var(--card-bg);position:sticky;top:0;z-index:3;';

    // Header "Waktu"
    const hWaktu = document.createElement('div');
    hWaktu.style.cssText = 'width:64px;flex-shrink:0;padding:14px 8px;font-size:12px;font-weight:700;color:var(--text-primary);border-right:1px solid var(--border);text-align:center;';
    hWaktu.textContent = 'Waktu';
    header.appendChild(hWaktu);

    hariTampil.forEach(h => {
        const cell = document.createElement('div');
        cell.style.cssText = 'flex:1;min-width:90px;padding:12px 8px;text-align:center;border-right:1px solid var(--border-light);';
        cell.innerHTML = `<div style="font-size:13px;font-weight:700;color:var(--text-primary);">${h}</div>`;
        header.appendChild(cell);
    });
    grid.appendChild(header);

    // ===== BODY =====
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;';

    // Kolom waktu — label jam di garis, bukan di dalam slot
    const colWaktu = document.createElement('div');
    colWaktu.style.cssText = `width:64px;flex-shrink:0;border-right:1px solid var(--border);position:relative;height:${totalJam * slotH}px;`;
    for (let h = jamMin; h <= jamMax; h++) {
        const lbl = document.createElement('div');
        const topPos = (h - jamMin) * slotH;
        lbl.style.cssText = `position:absolute;top:${topPos}px;left:0;right:0;text-align:center;font-size:11px;font-weight:600;color:var(--text-muted);transform:translateY(-50%);line-height:1;`;
        // Jam pertama jangan translateY agar tidak ketutup header
        if (h === jamMin) lbl.style.transform = 'none';
        lbl.textContent = `${String(h).padStart(2,'0')}:00`;
        colWaktu.appendChild(lbl);
    }
    body.appendChild(colWaktu);

    // Kolom per hari
    hariTampil.forEach(hari => {
        const col = document.createElement('div');
        col.style.cssText = 'flex:1;min-width:90px;border-right:1px solid var(--border-light);position:relative;';

        // Grid lines per jam — di garis, bukan di dalam slot
        const linesWrap = document.createElement('div');
        linesWrap.style.cssText = `height:${totalJam * slotH}px;position:relative;`;
        for (let h = 0; h <= totalJam; h++) {
            const line = document.createElement('div');
            line.style.cssText = `position:absolute;top:${h * slotH}px;left:0;right:0;border-top:1px solid var(--border-light);`;
            linesWrap.appendChild(line);
        }

        // Card kelas
        const kelasHari = dataJadwal.filter(j => j.hari === hari && j.jamMulai);
        kelasHari.forEach(j => {
            const mulai   = parseJamToMenit(j.jamMulai);
            const selesai = j.jamSelesai ? parseJamToMenit(j.jamSelesai) : mulai + 60;
            const durasi  = Math.max(selesai - mulai, 30);
            const topPx   = ((mulai / 60) - jamMin) * slotH;
            const hPx     = (durasi / 60) * slotH;
            const w       = warnaMap[j.nama] || palet[0];

            if (topPx < 0 || topPx >= totalJam * slotH) return;

            const card = document.createElement('div');
            card.style.cssText = `
                position:absolute;
                top:${topPx}px;
                left:4px;right:4px;
                height:${hPx - 2}px;
                background:${w.bg};
                border-radius:8px;
                padding:8px 10px;
                overflow:hidden;
                cursor:pointer;
                z-index:1;
                box-shadow:0 1px 3px rgba(0,0,0,0.06);
            `;
            card.innerHTML = `
                <div style="font-size:10px;font-weight:600;color:${w.text};opacity:0.85;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${j.jamMulai}${j.jamSelesai?' – '+j.jamSelesai:''}</div>
                <div style="font-size:12px;font-weight:700;color:${w.text};margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${j.nama}</div>
                ${j.dosen && hPx > 50 ? `<div style="font-size:10px;color:${w.text};opacity:0.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${j.dosen}</div>` : ''}
                ${j.ruang && hPx > 70 ? `<div style="font-size:10px;color:${w.text};opacity:0.65;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${j.ruang}</div>` : ''}
                <button onclick="event.stopPropagation();hapusJadwal('${j.id}')"
                    style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;color:${w.text};opacity:0;font-size:12px;line-height:1;padding:2px;"
                    class="jk-class-del">✕</button>
            `;
            card.onclick = () => lihatDetailJadwal(j.id);
            card.onmouseenter = () => { const d = card.querySelector('.jk-class-del'); if(d) d.style.opacity='0.7'; };
            card.onmouseleave = () => { const d = card.querySelector('.jk-class-del'); if(d) d.style.opacity='0'; };
            linesWrap.appendChild(card);
        });

        // Double click tambah
        linesWrap.ondblclick = (e) => {
            const rect = linesWrap.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const jamKlik = jamMin + Math.floor(y / slotH);
            bukaModalJadwal();
            setTimeout(() => {
                document.getElementById('jadwal-hari').value = hari;
                document.getElementById('jadwal-jam-mulai').value = `${String(Math.min(jamKlik,23)).padStart(2,'0')}:00`;
            }, 50);
        };

        col.appendChild(linesWrap);
        body.appendChild(col);
    });

    grid.appendChild(body);
}


// ===== TO-DO =====
let todoFilter = 'semua';
function tambahTodo() {
    const input = document.getElementById('todo-input');
    const teks = input.value.trim();
    if (!teks) return;
    dataTodo.push({ id: 'todo_' + Date.now(), teks, selesai: false });
    saveTodo();
    input.value = '';
    renderTodo();
}
function toggleTodo(id) {
    const t = dataTodo.find(t => t.id === id);
    if (t) { t.selesai = !t.selesai; saveTodo(); renderTodo(); }
}
function hapusTodo(id) {
    dataTodo = dataTodo.filter(t => t.id !== id);
    saveTodo();
    renderTodo();
}
function filterTodo(f, el) {
    todoFilter = f;
    document.querySelectorAll('.todo-filter-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    renderTodo();
}
function renderTodo() {
    const list = document.getElementById('ruang-todo-list');
    list.innerHTML = '';
    let filtered = dataTodo;
    if (todoFilter === 'belum')   filtered = dataTodo.filter(t => !t.selesai);
    if (todoFilter === 'selesai') filtered = dataTodo.filter(t => t.selesai);
    if (filtered.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">Tidak ada item</div>`;
        return;
    }
    filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = 'ruang-todo-item';
        item.innerHTML = `
            <input type="checkbox" ${t.selesai ? 'checked' : ''} onchange="toggleTodo('${t.id}')">
            <span class="ruang-todo-text ${t.selesai ? 'done' : ''}">${t.teks}</span>
            <button class="ruang-icon-btn" onclick="hapusTodo('${t.id}')" style="color:#fca5a5;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>`;
        list.appendChild(item);
    });
}

// ===== CATATAN RUANG =====
function bukaModalCatatan(id) {
    document.getElementById('modal-catatan-ruang').style.display = 'flex';
    document.getElementById('catatan-edit-id').value = id || '';
    
    const judulEl = document.getElementById('catatan-judul');
    const isiEl = document.getElementById('catatan-isi');
    
    if (id) {
        const c = dataCatatanRuang.find(c => c.id === id);
        if (c) { 
          judulEl.value = c.judul; 
          isiEl.value = c.isi;
        }
    } else {
        judulEl.value = '';
        isiEl.value = '';
    }
    
    // Auto-resize dan update counter
    setTimeout(() => {
      autoResizeTitle(judulEl);
      updateCharCount();
      judulEl.focus();
    }, 100);
}
function tutupModalCatatan() { 
  document.getElementById('modal-catatan-ruang').style.display = 'none';
  // Reset textarea height
  document.getElementById('catatan-judul').style.height = 'auto';
  document.getElementById('catatan-isi').style.height = 'auto';
}

// Auto-resize textarea untuk judul
function autoResizeTitle(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// Auto-resize textarea untuk isi
function autoResizeBody(textarea) {
  // body tidak perlu resize, flex:1 sudah menangani
}

// Fungsi untuk melihat detail catatan (read-only)
function lihatDetailCatatan(id) {
    const catatan = dataCatatanRuang.find(c => c.id === id);
    if (!catatan) return;
    
    // Format waktu
    const waktu = new Date(catatan.waktu);
    const sekarang = new Date();
    let waktuText = '';
    
    // Cek apakah hari ini
    if (waktu.toDateString() === sekarang.toDateString()) {
        waktuText = waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } 
    // Cek apakah kemarin
    else if (new Date(sekarang - 86400000).toDateString() === waktu.toDateString()) {
        waktuText = 'Kemarin ' + waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    // Cek apakah tahun ini
    else if (waktu.getFullYear() === sekarang.getFullYear()) {
        waktuText = waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) + ' ' + 
                    waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    // Tahun berbeda
    else {
        waktuText = waktu.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + 
                    waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    
    document.getElementById('detail-catatan-waktu').textContent = 'Diedit ' + waktuText;
    document.getElementById('detail-catatan-judul').textContent = catatan.judul || 'Tanpa Judul';
    document.getElementById('detail-catatan-isi').textContent = catatan.isi || '(kosong)';
    document.getElementById('modal-detail-catatan').setAttribute('data-catatan-id', id);
    document.getElementById('modal-detail-catatan').style.display = 'flex';
}

function tutupModalDetailCatatan() {
    document.getElementById('modal-detail-catatan').style.display = 'none';
}

function editDariDetail() {
    const id = document.getElementById('modal-detail-catatan').getAttribute('data-catatan-id');
    tutupModalDetailCatatan();
    bukaModalCatatan(id);
}
function simpanCatatanRuang() {
    const judul = document.getElementById('catatan-judul').value.trim();
    const isi   = document.getElementById('catatan-isi').value.trim();
    
    // Jika keduanya kosong, tidak simpan
    if (!judul && !isi) { 
      tutupModalCatatan(); 
      return; 
    }
    
    const id  = document.getElementById('catatan-edit-id').value;
    
    // Jika judul kosong tapi isi ada, ambil baris pertama isi sebagai judul
    let finalJudul = judul;
    let finalIsi = isi;
    
    if (!judul && isi) {
      const lines = isi.split('\n');
      finalJudul = lines[0].substring(0, 50) || 'Tanpa Judul'; // Max 50 karakter untuk judul
      finalIsi = lines.slice(1).join('\n').trim() || isi; // Sisanya jadi isi
    }
    
    const data = { 
      id: id || 'cat_' + Date.now(), 
      judul: finalJudul || 'Tanpa Judul', 
      isi: finalIsi, 
      waktu: new Date().toISOString() // Selalu update waktu
    };
    
    if (id) {
        const idx = dataCatatanRuang.findIndex(c => c.id === id);
        if (idx !== -1) dataCatatanRuang[idx] = data;
    } else {
        dataCatatanRuang.unshift(data);
    }
    
    saveCatatanRuang();
    tutupModalCatatan();
    renderCatatanRuang();
    showNotification('Catatan disimpan!', 'success');
}
function hapusCatatanRuang(id) {
    if (!confirm('Hapus catatan ini?')) return;
    dataCatatanRuang = dataCatatanRuang.filter(c => c.id !== id);
    saveCatatanRuang();
    renderCatatanRuang();
}
function renderCatatanRuang() {
    const grid = document.getElementById('ruang-catatan-grid');
    grid.innerHTML = '';
    if (dataCatatanRuang.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);font-size:14px;">Belum ada catatan</div>`;
        return;
    }
    dataCatatanRuang.forEach(c => {
        const card = document.createElement('div');
        card.className = 'ruang-catatan-card';
        card.style.cursor = 'pointer';
        card.onclick = () => lihatDetailCatatan(c.id);
        card.innerHTML = `
            <div class="ruang-catatan-card-judul">${c.judul}</div>
            <div class="ruang-catatan-card-isi">${c.isi}</div>
            <div class="ruang-catatan-card-footer">
                <button class="ruang-icon-btn" onclick="event.stopPropagation();bukaModalCatatan('${c.id}')" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button class="ruang-icon-btn" onclick="event.stopPropagation();hapusCatatanRuang('${c.id}')" title="Hapus" style="color:#fca5a5;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

// ===== JADWAL RUTIN =====
let dataRutin = JSON.parse(localStorage.getItem('myBudgetly_rutin')) || [];
function saveRutin() { localStorage.setItem('myBudgetly_rutin', JSON.stringify(dataRutin)); }

let rutinCalDate = new Date();

function rutinPrevMonth() { rutinCalDate.setMonth(rutinCalDate.getMonth() - 1); renderRutinKalender(); }
function rutinNextMonth() { rutinCalDate.setMonth(rutinCalDate.getMonth() + 1); renderRutinKalender(); }

// Cek apakah item rutin muncul di tanggal tertentu
function rutinMunculDiTanggal(r, dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const tipe = r.pengulangan || 'none';

    if (tipe === 'none') {
        return r.tanggal === dateStr;
    }

    // Cek range tanggal
    if (r.tanggal && date < new Date(r.tanggal + 'T00:00:00')) return false;
    if (r.tanggalSelesai && date > new Date(r.tanggalSelesai + 'T00:00:00')) return false;

    if (tipe === 'daily') return true;
    if (tipe === 'weekly') {
        const hariDipilih = r.hariHari || [];
        return hariDipilih.includes(date.getDay());
    }
    if (tipe === 'monthly') {
        return date.getDate() === (r.tanggalBulan || new Date(r.tanggal + 'T00:00:00').getDate());
    }
    return false;
}

// Ambil semua item rutin yang muncul di tanggal tertentu
function getRutinUntukTanggal(dateStr) {
    return dataRutin.filter(r => rutinMunculDiTanggal(r, dateStr));
}

// Cek status centang per hari
function getRutinStatus(rutinId, dateStr) {
    const key = `rutin_status_${rutinId}_${dateStr}`;
    return localStorage.getItem(key) === 'selesai';
}

function setRutinStatus(rutinId, dateStr, selesai) {
    const key = `rutin_status_${rutinId}_${dateStr}`;
    if (selesai) localStorage.setItem(key, 'selesai');
    else localStorage.removeItem(key);
}

function toggleRutinStatus(rutinId, dateStr) {
    const current = getRutinStatus(rutinId, dateStr);
    setRutinStatus(rutinId, dateStr, !current);
    renderRutinDayView(dateStr);
    renderRutinKalender();
}

// Toggle UI pengulangan di form
function toggleRutinPengulanganUI() {
    const tipe = document.getElementById('rutin-pengulangan').value;
    const isRepeat = tipe !== 'none';

    document.getElementById('rutin-tanggal-selesai-wrap').style.display = isRepeat ? 'block' : 'none';
    document.getElementById('rutin-hari-wrap').style.display = tipe === 'weekly' ? 'block' : 'none';

    const label = document.getElementById('rutin-tanggal-label');
    if (label) label.innerHTML = isRepeat
        ? 'Mulai Tanggal <span style="color:#ef4444">*</span>'
        : 'Tanggal <span style="color:#ef4444">*</span>';
}

function renderRutinKalender() {
    const year  = rutinCalDate.getFullYear();
    const month = rutinCalDate.getMonth();
    const titleEl = document.getElementById('rutin-cal-title');
    if (titleEl) titleEl.textContent = new Date(year, month, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('rutin-cal-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const today       = new Date();

    for (let i = 0; i < firstDay; i++) {
        const d = daysInPrev - firstDay + 1 + i;
        grid.appendChild(buildRutinCell(d, year, month - 1, true));
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        grid.appendChild(buildRutinCell(d, year, month, false, isToday));
    }
    const totalCells = firstDay + daysInMonth;
    const remaining  = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
        grid.appendChild(buildRutinCell(d, year, month + 1, true));
    }

    renderRutinList();
    if (window.lucide) lucide.createIcons();
}

function buildRutinCell(d, year, month, otherMonth, isToday) {
    const cell = document.createElement('div');
    cell.className = 'ruang-cal-cell' + (otherMonth ? ' other-month' : '') + (isToday ? ' today' : '');
    const dateEl = document.createElement('div');
    dateEl.className = 'ruang-cal-date';
    dateEl.textContent = d;
    cell.appendChild(dateEl);

    if (!otherMonth) {
        const realDate = new Date(year, month, d);
        const dateStr = `${realDate.getFullYear()}-${String(realDate.getMonth()+1).padStart(2,'0')}-${String(realDate.getDate()).padStart(2,'0')}`;
        const items = getRutinUntukTanggal(dateStr);

        items.slice(0, 2).forEach(r => {
            const selesai = getRutinStatus(r.id, dateStr);
            const ev = document.createElement('div');
            ev.className = 'ruang-cal-event rutin' + (selesai ? ' selesai' : '');
            ev.textContent = (r.jamMulai ? r.jamMulai + ' ' : '') + r.nama;
            cell.appendChild(ev);
        });
        if (items.length > 2) {
            const sisanya = items.slice(2);
            const sisaBelum = sisanya.filter(r => !getRutinStatus(r.id, dateStr)).length;
            const more = document.createElement('div');
            more.className = `ruang-cal-event rutin${sisaBelum === 0 ? ' selesai' : ''}`;
            more.textContent = `+${sisaBelum === 0 ? sisanya.length : sisaBelum} lagi`;
            cell.appendChild(more);
        }
        cell.onclick = () => bukaRutinDayView(dateStr);
    }
    return cell;
}

function bukaRutinDayView(dateStr) {
    window._rutinSelectedDate = dateStr;
    // Sembunyikan kalender, tampilkan day view
    document.querySelector('#sub-jadwal-rutin .ruang-calendar').style.display = 'none';
    document.querySelector('#sub-jadwal-rutin .ruang-tugas-header').style.display = 'none';
    document.getElementById('rutin-day-view').style.display = 'block';

    const date = new Date(dateStr + 'T00:00:00');
    const label = date.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    document.getElementById('rutin-day-title').textContent = label;

    renderRutinDayView(dateStr);
    if (window.lucide) lucide.createIcons();
}

function tutupRutinDayView() {
    document.querySelector('#sub-jadwal-rutin .ruang-calendar').style.display = 'block';
    document.querySelector('#sub-jadwal-rutin .ruang-tugas-header').style.display = 'flex';
    document.getElementById('rutin-day-view').style.display = 'none';
    window._rutinSelectedDate = null;
}

function renderRutinDayView(dateStr) {
    const grid = document.getElementById('rutin-day-grid');
    grid.innerHTML = '';

    const allItems = getRutinUntukTanggal(dateStr);
    const items = allItems.filter(r => r.jamMulai);
    const itemsTanpaJam = allItems.filter(r => !r.jamMulai);

    if (items.length === 0 && itemsTanpaJam.length === 0) {
        grid.style.display = 'block';
        grid.style.fontStyle = 'normal';
        grid.innerHTML = `<div class="rutin-day-empty">Tidak ada kegiatan di hari ini.<br><span style="color:var(--primary-accent-color);cursor:pointer;font-style:normal;" onclick="bukaModalRutin('${dateStr}')">+ Tambah kegiatan</span></div>`;
        return;
    }

    // Hitung range jam
    let jamMin = 6, jamMax = 20;
    items.forEach(r => {
        const h = parseInt(r.jamMulai.split(':')[0]);
        jamMin = Math.min(jamMin, h);
        const hEnd = r.jamSelesai ? parseInt(r.jamSelesai.split(':')[0]) + 1 : h + 2;
        jamMax = Math.max(jamMax, hEnd);
    });
    jamMin = Math.max(0, jamMin - 1);
    jamMax = Math.min(23, jamMax);
    const totalJam = jamMax - jamMin;
    const slotH = 64; // px per jam

    const palet = [
        { bg: 'rgba(99,102,241,0.13)',  text: '#4338ca', border: '#6366f1' },
        { bg: 'rgba(16,185,129,0.13)',  text: '#065f46', border: '#10b981' },
        { bg: 'rgba(245,158,11,0.13)',  text: '#92400e', border: '#f59e0b' },
        { bg: 'rgba(59,130,246,0.13)',  text: '#1e40af', border: '#3b82f6' },
        { bg: 'rgba(236,72,153,0.13)',  text: '#9d174d', border: '#ec4899' },
        { bg: 'rgba(139,92,246,0.13)',  text: '#5b21b6', border: '#8b5cf6' },
    ];
    const namaList = [...new Set(dataRutin.map(r => r.nama))];
    const warnaMap = {};
    namaList.forEach((n, i) => warnaMap[n] = palet[i % palet.length]);

    // Kolom waktu
    const timeCol = document.createElement('div');
    timeCol.className = 'rutin-day-time-col';
    timeCol.style.height = `${totalJam * slotH}px`;

    for (let h = jamMin; h <= jamMax; h++) {
        const lbl = document.createElement('div');
        lbl.className = 'rutin-day-time-label';
        lbl.style.top = `${(h - jamMin) * slotH}px`;
        if (h === jamMin) lbl.style.transform = 'none';
        lbl.textContent = `${String(h).padStart(2,'0')}:00`;
        timeCol.appendChild(lbl);
    }
    grid.appendChild(timeCol);

    // Kolom events
    const evCol = document.createElement('div');
    evCol.className = 'rutin-day-events-col';
    evCol.style.height = `${totalJam * slotH}px`;

    // Grid lines
    for (let h = 0; h <= totalJam; h++) {
        const line = document.createElement('div');
        line.className = 'rutin-day-line';
        line.style.top = `${h * slotH}px`;
        evCol.appendChild(line);
    }

    // Cards
    items.sort((a,b) => a.jamMulai.localeCompare(b.jamMulai)).forEach(r => {
        const mulai   = parseJamToMenit(r.jamMulai);
        const selesai = r.jamSelesai ? parseJamToMenit(r.jamSelesai) : mulai + 60;
        const durasi  = Math.max(selesai - mulai, 45);
        const topPx   = ((mulai / 60) - jamMin) * slotH;
        const hPx     = (durasi / 60) * slotH - 4;
        const sudahSelesai = getRutinStatus(r.id, dateStr);
        const w       = sudahSelesai
            ? { bg: 'rgba(16,185,129,0.13)', text: '#065f46', border: '#10b981' }
            : (warnaMap[r.nama] || palet[0]);

        const card = document.createElement('div');
        card.className = 'rutin-day-card';
        card.style.cssText = `top:${topPx}px;height:${hPx}px;background:${w.bg};border-left:4px solid ${w.border};${sudahSelesai ? 'opacity:0.75;' : ''}`;
        card.innerHTML = `
            <div style="font-size:11px;font-weight:600;color:${w.text};opacity:0.85;margin-bottom:3px;">
                ${r.jamMulai}${r.jamSelesai ? ' – ' + r.jamSelesai : ''}
            </div>
            <div style="font-size:14px;font-weight:700;color:${w.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${sudahSelesai ? 'text-decoration:line-through;' : ''}">${r.nama}</div>
            <div style="position:absolute;top:6px;right:8px;display:flex;gap:4px;align-items:center;">
                <button onclick="event.stopPropagation();toggleRutinStatus('${r.id}','${dateStr}')"
                    style="background:${sudahSelesai ? '#10b981' : 'rgba(0,0,0,0.06)'};border:none;cursor:pointer;color:${sudahSelesai ? '#fff' : 'var(--text-muted)'};padding:3px 6px;border-radius:6px;font-size:11px;font-weight:600;" title="${sudahSelesai ? 'Tandai belum' : 'Tandai selesai'}">
                    ${sudahSelesai ? '✓ Selesai' : '○ Belum'}
                </button>
                <button onclick="event.stopPropagation();bukaModalRutin('','${r.id}')" 
                    style="background:none;border:none;cursor:pointer;color:${w.text};opacity:0.6;padding:2px;" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button onclick="event.stopPropagation();hapusRutinDayView('${r.id}','${dateStr}')"
                    style="background:none;border:none;cursor:pointer;color:#ef4444;opacity:0.6;padding:2px;" title="Hapus">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        evCol.appendChild(card);
    });

    grid.appendChild(evCol);

    // Item tanpa jam di bawah (all-day)
    if (itemsTanpaJam.length > 0) {
        const allDay = document.createElement('div');
        allDay.style.cssText = 'padding:10px 12px;border-top:1px solid var(--border-light);';
        allDay.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Sepanjang Hari</div>`;
        itemsTanpaJam.forEach(r => {
            const sudahSelesai = getRutinStatus(r.id, dateStr);
            const item = document.createElement('div');
            item.style.cssText = `display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:${sudahSelesai ? 'rgba(16,185,129,0.1)' : 'var(--background-secondary)'};border-radius:8px;margin-bottom:4px;${sudahSelesai ? 'opacity:0.75;' : ''}`;
            item.innerHTML = `
                <span style="font-size:13px;font-weight:600;color:var(--text-primary);${sudahSelesai ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${r.nama}</span>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button onclick="toggleRutinStatus('${r.id}','${dateStr}')"
                        style="background:${sudahSelesai ? '#10b981' : 'rgba(0,0,0,0.06)'};border:none;cursor:pointer;color:${sudahSelesai ? '#fff' : 'var(--text-muted)'};padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;">
                        ${sudahSelesai ? '✓ Selesai' : '○ Belum'}
                    </button>
                    <button onclick="bukaModalRutin('','${r.id}')" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:2px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                    </button>
                    <button onclick="hapusRutinDayView('${r.id}','${dateStr}')" style="background:none;border:none;cursor:pointer;color:#ef4444;padding:2px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>`;
            allDay.appendChild(item);
        });
        grid.insertBefore(allDay, grid.firstChild);
    }
}

function hapusRutinDayView(id, dateStr) {
    if (!confirm('Hapus kegiatan ini?')) return;
    dataRutin = dataRutin.filter(r => r.id !== id);
    saveRutin();
    renderRutinKalender();
    renderRutinDayView(dateStr);
}

function renderRutinList() {
    const list = document.getElementById('rutin-jadwal-list');
    if (!list) return;
    list.innerHTML = '';
    const sorted = [...dataRutin].sort((a, b) => {
        if (!a.tanggal) return 1;
        if (!b.tanggal) return -1;
        return new Date(a.tanggal + 'T' + (a.jamMulai||'23:59')) - new Date(b.tanggal + 'T' + (b.jamMulai||'23:59'));
    });
    if (sorted.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:14px;">Belum ada jadwal rutin</div>`;
        return;
    }
    sorted.forEach(r => {
        const card = document.createElement('div');
        card.className = 'ruang-tugas-card';
        const tgl = r.tanggal ? new Date(r.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : '';
        card.innerHTML = `
            <div class="ruang-tugas-card-left">
                <div class="ruang-tugas-judul">${r.nama}</div>
                <div class="ruang-tugas-meta">
                    ${tgl ? `<span style="font-size:11px;color:var(--text-muted);">📅 ${tgl}</span>` : ''}
                    ${r.jamMulai ? `<span style="font-size:11px;color:var(--text-muted);">🕐 ${r.jamMulai}${r.jamSelesai ? ' – '+r.jamSelesai : ''}</span>` : ''}
                </div>
            </div>
            <div class="ruang-tugas-actions">
                <button class="ruang-icon-btn" onclick="bukaModalRutin('','${r.id}')" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button class="ruang-icon-btn" onclick="hapusRutin('${r.id}')" title="Hapus" style="color:#fca5a5;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>`;
        list.appendChild(card);
    });
}

function bukaModalRutin(tanggal, idEdit) {
    document.getElementById('modal-rutin').style.display = 'flex';
    document.getElementById('rutin-edit-id').value = idEdit || '';
    document.getElementById('modal-rutin-title').textContent = idEdit ? 'Edit Jadwal Rutin' : 'Tambah Jadwal Rutin';

    // Reset hari pills
    document.querySelectorAll('.rutin-hari-pill').forEach(p => p.classList.remove('active'));

    if (idEdit) {
        const r = dataRutin.find(r => r.id === idEdit);
        if (r) {
            document.getElementById('rutin-nama').value          = r.nama;
            document.getElementById('rutin-tanggal').value       = r.tanggal || '';
            document.getElementById('rutin-jam-mulai').value     = r.jamMulai || '';
            document.getElementById('rutin-jam-selesai').value   = r.jamSelesai || '';
            document.getElementById('rutin-pengulangan').value   = r.pengulangan || 'none';
            document.getElementById('rutin-tanggal-selesai').value = r.tanggalSelesai || '';
            document.getElementById('rutin-tanggal-bulan').value = r.tanggalBulan || '';
            // Restore hari pills
            (r.hariHari || []).forEach(h => {
                const pill = document.querySelector(`.rutin-hari-pill[data-hari="${h}"]`);
                if (pill) pill.classList.add('active');
            });
        }
    } else {
        document.getElementById('rutin-nama').value          = '';
        document.getElementById('rutin-tanggal').value       = tanggal || '';
        document.getElementById('rutin-jam-mulai').value     = '';
        document.getElementById('rutin-jam-selesai').value   = '';
        document.getElementById('rutin-pengulangan').value   = 'none';
        document.getElementById('rutin-tanggal-selesai').value = '';
        document.getElementById('rutin-tanggal-bulan').value = '';
    }

    toggleRutinPengulanganUI();

    // Event listener hari pills
    document.querySelectorAll('.rutin-hari-pill').forEach(p => {
        p.onclick = () => p.classList.toggle('active');
    });

    setTimeout(() => document.getElementById('rutin-nama').focus(), 100);
}

function tutupModalRutin() { document.getElementById('modal-rutin').style.display = 'none'; }

function simpanRutin() {
    const nama = document.getElementById('rutin-nama').value.trim();
    if (!nama) { showNotification('Nama kegiatan wajib diisi', 'error'); return; }
    const tanggal = document.getElementById('rutin-tanggal').value;
    if (!tanggal) { showNotification('Tanggal wajib diisi', 'error'); return; }

    const pengulangan = document.getElementById('rutin-pengulangan').value;

    // Validasi weekly: harus pilih minimal 1 hari
    let hariHari = [];
    if (pengulangan === 'weekly') {
        document.querySelectorAll('.rutin-hari-pill.active').forEach(p => {
            hariHari.push(parseInt(p.dataset.hari));
        });
        if (hariHari.length === 0) {
            showNotification('Pilih minimal satu hari untuk pengulangan mingguan', 'error');
            return;
        }
    }

    const id = document.getElementById('rutin-edit-id').value;
    const data = {
        id:             id || 'rutin_' + Date.now(),
        nama,
        tanggal,
        jamMulai:       document.getElementById('rutin-jam-mulai').value,
        jamSelesai:     document.getElementById('rutin-jam-selesai').value,
        pengulangan,
        tanggalSelesai: document.getElementById('rutin-tanggal-selesai').value,
        hariHari,
        tanggalBulan:   pengulangan === 'monthly'
            ? parseInt(document.getElementById('rutin-tanggal-bulan').value) || new Date(tanggal + 'T00:00:00').getDate()
            : null,
    };
    if (id) {
        const idx = dataRutin.findIndex(r => r.id === id);
        if (idx !== -1) dataRutin[idx] = data;
    } else {
        dataRutin.push(data);
    }
    saveRutin();
    tutupModalRutin();
    // Arahkan kalender ke bulan tanggal yang disimpan
    rutinCalDate = new Date(tanggal + 'T00:00:00');
    renderRutinKalender();
    // Kalau day view sedang terbuka untuk tanggal yang sama, refresh
    if (window._rutinSelectedDate === tanggal) {
        renderRutinDayView(tanggal);
    }
    showNotification('Jadwal disimpan!', 'success');
}

function hapusRutin(id) {
    if (!confirm('Hapus jadwal ini?')) return;
    dataRutin = dataRutin.filter(r => r.id !== id);
    saveRutin();
    renderRutinKalender();
}

// stub fungsi lama agar tidak error
function getMondayOfWeek(d) { return d; }
function rutinPrevWeek() { rutinPrevMonth(); }
function rutinNextWeek() { rutinNextMonth(); }

function switchTab(pageId, element) {
  // Simpan halaman aktif ke localStorage
  localStorage.setItem('activePageId', pageId);

  // 1. Sembunyikan SEMUA halaman utama (.app-page)
  document.querySelectorAll('.app-page').forEach(page => {
    page.style.display = 'none';
    page.classList.remove('active');
  });

  // 2. Ambil elemen-elemen spesifik beranda
  const summaryGrid = document.querySelector('.summary-grid');
  const berandaLainnya = document.querySelectorAll('.form-container, .transactions-section');
  const appHeader = document.querySelector('.app-header');

  // 3. LOGIKA SAKTI: Jika ke Beranda, tampilkan. Jika ke Porto/Lainnya, SEMBUNYIKAN TOTAL.
  if (pageId === 'home') {
    if (summaryGrid) summaryGrid.style.setProperty('display', 'grid', 'important');
    berandaLainnya.forEach(el => el.style.display = 'block');
    if (appHeader) appHeader.style.display = 'flex';
  } else {
    // Sembunyikan elemen beranda agar tidak "tembus"
    if (summaryGrid) summaryGrid.style.display = 'none';
    berandaLainnya.forEach(el => el.style.display = 'none');
    if (appHeader) appHeader.style.display = 'none';
  }

  // 4. Tampilkan halaman tujuan
  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.style.display = 'block';
    // Gunakan class active untuk memicu CSS display block tadi
    setTimeout(() => targetPage.classList.add('active'), 10);
  }

  // 5. Update tombol navigasi bawah
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');

  // Khusus Porto, jalankan render data
  if (pageId === 'portofolio') {
      renderHalamanPorto();
  }

  // Khusus Ruang, render kalender
  if (pageId === 'ruang') {
      renderJadwal();
      if (window.lucide) lucide.createIcons();
  }

  // Khusus Saya, muat data profil
  if (pageId === 'saya') {
      loadProfilPage();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.lucide) lucide.createIcons();
}

// --- LOGIKA PORTOFOLIO ---
function tutupModalAset() { document.getElementById('modal-tambah-aset').style.display = 'none'; }
function tutupModalTransaksiAset() { document.getElementById('modal-transaksi-aset').style.display = 'none'; }

// 1. Simpan Wadah Aset (Tanpa Harga)
function handleSimpanAset(event) {
    event.preventDefault();
    const kategori = document.getElementById('input-kategori').value;
    const nama = document.getElementById('input-nama').value;
    const catatan = document.getElementById('input-catatan').value;
    const jenisRD = document.getElementById('input-jenis-rd').value;
    const jenisEW = document.getElementById('input-jenis-ewallet').value;

    if (!nama) return;

    // Validasi jenis reksadana wajib dipilih
    if (kategori === 'Reksadana' && !jenisRD) {
        showNotification('Pilih jenis reksadana terlebih dahulu', 'error');
        return;
    }

    // Validasi jenis ewallet wajib dipilih
    if (kategori === 'EWallet' && !jenisEW) {
        showNotification('Pilih jenis E-Wallet/Bank terlebih dahulu', 'error');
        return;
    }

    dataAset.push({
        id: 'aset_' + Date.now(),
        nama: nama,
        kategori: kategori,
        jenis_rd: kategori === 'Reksadana' ? jenisRD : '',
        jenis_ew: kategori === 'EWallet' ? jenisEW : '',
        catatan: catatan,
        transaksi: []
    });

    localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
    renderHalamanPorto();
    tutupModalAset();
    showNotification('Aset berhasil ditambahkan!', 'success');
}

// 2. Render Card Aset & Kalkulasi dari Transaksi
function renderHalamanPorto() {
    const container = document.getElementById('list-aset-container');
    const totalDisplay = document.getElementById('total-aset-display');
    const countDisplay = document.getElementById('jumlah-aset-display');
    
    if (!container) return;
    
    container.innerHTML = '';
    let totalPortfolioValue = 0;

    dataAset.forEach((aset) => {
        const config = getAsetConfig(aset.kategori);
        const isSaham = (aset.kategori || '').toLowerCase() === 'saham';
        let totalSatuan = 0;
        let totalNilai = 0;

        if (aset.transaksi) {
            aset.transaksi.forEach(trx => {
                const jumlah = parseFloat(trx.lembar) || 0;
                const harga  = parseFloat(trx.harga)  || 0;
                if (trx.jenis === 'beli') {
                    totalSatuan += jumlah;
                    // Saham: nilai = harga per lembar × lembar
                    // Lainnya: harga sudah = total bayar
                    totalNilai += isSaham ? (harga * jumlah) : harga;
                } else {
                    const avgNilaiPerSatuan = totalSatuan > 0 ? totalNilai / totalSatuan : 0;
                    totalSatuan -= jumlah;
                    totalNilai  -= avgNilaiPerSatuan * jumlah;
                }
            });
        }

        // Pastikan tidak negatif akibat floating point
        if (totalSatuan < 0) totalSatuan = 0;
        if (totalNilai  < 0) totalNilai  = 0;

        totalPortfolioValue += totalNilai;

        // Render Card sesuai gambar
        container.innerHTML += `
            <div class="asset-card-design">
                <div class="acd-header">
                    <div>
                        <div class="acd-name">${aset.nama}</div>
                        <div class="acd-category">${aset.kategori === 'EWallet' ? (aset.jenis_ew || 'E-Wallet/Bank') : aset.kategori}${aset.jenis_rd ? ' ' + aset.jenis_rd : ''}</div>
                    </div>
                </div>
                <div class="acd-body">
                    <div style="font-size:12px; color:var(--text-secondary); font-weight:500;">Nilai Aset</div>
                    <div class="acd-value">${formatCurrency(totalNilai)}</div>
                    ${(aset.kategori || '').toLowerCase() !== 'ewallet' ? `<div class="acd-lembar">${formatSatuan(totalSatuan, aset.kategori)}</div>` : ''}
                    ${aset.catatan ? `<div class="acd-catatan" id="catatan-${aset.id}">
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNxdWFyZS1wZW4taWNvbiBsdWNpZGUtc3F1YXJlLXBlbiI+PHBhdGggZD0iTTEyIDNINWEyIDIgMCAwIDAtMiAydjE0YTIgMiAwIDAgMCAyIDJoMTRhMiAyIDAgMCAwIDItMnYtNyIvPjxwYXRoIGQ9Ik0xOC4zNzUgMi42MjVhMSAxIDAgMCAxIDMgM2wtOS4wMTMgOS4wMTRhMiAyIDAgMCAxLS44NTMuNTA1bC0yLjg3My44NGEuNS41IDAgMCAxLS42Mi0uNjJsLjg0LTIuODczYTIgMiAwIDAgMSAuNTA2LS44NTJ6Ii8+PC9zdmc+" 
                             class="acd-catatan-edit-icon" 
                             onclick="editCatatanInline('${aset.id}')" 
                             title="Edit catatan"
                             style="width:11px;height:11px;cursor:pointer;opacity:0.5;vertical-align:middle;margin-right:3px;">
                        <span id="catatan-text-${aset.id}">${aset.catatan}</span>
                    </div>` : `<div class="acd-catatan acd-catatan-empty" id="catatan-${aset.id}" onclick="editCatatanInline('${aset.id}')" style="cursor:pointer;">
                        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJsdWNpZGUgbHVjaWRlLXNxdWFyZS1wZW4taWNvbiBsdWNpZGUtc3F1YXJlLXBlbiI+PHBhdGggZD0iTTEyIDNINWEyIDIgMCAwIDAtMiAydjE0YTIgMiAwIDAgMCAyIDJoMTRhMiAyIDAgMCAwIDItMnYtNyIvPjxwYXRoIGQ9Ik0xOC4zNzUgMi42MjVhMSAxIDAgMCAxIDMgM2wtOS4wMTMgOS4wMTRhMiAyIDAgMCAxLS44NTMuNTA1bC0yLjg3My44NGEuNS41IDAgMCAxLS42Mi0uNjJsLjg0LTIuODczYTIgMiAwIDAgMSAuNTA2LS44NTJ6Ii8+PC9zdmc+" 
                             style="width:11px;height:11px;opacity:0.35;vertical-align:middle;margin-right:3px;">
                        <span style="opacity:0.4;">Tambah catatan</span>
                    </div>`}
                </div>
                <div class="acd-footer">
                    <button class="acd-action-btn" title="Tambah Transaksi" onclick="bukaModalTransaksiAset('${aset.id}')"><i data-lucide="plus"></i></button>
                    <button class="acd-action-btn" title="Riwayat" onclick="lihatRiwayat('${aset.id}')"><i data-lucide="history"></i></button>
                    <button class="acd-action-btn delete" title="Hapus Aset" onclick="hapusAset('${aset.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `;
    });

    totalDisplay.innerText = formatCurrency(totalPortfolioValue);
    countDisplay.innerText = dataAset.length;
    if(window.lucide) lucide.createIcons();
}

// Helper: konfigurasi satuan & presisi per kategori
function getAsetConfig(kategori) {
    switch ((kategori || '').toLowerCase()) {
        case 'emas':
            return { satuan: 'gram', stepSatuan: '0.0001', presisi: 4, stepHarga: '1', labelHarga: 'Nominal (Rp)', labelSatuan: 'Jumlah Gram' };
        case 'kripto':
            return { satuan: 'BTC', stepSatuan: '0.00000001', presisi: 8, stepHarga: '1', labelHarga: 'Nominal (Rp)', labelSatuan: 'Jumlah' };
        case 'reksadana':
            return { satuan: 'unit', stepSatuan: '0.0001', presisi: 4, stepHarga: '1', labelHarga: 'Nominal (Rp)', labelSatuan: 'Jumlah Unit' };
        case 'ewallet':
            return { satuan: 'saldo', stepSatuan: '1', presisi: 0, stepHarga: '1', labelHarga: 'Nominal (Rp)', labelSatuan: 'Jumlah Saldo' };
        default: // Saham
            return { satuan: 'Lembar', stepSatuan: '1', presisi: 0, stepHarga: '1', labelHarga: 'Harga (Rp)', labelSatuan: 'Jumlah Lembar' };
    }
}

// Helper: format jumlah satuan sesuai kategori
function formatSatuan(jumlah, kategori) {
    const config = getAsetConfig(kategori);
    const formatted = Number(jumlah).toFixed(config.presisi);
    // Khusus kripto, tidak tampilkan satuan di card
    if ((kategori || '').toLowerCase() === 'kripto') return formatted;
    return `${formatted} ${config.satuan}`;
}

// 3. Logika Modal Transaksi Jual/Beli
function bukaModalTransaksiAset(idAset) {
    const aset = dataAset.find(a => a.id === idAset);
    if (!aset) return;

    const config = getAsetConfig(aset.kategori);
    const isEWallet = (aset.kategori || '').toLowerCase() === 'ewallet';

    document.getElementById('trans-aset-id').value = idAset;
    document.getElementById('trans-ewallet-mode').value = isEWallet ? '1' : '0';
    document.getElementById('form-transaksi-aset').reset();
    document.getElementById('trans-tanggal').value = new Date().toISOString().split('T')[0];

    // Mode EWallet: ubah toggle, tampilkan deskripsi, sembunyikan lembar
    const btnJual = document.getElementById('btn-jual');
    const btnBeli = document.getElementById('btn-beli');
    const deskripsiGroup = document.getElementById('trans-deskripsi-group');
    const lembarGroup = document.getElementById('trans-lembar-group');
    const totalSection = document.getElementById('trans-total-section');

    if (isEWallet) {
        btnJual.textContent = 'Keluar';
        btnBeli.textContent = 'Masuk';
        if (deskripsiGroup) deskripsiGroup.style.display = 'block';
        if (lembarGroup) lembarGroup.style.display = 'none';
        if (totalSection) totalSection.style.display = 'none';
        document.getElementById('trans-label-harga').textContent = 'Nominal (Rp)';
    } else {
        btnJual.textContent = 'Jual';
        btnBeli.textContent = 'Beli';
        if (deskripsiGroup) deskripsiGroup.style.display = 'none';
        if (lembarGroup) lembarGroup.style.display = 'block';

        const isSaham = (aset.kategori || '').toLowerCase() === 'saham';
        if (totalSection) totalSection.style.display = isSaham ? 'block' : 'none';

        const labelSatuan = document.getElementById('trans-label-satuan');
        const labelHarga  = document.getElementById('trans-label-harga');
        const inputLembar = document.getElementById('trans-lembar');
        const inputHarga  = document.getElementById('trans-harga');

        if (labelSatuan) labelSatuan.textContent = config.labelSatuan;
        if (labelHarga)  labelHarga.textContent  = config.labelHarga;
        if (inputLembar) {
            inputLembar.step = config.stepSatuan;
            inputLembar.placeholder = config.presisi > 0 ? (0).toFixed(config.presisi) : '0';
        }
        if (inputHarga) inputHarga.step = config.stepHarga;
    }

    setJenisTransaksiAset('beli');

    const satuanPreview = document.getElementById('trans-satuan-preview');
    if (satuanPreview) satuanPreview.style.display = 'none';

    document.getElementById('modal-transaksi-aset').style.display = 'flex';
}

function setJenisTransaksiAset(jenis) {
    document.getElementById('trans-aset-jenis').value = jenis;
    if(jenis === 'jual') {
        document.getElementById('btn-jual').classList.add('active');
        document.getElementById('btn-beli').classList.remove('active');
    } else {
        document.getElementById('btn-beli').classList.add('active');
        document.getElementById('btn-jual').classList.remove('active');
    }
}

// Hitung Live Preview Total
let transHarga = null;
let transLembar = null;
let transPreview = null;

function initTransaksiAsetListeners() {
    transHarga  = document.getElementById('trans-harga');
    transLembar = document.getElementById('trans-lembar');
    transPreview = document.getElementById('trans-total-preview');
    if (transHarga)  transHarga.addEventListener('input', hitungTotalTransaksi);
    if (transLembar) transLembar.addEventListener('input', hitungTotalTransaksi);
}

function hitungTotalTransaksi() {
    const hargaEl  = document.getElementById('trans-harga');
    const lembarEl = document.getElementById('trans-lembar');
    const h = parseFloat(hargaEl ? hargaEl.value : 0) || 0;
    const l = parseFloat(lembarEl ? lembarEl.value : 0) || 0;
    const idAset = document.getElementById('trans-aset-id').value;
    const aset = dataAset.find(a => a.id === idAset);
    const kategori = aset ? aset.kategori : 'saham';
    const isSaham = (kategori || '').toLowerCase() === 'saham';
    const config = getAsetConfig(kategori);

    // Preview total (saham saja)
    const totalSection = document.getElementById('trans-total-section');
    const previewEl = document.getElementById('trans-total-preview');
    if (isSaham) {
        if (totalSection) totalSection.style.display = 'block';
        if (previewEl) previewEl.innerText = formatCurrency(h * l);
    } else {
        if (totalSection) totalSection.style.display = 'none';
    }

    // Preview satuan (kripto, emas, reksadana)
    const satuanPreview = document.getElementById('trans-satuan-preview');
    if (satuanPreview) {
        if (!isSaham && lembarEl && lembarEl.value !== '') {
            const formatted = Number(l).toFixed(config.presisi);
            const label = (kategori || '').toLowerCase() === 'kripto' ? ''
                        : (kategori || '').toLowerCase() === 'emas'   ? 'gram'
                        : 'unit';
            satuanPreview.textContent = `= ${formatted}${label ? ' ' + label : ''}`;
            satuanPreview.style.display = 'block';
        } else {
            satuanPreview.style.display = 'none';
        }
    }
}

// 4. Eksekusi Simpan Transaksi ke dalam Aset
function handleSimpanTransaksiAset(event) {
    event.preventDefault();
    const idAset = document.getElementById('trans-aset-id').value;
    const jenis = document.getElementById('trans-aset-jenis').value;
    const harga = parseFloat(document.getElementById('trans-harga').value);
    const tanggal = document.getElementById('trans-tanggal').value;
    const isEWallet = document.getElementById('trans-ewallet-mode').value === '1';

    if (!harga || harga <= 0) {
        showNotification('Nominal harus lebih dari 0', 'error');
        return;
    }

    let lembar = 0;
    let deskripsi = '';

    if (isEWallet) {
        deskripsi = document.getElementById('trans-deskripsi').value.trim();
        lembar = harga; // untuk EWallet, lembar = nominal (dipakai kalkulasi saldo)
    } else {
        lembar = parseFloat(document.getElementById('trans-lembar').value);
        if (!lembar || lembar <= 0) {
            showNotification('Jumlah harus lebih dari 0', 'error');
            return;
        }
    }

    const targetAsetIndex = dataAset.findIndex(a => a.id === idAset);
    if (targetAsetIndex !== -1) {
        if (!dataAset[targetAsetIndex].transaksi) dataAset[targetAsetIndex].transaksi = [];

        const editTrxId = document.getElementById('trans-aset-id').dataset.editTrxId;

        if (editTrxId) {
            // Mode edit: update transaksi yang ada
            const trxIdx = dataAset[targetAsetIndex].transaksi.findIndex(t => String(t.id_transaksi) === String(editTrxId));
            if (trxIdx !== -1) {
                dataAset[targetAsetIndex].transaksi[trxIdx] = {
                    ...dataAset[targetAsetIndex].transaksi[trxIdx],
                    jenis, harga, lembar, deskripsi, tanggal
                };
            }
            delete document.getElementById('trans-aset-id').dataset.editTrxId;
            showNotification('Transaksi berhasil diupdate!', 'success');
        } else {
            // Mode tambah baru
            dataAset[targetAsetIndex].transaksi.push({
                jenis, harga, lembar, deskripsi, tanggal,
                id_transaksi: Date.now()
            });
            showNotification('Transaksi aset berhasil dicatat!', 'success');
        }

        localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
        renderHalamanPorto();
        tutupModalTransaksiAset();

        // Realtime: refresh modal riwayat jika sedang terbuka
        const modalRiwayat = document.getElementById('modal-riwayat-aset');
        if (modalRiwayat && modalRiwayat.style.display === 'flex') {
            lihatRiwayat(idAset);
        }
    }
}

// Edit catatan inline di card
function editCatatanInline(idAset) {
    const container = document.getElementById(`catatan-${idAset}`);
    if (!container) return;

    const aset = dataAset.find(a => a.id === idAset);
    if (!aset) return;

    const currentVal = aset.catatan || '';

    container.innerHTML = `
        <div style="display:flex;gap:4px;align-items:center;">
            <input type="text" 
                   id="catatan-input-${idAset}"
                   value="${currentVal}" 
                   maxlength="40"
                   style="flex:1;font-size:11px;padding:3px 6px;border:1px solid var(--primary-accent-color);border-radius:6px;font-family:inherit;color:var(--text-primary);background:var(--background);"
                   placeholder="Tulis catatan...">
            <button onclick="simpanCatatanInline('${idAset}')" 
                    style="font-size:10px;padding:3px 7px;background:var(--primary-accent-color);color:#fff;border:none;border-radius:5px;cursor:pointer;">✓</button>
            <button onclick="renderHalamanPorto()" 
                    style="font-size:10px;padding:3px 7px;background:var(--background-secondary);color:var(--text-secondary);border:1px solid var(--border);border-radius:5px;cursor:pointer;">✕</button>
        </div>
    `;

    const input = document.getElementById(`catatan-input-${idAset}`);
    if (input) {
        input.focus();
        input.select();
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') simpanCatatanInline(idAset);
            if (e.key === 'Escape') renderHalamanPorto();
        });
    }
}

function simpanCatatanInline(idAset) {
    const input = document.getElementById(`catatan-input-${idAset}`);
    if (!input) return;

    const idx = dataAset.findIndex(a => a.id === idAset);
    if (idx !== -1) {
        dataAset[idx].catatan = input.value.trim();
        localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
        renderHalamanPorto();
    }
}

function tutupModalRiwayat() {
    document.getElementById('modal-riwayat-aset').style.display = 'none';
}

function hapusTrxAset(idAset, idTrx) {
    if (!confirm('Hapus transaksi ini?')) return;
    const idx = dataAset.findIndex(a => a.id === idAset);
    if (idx === -1) return;
    dataAset[idx].transaksi = dataAset[idx].transaksi.filter(t => String(t.id_transaksi) !== String(idTrx));
    localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
    renderHalamanPorto();
    lihatRiwayat(idAset);
}

function editTrxAset(idAset, idTrx) {
    const aset = dataAset.find(a => a.id === idAset);
    if (!aset) return;
    const trx = aset.transaksi.find(t => String(t.id_transaksi) === String(idTrx));
    if (!trx) return;

    // Tutup modal riwayat dulu, baru buka modal transaksi
    tutupModalRiwayat();

    setTimeout(() => {
        bukaModalTransaksiAset(idAset);
        setTimeout(() => {
            document.getElementById('trans-harga').value = trx.harga;
            document.getElementById('trans-tanggal').value = trx.tanggal;
            setJenisTransaksiAset(trx.jenis);
            const isEWallet = (aset.kategori || '').toLowerCase() === 'ewallet';
            if (isEWallet && trx.deskripsi) {
                document.getElementById('trans-deskripsi').value = trx.deskripsi;
            } else if (!isEWallet && trx.lembar) {
                document.getElementById('trans-lembar').value = trx.lembar;
            }
            document.getElementById('trans-aset-id').dataset.editTrxId = idTrx;
        }, 50);
    }, 150);
}

function lihatRiwayat(idAset) {
    const aset = dataAset.find(a => a.id === idAset);
    if (!aset) return;

    const isEWallet = (aset.kategori || '').toLowerCase() === 'ewallet';
    const config = getAsetConfig(aset.kategori);
    const kategoriLabel = aset.kategori === 'EWallet'
        ? (aset.jenis_ew || 'E-Wallet/Bank')
        : `${aset.kategori}${aset.jenis_rd ? ' · ' + aset.jenis_rd : ''}`;

    document.getElementById('riwayat-aset-nama').textContent = aset.nama;
    document.getElementById('riwayat-aset-sub').textContent = kategoriLabel;

    const list = document.getElementById('riwayat-list');
    list.innerHTML = '';

    const transaksi = aset.transaksi || [];
    if (transaksi.length === 0) {
        list.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#aaa;font-size:14px;">Belum ada riwayat transaksi</div>`;
    } else {
        // Sort terbaru di atas
        const sorted = [...transaksi].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

        sorted.forEach(trx => {
            const isMasuk = trx.jenis === 'beli' || trx.jenis === 'masuk';
            const warna = isMasuk ? '#10b981' : '#ef4444';
            const bgIcon = isMasuk ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
            const labelJenis = isEWallet
                ? (isMasuk ? 'Masuk' : 'Keluar')
                : (isMasuk ? 'Beli' : 'Jual');
            const arrow = isMasuk ? '↓' : '↑';

            let baris2 = '';
            if (isEWallet) {
                baris2 = trx.deskripsi || '';
            } else {
                baris2 = `${Number(trx.lembar).toFixed(config.presisi)} ${config.satuan}`;
            }

            const item = document.createElement('div');
            item.style.cssText = 'display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid #f5f5f5;';
            item.innerHTML = `
                <div style="width:38px;height:38px;border-radius:50%;background:${bgIcon};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;color:${warna};font-weight:700;">${arrow}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:14px;color:#1a1c21;">${labelJenis}</div>
                    <div style="font-size:12px;color:#888;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${baris2 || formatDate(trx.tanggal)}</div>
                    ${baris2 ? `<div style="font-size:11px;color:#bbb;margin-top:1px;">${formatDate(trx.tanggal)}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;">
                    <div style="font-weight:700;font-size:14px;color:${warna};">${
                        (aset.kategori || '').toLowerCase() === 'saham'
                            ? formatCurrency(trx.harga * (trx.lembar || 1))
                            : formatCurrency(trx.harga)
                    }</div>
                    ${(aset.kategori || '').toLowerCase() === 'saham'
                        ? `<div style="font-size:11px;color:#bbb;margin-top:2px;">${formatCurrency(trx.harga)}/lembar</div>`
                        : ''
                    }
                    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
                        <button onclick="editTrxAset('${aset.id}','${trx.id_transaksi}')" style="background:none;border:none;cursor:pointer;padding:2px;color:#94a3b8;" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onclick="hapusTrxAset('${aset.id}','${trx.id_transaksi}')" style="background:none;border:none;cursor:pointer;padding:2px;color:#fca5a5;" title="Hapus">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(item);
        });
    }

    document.getElementById('modal-riwayat-aset').style.display = 'flex';
}

// Hapus Aset (Menggunakan ID)
function hapusAset(idAset) {
    if(confirm('Yakin ingin menghapus seluruh aset ini beserta riwayat transaksinya?')) {
        dataAset = dataAset.filter(a => a.id !== idAset);
        localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
        renderHalamanPorto();
    }
}
// ==========================================================
// FIX: FUNGSI BUKA MODAL & LOGIKA DROPDOWN KATEGORI
// ==========================================================

// Fungsi memunculkan pop-up Tambah Aset
function bukaModalAset() {
    const modal = document.getElementById('modal-tambah-aset');
    modal.style.display = 'flex';
    document.getElementById('form-aset').reset();
    
    // Reset dropdown kembali ke default (Saham)
    const selectedDisplay = document.querySelector('#custom-kategori-aset .select-selected');
    if(selectedDisplay) {
        selectedDisplay.style.cssText = 'display:flex; align-items:center; padding:12px; border:1px solid #e1e4ea; border-radius:12px; cursor:pointer; gap:10px;';
        selectedDisplay.innerHTML = `<i data-lucide="bar-chart-2" style="width:18px;height:18px;flex-shrink:0;"></i><span style="flex:1;">Saham</span>`;
    }
    document.getElementById('label-nama-aset').innerText = "Saham";
    document.getElementById('input-nama').placeholder = "BBCA";
    document.getElementById('input-kategori').value = "Saham";
    // Reset jenis reksadana
    document.getElementById('input-jenis-rd').value = '';
    document.getElementById('section-jenis-rd').style.display = 'none';
    document.querySelectorAll('.rd-pill').forEach(p => p.classList.remove('active'));
    // Reset jenis ewallet
    document.getElementById('input-jenis-ewallet').value = '';
    document.getElementById('section-jenis-ewallet').style.display = 'none';
    document.querySelectorAll('#ewallet-jenis-pills .rd-pill').forEach(p => p.classList.remove('active'));
    // Reset counter catatan
    const catatanEl = document.getElementById('input-catatan');
    const counterEl = document.getElementById('catatan-counter');
    if (catatanEl) catatanEl.value = '';
    if (counterEl) counterEl.textContent = '0';
    initializeAssetCategorySelect();
    if (window.lucide) lucide.createIcons(); // Render ulang ikon Lucide
}

// Versi Upgrade Lengkap fungsi initializeAssetCategorySelect:
function initializeAssetCategorySelect() {
    const container = document.getElementById('custom-kategori-aset');
    const selectedDisplay = container.querySelector('.select-selected');
    const hiddenInput = document.getElementById('input-kategori');
    const optionsContainer = container.querySelector('.select-items');
    const labelNamaAset = document.getElementById('label-nama-aset');
    const inputNama = document.getElementById('input-nama');

    const optionsData = [
        { value: 'Saham',     icon: 'bar-chart-2', label: 'Saham',        contoh: 'BBCA, BMRI, BBRI, BBNI' },
        { value: 'Kripto',    icon: 'bitcoin',      label: 'Kripto',       contoh: 'BITCOIN, ETH, SOL' },
        { value: 'Emas',      icon: 'cuboid',       label: 'Emas',         contoh: 'Antam, UBS' },
        { value: 'Reksadana', icon: 'sprout',       label: 'Reksadana',    contoh: 'Bahana liquid plus, Schroder dana prestasi, Sucorinvest bond fund' },
        { value: 'EWallet',   icon: 'landmark',     label: 'E-Wallet/Bank', contoh: 'GoPay, OVO, BCA, Mandiri' }
    ];

    function setSelected(opt) {
        // Bangun konten selected tanpa Lucide — pakai span placeholder ikon lalu createIcons
        selectedDisplay.style.cssText = 'display:flex; align-items:center; padding:12px; border:1px solid #e1e4ea; border-radius:12px; cursor:pointer; gap:10px;';
        selectedDisplay.innerHTML = `<i data-lucide="${opt.icon}" style="width:18px;height:18px;flex-shrink:0;"></i><span style="flex:1;">${opt.label}</span>`;
        if (window.lucide) lucide.createIcons({ el: selectedDisplay });
        // Paksa svg tetap inline-flex
        const svg = selectedDisplay.querySelector('svg');
        if (svg) svg.style.cssText = 'width:18px;height:18px;flex-shrink:0;display:block;';
    }

    optionsContainer.innerHTML = '';
    optionsData.forEach(opt => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; align-items:center; gap:10px; padding:10px 12px; cursor:pointer;';
        div.innerHTML = `<i data-lucide="${opt.icon}" style="width:18px;height:18px;flex-shrink:0;"></i><span>${opt.label}</span>`;
        div.setAttribute('data-value', opt.value);

        div.addEventListener('click', function() {
            hiddenInput.value = opt.value;
            labelNamaAset.innerText = opt.label;
            inputNama.placeholder = opt.contoh;
            setSelected(opt);

            // Show/hide section jenis reksadana
            const sectionRD = document.getElementById('section-jenis-rd');
            const sectionEW = document.getElementById('section-jenis-ewallet');
            if (opt.value === 'Reksadana') {
                sectionRD.style.display = 'block';
                sectionEW.style.display = 'none';
                document.getElementById('input-jenis-ewallet').value = '';
                document.querySelectorAll('#ewallet-jenis-pills .rd-pill').forEach(p => p.classList.remove('active'));
            } else if (opt.value === 'EWallet') {
                sectionEW.style.display = 'block';
                sectionRD.style.display = 'none';
                document.getElementById('input-jenis-rd').value = '';
                document.querySelectorAll('#rd-jenis-pills .rd-pill').forEach(p => p.classList.remove('active'));
            } else {
                sectionRD.style.display = 'none';
                sectionEW.style.display = 'none';
                document.getElementById('input-jenis-rd').value = '';
                document.getElementById('input-jenis-ewallet').value = '';
                document.querySelectorAll('.rd-pill').forEach(p => p.classList.remove('active'));
            }

            optionsContainer.classList.add('select-hide');
            container.classList.remove('select-active');
        });
        optionsContainer.appendChild(div);
    });

    if (window.lucide) lucide.createIcons({ el: optionsContainer });

    selectedDisplay.onclick = (e) => {
        e.stopPropagation();
        optionsContainer.classList.toggle('select-hide');
    };

    // Setup pill listener jenis reksadana
    document.querySelectorAll('#rd-jenis-pills .rd-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('#rd-jenis-pills .rd-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            document.getElementById('input-jenis-rd').value = pill.dataset.jenis;
        };
    });

    // Setup pill listener jenis ewallet
    document.querySelectorAll('#ewallet-jenis-pills .rd-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('#ewallet-jenis-pills .rd-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            document.getElementById('input-jenis-ewallet').value = pill.dataset.jenis;
        };
    });
}
function selectTransactionType(type) {
    const inputJenis = document.getElementById('jenis');
    const tabs = document.querySelectorAll('.type-tab');
    
    // Cegah proses jika tipe yang diklik sudah aktif (menghindari flicker)
    if (inputJenis.value === type) return;

    inputJenis.value = type;
    
    // Gunakan cara manual agar tidak memicu repaint seluruh container
    tabs.forEach(tab => {
        if (tab.classList.contains(type === 'pemasukan' ? 'income' : 'expense')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// ===== HALAMAN PROFIL/SAYA =====

let kodeAksesVisible = false;

function loadProfilPage() {
  const username = localStorage.getItem('myUsername') || '—';
  const kodeAkses = localStorage.getItem('myAccessCode') || '';

  const nameEl = document.getElementById('profil-username-display');
  if (nameEl) nameEl.textContent = username;

  // profil-username-value removed in new layout, only display exists
  const valueEl = document.getElementById('profil-username-value');
  if (valueEl) valueEl.textContent = username;

  kodeAksesVisible = false;
  updateKodeAksesDisplay(kodeAkses);
  syncProfilPhoto();
  if (window.lucide) lucide.createIcons();
}

function updateKodeAksesDisplay(kode) {
  const kodeEl = document.getElementById('profil-kode-text');
  const eyeIcon = document.getElementById('profil-eye-icon');
  if (!kodeEl) return;

  if (kodeAksesVisible) {
    kodeEl.textContent = kode || '-';
    if (eyeIcon) {
      eyeIcon.setAttribute('data-lucide', 'eye-off');
      if (window.lucide) lucide.createIcons();
    }
  } else {
    kodeEl.textContent = '••••••';
    if (eyeIcon) {
      eyeIcon.setAttribute('data-lucide', 'eye');
      if (window.lucide) lucide.createIcons();
    }
  }
}

function toggleKodeAkses() {
  kodeAksesVisible = !kodeAksesVisible;
  const kode = localStorage.getItem('myAccessCode') || '';
  updateKodeAksesDisplay(kode);
}

function syncProfilPhoto() {
  const savedPhoto = localStorage.getItem('profilePhoto');
  const img = document.getElementById('profil-photo-display');
  const placeholder = document.getElementById('profil-photo-placeholder');
  if (!img || !placeholder) return;

  if (savedPhoto) {
    img.src = savedPhoto;
    img.classList.add('show');
    placeholder.classList.add('hide');
  } else {
    img.src = '';
    img.classList.remove('show');
    placeholder.classList.remove('hide');
  }
}
