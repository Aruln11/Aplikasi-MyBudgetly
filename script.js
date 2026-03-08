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

        // Jika maintenance aktif ATAU data gagal diambil
        if (data && data.status === true) {
            screen.style.display = 'flex'; // Tetap tampilkan
            mainContent.style.display = 'none';
            textEl.innerText = data.value || "Kami sedang melakukan pemeliharaan rutin.";
            document.body.style.overflow = 'hidden'; 
        } else {
            // HANYA JIKA MAINTENANCE MATI, kita tutup layarnya
            screen.style.display = 'none';
            mainContent.style.display = 'block';
            document.body.style.overflow = 'auto';
        }
    } catch (err) {
        // Jika terjadi error koneksi, amannya tampilkan aplikasi (atau tetap maintenance)
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

function initializeCustomSelect() {
  const container = document.getElementById('custom-jenis');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const hiddenInput = document.getElementById('jenis');
  const optionsContainer = container.querySelector('.select-items');
  const options = optionsContainer.querySelectorAll('div');

  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

  const defaultOption = options[1];
  selectedDisplay.innerHTML = defaultOption.innerHTML;
  hiddenInput.value = defaultOption.getAttribute('data-value');
  
  selectedDisplay.addEventListener('click', function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    closeAllSelect();
    if (!isActive) {
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
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

function initializeMonthFilter() {
  const container = document.getElementById('custom-filter-bulan');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const optionsContainer = container.querySelector('.select-items');

  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

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

    if(logoutButton) logoutButton.disabled = false;

    updateAuthUI(); 
    updateUI();     
    showNotification('Anda telah logout.', 'info');

    document.getElementById('settings-menu').classList.remove('open');
  }
}

function updateAuthUI() {
    const authButton = document.getElementById('auth-button');
    const authButtonText = authButton.querySelector('span');

    if (localStorage.getItem('isLoggedIn') === 'true') {
        authButtonText.textContent = 'Logout';
        authButton.onclick = handleLogout;
    } else {
        authButtonText.textContent = 'Login';
        authButton.onclick = showLoginModal;
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
    tbody.innerHTML = '';
    
    const emptyState = document.getElementById('empty-state');
    emptyState.style.display = 'block';

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
    
    document.querySelector('.table-container table').style.display = 'none';
    document.getElementById('pagination-controls').innerHTML = '';

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

    const { data: settings } = await supabaseClient
        .from('pengaturan_admin')
        .select('setting_fitur, status, value')
        .in('setting_fitur', ['auto acc', 'default device limit']);

    const configAuto = settings.find(s => s.setting_fitur === 'auto acc');
    const configLimit = settings.find(s => s.setting_fitur === 'default device limit');

    const statusAwal = (configAuto && configAuto.status) ? 'aktif' : 'pending';
    
    const limitDefault = configLimit ? parseInt(configLimit.value) : 3; 

    const { error } = await supabaseClient.from('pelanggan').insert({
        username: user,
        kode_akses: kode,
        status: statusAwal,
        batas_perangkat: limitDefault,
        dibuat_tanggal: new Date().toLocaleString("sv-SE").replace(' ', 'T')
    });

    if (!error) {
        alert(statusAwal === 'aktif' ? "Akses Aktif! Silakan Login." : "Berhasil! Tunggu persetujuan Admin.");
        tutupModalDaftar();
    } else {
        pesan.innerText = "Gagal: " + error.message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
});

let dataAset = JSON.parse(localStorage.getItem('myBudgetly_assets')) || [];

function switchTab(pageId, element) {
  document.querySelectorAll('.app-page').forEach(page => {
    page.style.display = 'none';
    page.classList.remove('active');
  });

  const targetPage = document.getElementById(`page-${pageId}`);
  if (targetPage) {
    targetPage.style.display = 'block';
    setTimeout(() => targetPage.classList.add('active'), 10);
  }

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  if (element) {
    element.classList.add('active');
  }

  if (pageId === 'portofolio') {
    renderHalamanPorto();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  if (window.lucide) {
    lucide.createIcons();
  }
}

// --- LOGIKA PORTOFOLIO (SAHAM ONLY) ---

function bukaModalAset() {
    const modal = document.getElementById('modal-tambah-aset');
    modal.style.display = 'flex';
    document.getElementById('form-aset').reset();
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('preview-total').innerText = "Rp 0";
    if (window.lucide) lucide.createIcons();
}

function tutupModalAset() {
    document.getElementById('modal-tambah-aset').style.display = 'none';
}

// Hitung Total (Harga * Lembar)
const inpHarga = document.getElementById('input-harga');
const inpLembar = document.getElementById('input-lembar');
const dispTotal = document.getElementById('preview-total');

function hitungTotal() {
    const h = parseFloat(inpHarga.value) || 0;
    const l = parseFloat(inpLembar.value) || 0;
    dispTotal.innerText = formatCurrency(h * l);
}

if(inpHarga && inpLembar) {
    inpHarga.addEventListener('input', hitungTotal);
    inpLembar.addEventListener('input', hitungTotal);
}

// Simpan Data
function handleSimpanAset(event) {
    event.preventDefault();
    
    const nama = document.getElementById('input-nama').value;
    const harga = parseFloat(document.getElementById('input-harga').value);
    const lembar = parseFloat(document.getElementById('input-lembar').value);
    const tanggal = document.getElementById('input-tanggal').value;
    const catatan = document.getElementById('input-catatan').value;

    if (!nama || !harga || !lembar) return;

    const total = harga * lembar;

    dataAset.push({
        nama: nama,
        kategori: "Saham", // Hardcode Saham
        harga: harga,
        lembar: lembar,
        nilai: total,
        tanggal: tanggal,
        catatan: catatan
    });

    localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
    renderHalamanPorto();
    tutupModalAset();
    showNotification('Aset Saham berhasil disimpan!', 'success');
}

// Render Halaman
function renderHalamanPorto() {
    const container = document.getElementById('list-aset-container');
    const totalDisplay = document.getElementById('total-aset-display');
    const countDisplay = document.getElementById('jumlah-aset-display');

    if (!container) return;
    container.innerHTML = '';

    let totalAll = 0;

    if (dataAset.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                <i data-lucide="layers" style="width: 48px; opacity: 0.2; margin-bottom: 10px;"></i>
                <p>Belum ada aset.</p>
            </div>`;
    }

    dataAset.forEach((aset, index) => {
        totalAll += Number(aset.nilai);

        const html = `
            <div class="asset-card-design">
                <div class="acd-header">
                    <span class="acd-symbol">${aset.nama.toUpperCase()}</span>
                    <span class="acd-badge">saham</span>
                </div>
                <div class="acd-name">${aset.nama.toLowerCase()}</div>
                
                <div class="acd-value">${formatCurrency(aset.nilai)}</div>
                <div class="acd-lembar">${aset.lembar} Lembar</div>

                ${aset.catatan ? `
                    <div class="acd-note-label">Catatan</div>
                    <div class="acd-note-text">"${aset.catatan}"</div>
                ` : '<div style="margin-bottom:20px;"></div>'}

                <div class="acd-actions">
                    <button class="acd-btn" title="Tambah">
                        <i data-lucide="plus" style="width:16px"></i>
                    </button>
                    <button class="acd-btn" title="Kurang">
                        <i data-lucide="minus" style="width:16px"></i>
                    </button>
                    <button class="acd-btn" title="Riwayat">
                        <i data-lucide="history" style="width:16px"></i>
                    </button>
                    <button class="acd-btn delete" onclick="hapusAset(${index})" title="Hapus">
                        <i data-lucide="trash-2" style="width:16px"></i>
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });

    if(totalDisplay) totalDisplay.innerText = formatCurrency(totalAll);
    if(countDisplay) countDisplay.innerText = dataAset.length;
    
    if(window.lucide) lucide.createIcons();
}

function hapusAset(index) {
    if(confirm('Hapus aset ini?')) {
        dataAset.splice(index, 1);
        localStorage.setItem('myBudgetly_assets', JSON.stringify(dataAset));
        renderHalamanPorto();
    }
}
// --- LOGIKA HITUNG TOTAL OTOMATIS ---
document.addEventListener('DOMContentLoaded', () => {
    const inpHarga = document.getElementById('input-harga');
    const inpLembar = document.getElementById('input-lembar');
    const dispTotal = document.getElementById('preview-total');

    function hitungTotal() {
        // Ambil nilai, kalau kosong anggap 0
        const h = parseFloat(inpHarga.value) || 0;
        const l = parseFloat(inpLembar.value) || 0;
        
        // Update teks Total
        if (dispTotal) {
            dispTotal.innerText = formatCurrency(h * l);
        }
    }

    // Pasang 'pendengar' saat user mengetik
    if(inpHarga && inpLembar) {
        inpHarga.addEventListener('input', hitungTotal);
        inpLembar.addEventListener('input', hitungTotal);
    }
});
function initializeAssetCategorySelect() {
  const container = document.getElementById('custom-kategori-aset');
  if (!container) return;

  const selectedDisplay = container.querySelector('.select-selected');
  const hiddenInput = document.getElementById('input-kategori');
  const optionsContainer = container.querySelector('.select-items');
  const options = optionsContainer.querySelectorAll('div');

  const closeAllSelect = () => {
    container.classList.remove('select-active');
    optionsContainer.classList.add('select-hide');
  };

  selectedDisplay.onclick = function(e) {
    e.stopPropagation();
    const isActive = container.classList.contains('select-active');
    
    document.querySelectorAll('.custom-select-container').forEach(c => {
        if(c !== container) {
            c.classList.remove('select-active');
            c.querySelector('.select-items')?.classList.add('select-hide');
        }
    });
    
    if (!isActive) {
      container.classList.add('select-active');
      optionsContainer.classList.remove('select-hide');
    } else {
      closeAllSelect();
    }
  };

  options.forEach(option => {
    option.onclick = function(e) {
      e.stopPropagation();
      hiddenInput.value = this.getAttribute('data-value');
      closeAllSelect();
    };
  });

  window.onclick = function(event) {
    if (!container.contains(event.target)) {
      closeAllSelect();
    }
  };
}

function bukaModalAset() {
    const modal = document.getElementById('modal-tambah-aset');
    modal.style.display = 'flex';
    document.getElementById('form-aset').reset();
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    document.getElementById('preview-total').innerText = "Rp 0";
    
    initializeAssetCategorySelect(); 
    
    if (window.lucide) lucide.createIcons();
}
// Fungsi untuk merender hari dalam sebulan
function renderCustomCalendar(date) {
    const popup = document.getElementById('custom-calendar-popup');
    const month = date.getMonth();
    const year = date.getFullYear();

    // Logika pembuatan grid tanggal (1-31)
    // Update input #tanggal saat tanggal diklik:
    // document.getElementById('tanggal').value = `${year}-${month+1}-${day}`;
}

// Event listener untuk memunculkan popup
document.getElementById('calendar-trigger').addEventListener('click', () => {
    const popup = document.getElementById('custom-calendar-popup');
    popup.classList.toggle('select-hide');
    renderCustomCalendar(new Date());
});
