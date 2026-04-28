const GAS_URL = "https://script.google.com/macros/s/AKfycbzhzU1DsJ5Y6dX6RGs09-ZWJvVB6mTEv0tYjwfCQP9myHrdgkWUqEtLA44lIJYDnxaLnQ/exec";

lucide.createIcons();
let conditionChartInstance = null;
let currentPhotoFiles = [];

// ================= THEME LOGIC =================
const btnThemeToggle = document.getElementById('btnThemeToggle');
if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

btnThemeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  if (document.documentElement.classList.contains('dark')) {
    localStorage.theme = 'dark';
  } else {
    localStorage.theme = 'light';
  }
});


// Global State
let globalData = null;
let sessionPetugas = localStorage.getItem('sessionPetugas') || "";
let sessionLokasi = localStorage.getItem('sessionLokasi') || "";

// ================= TOAST NOTIFICATION =================
window.showToast = function(msg, type = 'info') {
  const toast = document.getElementById('toastNotification');
  const msgEl = document.getElementById('toastMessage');
  const iconEl = document.getElementById('toastIcon');
  
  if(!toast) return alert(msg);
  
  msgEl.textContent = msg;
  let iconClass = "w-5 h-5 ";
  if (type === 'success') {
    iconEl.setAttribute('data-lucide', 'check-circle');
    iconClass += 'text-emerald-400';
  } else if (type === 'error') {
    iconEl.setAttribute('data-lucide', 'alert-circle');
    iconClass += 'text-red-400';
  } else {
    iconEl.setAttribute('data-lucide', 'info');
    iconClass += 'text-blue-400';
  }
  iconEl.className = iconClass;
  lucide.createIcons();
  
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.remove('-translate-y-10', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-10', 'opacity-0', 'pointer-events-none');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3500);
};

// ================= NAVIGATION LOGIC =================
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page-section');
const bottomNav = document.getElementById('bottomNav');

function navigateTo(pageId) {
  navBtns.forEach(b => {
    if (b.getAttribute('data-target') === pageId) {
      b.classList.remove('text-slate-400', 'dark:text-slate-500', 'hover:text-slate-800', 'dark:hover:text-slate-300', 'text-gray-400');
      b.classList.add('text-red-600', 'dark:text-red-500', 'drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]');
    } else {
      b.classList.remove('text-red-600', 'dark:text-red-500', 'drop-shadow-[0_0_8px_rgba(220,38,38,0.8)]');
      b.classList.add('text-slate-400', 'dark:text-slate-500', 'hover:text-slate-800', 'dark:hover:text-slate-300');
    }
  });

  pages.forEach(p => {
    if (p.id === pageId) {
      p.classList.remove('hidden');
      p.classList.add('block');
    } else {
      p.classList.add('hidden');
      p.classList.remove('block');
    }
  });

  if (pageId === 'page-login') {
    bottomNav.classList.add('hidden');
    bottomNav.classList.remove('flex');
    document.getElementById('btnLogout').classList.add('hidden');
  } else {
    bottomNav.classList.remove('hidden');
    bottomNav.classList.add('flex');
    document.getElementById('btnLogout').classList.remove('hidden');
  }
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navigateTo(btn.getAttribute('data-target'));
  });
});

// ================= DATA FETCHING =================
document.addEventListener("DOMContentLoaded", () => {
  fetchData(true);
});

document.getElementById('btnReload').addEventListener('click', () => {
  fetchData(false);
});

async function fetchData(isInitial = false) {
  const syncText = document.getElementById('syncText');
  const connStatus = document.getElementById('connection-status');

  syncText.textContent = "Syncing...";
  connStatus.classList.replace('bg-green-50', 'bg-gray-100');
  connStatus.classList.replace('bg-red-50', 'bg-gray-100');
  connStatus.classList.replace('text-green-600', 'text-gray-500');
  connStatus.classList.replace('text-red-600', 'text-gray-500');


  try {
    const response = await fetch(`${GAS_URL}?t=${new Date().getTime()}`);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);

    const textData = await response.text();
    const data = JSON.parse(textData);
    if (data.error) throw new Error(data.error);

    globalData = data;

    if (isInitial) {
      populateStartPage(data);
      if (sessionPetugas && sessionLokasi) {
        applySessionFilter();
        navigateTo('page-dashboard');
      }
    } else if (sessionPetugas && sessionLokasi) {
      // Refresh UI if already logged in
      applySessionFilter();
    }

    syncText.textContent = "Online";
    connStatus.classList.replace('bg-gray-100', 'bg-green-50');
    connStatus.classList.replace('text-gray-500', 'text-green-600');

    if (isInitial) {
      const overlay = document.getElementById('startupOverlay');
      if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 500);
      }
    }

  } catch (error) {
    console.error("Fetch Error:", error);
    syncText.textContent = "Offline";
    connStatus.classList.replace('bg-gray-100', 'bg-red-50');
    connStatus.classList.replace('text-gray-500', 'text-red-600');

    if (isInitial) {
      const startupText = document.getElementById('startupText');
      if (startupText) startupText.textContent = "Gagal memuat data dari server. Anda sedang offline.";
      const overlay = document.getElementById('startupOverlay');
      if (overlay) {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 500);
      }
    }

  }
}

function populateStartPage(data) {
  // Populate Petugas
  let officerOpts = '<option value="" disabled selected>Pilih Petugas...</option>';
  data.officers.forEach(name => officerOpts += `<option value="${name}">${name}</option>`);
  refreshTomSelect('start-petugas', officerOpts);

  // Populate Unique Lokasi dari REF_HARDWARE (Kolom F)
  const uniqueLokasi = [...new Set(data.todayLogs.map(log => log.lokasi).filter(loc => loc && loc !== "Lainnya"))];
  let lokasiOpts = '<option value="" disabled selected>Pilih Lokasi Tugas...</option>';
  uniqueLokasi.forEach(loc => lokasiOpts += `<option value="${loc}">${loc}</option>`);
  refreshTomSelect('start-lokasi', lokasiOpts);
}

// ================= LOGIN LOGIC =================
document.getElementById('startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pet = document.getElementById('start-petugas').value;
  const lok = document.getElementById('start-lokasi').value;

  if (!pet || !lok) {
    showToast("Harap pilih Petugas dan Lokasi Tugas terlebih dahulu!", "error");
    return;
  }

  sessionPetugas = pet;
  sessionLokasi = lok;
  localStorage.setItem('sessionPetugas', pet);
  localStorage.setItem('sessionLokasi', lok);

  applySessionFilter();
  navigateTo('page-dashboard');
});

// Logout Logic
document.getElementById('btnLogout').addEventListener('click', () => {
  if (confirm("Apakah Anda yakin ingin keluar dari sesi ini?")) {
    localStorage.removeItem('sessionPetugas');
    localStorage.removeItem('sessionLokasi');
    location.reload();
  }
});


function applySessionFilter() {
  if (!globalData) return;
  const data = globalData;

  // Filter Gates by Location
  const filteredGates = data.gates.filter(g => g.lokasi === sessionLokasi);

  let gateOpts = '<option value="" disabled selected>Pilih Gate...</option>';
  filteredGates.forEach(g => gateOpts += `<option value="${g.id}">${g.id} - ${g.nama}</option>`);
  refreshTomSelect('gateId', gateOpts);
  refreshTomSelect('maint-gateId', gateOpts);

  // Initial Hardware State (must select gate first)
  window.hardwareOptions = '<option value="" disabled selected>Silakan pilih Gate terlebih dahulu...</option>';
  window.dailyHardwareOptions = null;
  window.maintHardwareOptions = null;
  document.querySelectorAll('.hw-select').forEach(sel => {
    refreshTomSelectEl(sel, window.hardwareOptions);
  });

  // Filter Dashboard Stats
  document.getElementById('dash-lokasi').textContent = sessionLokasi;
  document.getElementById('dash-lokasi-isu').textContent = sessionLokasi;

  const filteredTodayLogs = data.todayLogs.filter(log => log.lokasi === sessionLokasi);
  let warn = 0, fail = 0;
  filteredTodayLogs.forEach(log => {
    if (log.status === 'WARNING') warn++;
    if (log.status === 'FAIL') fail++;
  });

  document.getElementById('stat-warn').textContent = warn;
  document.getElementById('stat-fail').textContent = fail;

  updateChart(filteredTodayLogs);

  // Filter Recent Issues
  window.currentFilteredIssues = data.recentIssues.filter(log => log.lokasi === sessionLokasi).slice(0, 5); // top 5
  const filteredIssues = window.currentFilteredIssues;
  const container = document.getElementById('recent-issues-container');
  if (filteredIssues.length > 0) {
    let html = '';
    filteredIssues.forEach((iss, index) => {
      const isFail = iss.status === 'FAIL';
      const color = isFail ? 'red' : 'yellow';
      const icon = isFail ? 'x-circle' : 'alert-triangle';
      html += `
        <div onclick="openIssueModal(${index})" class="bg-white/80 dark:bg-slate-800/80 p-3.5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3 border border-white/60 dark:border-slate-700/60">
          <div class="w-10 h-10 rounded-full bg-${color}-50 dark:bg-${color}-500/20 flex items-center justify-center shrink-0">
            <i data-lucide="${icon}" class="w-5 h-5 text-${color}-500"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">${iss.gateId}</p>
            <p class="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5" title="${iss.hardware}">${iss.hardware}</p>
            <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-1"><i data-lucide="clock" class="inline w-3 h-3"></i> ${iss.date}</p>
          </div>
          <span class="px-2.5 py-1 bg-${color}-50 dark:bg-${color}-500/20 text-${color}-700 dark:text-${color}-300 text-[10px] font-bold rounded-lg border border-${color}-100 dark:border-${color}-700/50">${iss.status}</span>
        </div>
      `;
    });
    container.innerHTML = html;
    lucide.createIcons();
  } else {
    container.innerHTML = `<div class="text-center p-4 text-sm text-gray-400 dark:text-slate-500 italic bg-white/80 dark:bg-slate-800/80 rounded-xl border border-white/60 dark:border-slate-700/60">Tidak ada kendala terbaru di area ini.</div>`;
  }
}

function updateChart(logs) {
  const canvas = document.getElementById('conditionChart');
  if (!canvas) return;
  
  if (conditionChartInstance) {
    conditionChartInstance.destroy();
    conditionChartInstance = null;
  }
  
  const issues = logs.filter(l => l.status !== 'PASS');
  const chartParent = canvas.parentElement;

  if (issues.length === 0) {
    chartParent.innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><i data-lucide="check-circle" class="w-8 h-8 mb-2 text-emerald-500 opacity-50"></i><p class="text-xs">Semua Gate Normal</p></div><canvas id="conditionChart" class="hidden"></canvas>`;
    lucide.createIcons();
    return;
  } else {
    // Restore canvas if it was hidden
    if (canvas.classList.contains('hidden') || chartParent.querySelector('div.absolute')) {
      chartParent.innerHTML = `<canvas id="conditionChart"></canvas>`;
      const newCanvas = document.getElementById('conditionChart');
      return updateChart(logs); // Re-run with new canvas
    }
  }

  // Group by Gate ID
  const gateIssues = {};
  issues.forEach(iss => {
    gateIssues[iss.gateId] = (gateIssues[iss.gateId] || 0) + 1;
  });

  const labels = Object.keys(gateIssues).sort();
  const values = labels.map(l => gateIssues[l]);

  conditionChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Jumlah Isu',
        data: values,
        backgroundColor: '#ef4444',
        borderRadius: 8,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#94a3b8', font: { weight: 'bold' } },
          grid: { display: false }
        }
      }
    }
  });
}

// ================= WEBCAM & PHOTO LOGIC =================
const btnOpenCam = document.getElementById('btnOpenCam');
const cameraModal = document.getElementById('cameraModal');
const btnCloseCam = document.getElementById('btnCloseCam');
const videoElement = document.getElementById('videoElement');
const captureCanvas = document.getElementById('captureCanvas');
const btnCapture = document.getElementById('btnCapture');

const photoGal = document.getElementById('photoGal');
const photoPreviewContainer = document.getElementById('photoPreviewContainer');
const fileNameDisplay = document.getElementById('fileNameDisplay');
let currentStream = null;

// Start WebCam
btnOpenCam.addEventListener('click', async () => {
  openModalAnim(cameraModal);
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    videoElement.srcObject = currentStream;
  } catch (err) {
    showToast("Kamera tidak dapat diakses. Mohon izinkan akses kamera atau gunakan Galeri.", "error");
    cameraModal.classList.add('hidden');
  }
});

// Stop WebCam
function stopWebCam() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    videoElement.srcObject = null;
    currentStream = null;
  }
  closeModalAnim(cameraModal);
}
btnCloseCam.addEventListener('click', stopWebCam);

// Capture Photo from WebCam
btnCapture.addEventListener('click', () => {
  const ctx = captureCanvas.getContext('2d');
  captureCanvas.width = videoElement.videoWidth;
  captureCanvas.height = videoElement.videoHeight;
  ctx.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);

  captureCanvas.toBlob((blob) => {
    const file = new File([blob], `webcam_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
    currentPhotoFiles.push(file);
    renderPhotoPreviews();
  }, 'image/jpeg', 0.9);

  stopWebCam();
});

// Handle Gallery
photoGal.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    for(let i=0; i < e.target.files.length; i++) {
      currentPhotoFiles.push(e.target.files[i]);
    }
    renderPhotoPreviews();
  }
});

// Render Previews
function renderPhotoPreviews() {
  if (currentPhotoFiles.length === 0) {
    photoPreviewContainer.classList.add('hidden');
    fileNameDisplay.textContent = "Belum ada foto terpilih";
    photoGal.value = "";
    return;
  }
  
  photoPreviewContainer.classList.remove('hidden');
  photoPreviewContainer.innerHTML = '';
  
  currentPhotoFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement('div');
    div.className = "relative w-20 h-20 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 snap-center shadow-sm";
    div.innerHTML = `
      <img src="${url}" class="w-full h-full object-cover">
      <button type="button" onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-red-500/90 text-white rounded-full p-1 shadow backdrop-blur-sm hover:bg-red-600 transition-colors">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
    `;
    photoPreviewContainer.appendChild(div);
  });
  
  lucide.createIcons();
  fileNameDisplay.textContent = `${currentPhotoFiles.length} foto siap`;
}

// Global scope for onclick
window.removePhoto = function(index) {
  currentPhotoFiles.splice(index, 1);
  renderPhotoPreviews();
};

// Require photo logic
const statusRadios = document.querySelectorAll('input[name="status"]');
const photoLabelText = document.getElementById('photoLabelText');
let isPhotoRequired = false;

statusRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'FAIL' || e.target.value === 'WARNING') {
      isPhotoRequired = true;
      photoLabelText.innerHTML = 'Foto Lapangan <span class="text-red-500">* (Wajib)</span>';
    } else {
      isPhotoRequired = false;
      photoLabelText.innerHTML = 'Foto Lapangan (Opsional)';
    }
  });
});

// Base64 + Watermark function
function processImageWithWatermark(file, watermarkText) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const MAX_WIDTH = 800;
        let width = img.width, height = img.height;
        if (width > MAX_WIDTH) { height = Math.floor(height * (MAX_WIDTH / width)); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const fontSize = Math.max(16, Math.floor(width / 35));
        ctx.font = `${fontSize}px Inter, sans-serif`;
        const padding = 12, rectHeight = fontSize + padding * 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, height - rectHeight, width, rectHeight);
        ctx.fillStyle = 'white';
        ctx.fillText(watermarkText, padding, height - padding - 4);

        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      };
      img.onerror = reject; img.src = e.target.result;
    };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

// ================= FORM SUBMISSIONS & UI LOGIC =================
const maintStatusTiket = document.getElementById('maint-statusTiket');
const maintTindakanContainer = document.getElementById('maint-tindakan-container');
const maintTglSelesaiContainer = document.getElementById('maint-tglSelesai-container');
const maintTindakanInput = document.getElementById('maint-tindakan');
const maintTglSelesaiInput = document.getElementById('maint-tglSelesai');

function toggleMaintFields() {
  if (!maintStatusTiket || !maintTindakanContainer || !maintTglSelesaiContainer) return;
  if (maintStatusTiket.value === 'Closed') {
    maintTindakanContainer.classList.remove('hidden');
    maintTglSelesaiContainer.classList.remove('hidden');
    maintTindakanInput.required = true;
    maintTglSelesaiInput.required = true;
  } else {
    maintTindakanContainer.classList.add('hidden');
    maintTglSelesaiContainer.classList.add('hidden');
    maintTindakanInput.required = false;
    maintTglSelesaiInput.required = false;
    maintTindakanInput.value = '';
    maintTglSelesaiInput.value = '';
  }
}

if (maintStatusTiket) {
  maintStatusTiket.addEventListener('change', toggleMaintFields);
  // Run once on load to set initial state
  document.addEventListener('DOMContentLoaded', toggleMaintFields);
}

function toggleButtonLoading(btn, isLoading) {
  if (isLoading) {
    btn.disabled = true;
    btn.setAttribute('data-original-html', btn.innerHTML);
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Menyimpan...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.getAttribute('data-original-html');
  }
}

document.getElementById('dailyCheckForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isPhotoRequired && currentPhotoFiles.length === 0) return showToast("Status WARNING/FAIL mewajibkan Anda melampirkan foto!", "error");

  const form = e.target;
  const btnSubmit = document.getElementById('btnSubmitDaily');
  toggleButtonLoading(btnSubmit, true);

  const formData = {
    petugas: sessionPetugas,
    lokasi: sessionLokasi,
    gateId: form.gateId.value,
    hardware: Array.from(document.querySelectorAll('#hw-container-daily .hw-select')).map(s => s.value).filter(v => v).join(', '),
    status: form.status.value,
    keterangan: form.keterangan.value
  };

  let fileDataArray = [];
  if (currentPhotoFiles.length > 0) {
    try {
      const dateStr = new Date().toLocaleString('id-ID');
      const wmText = `[ ${dateStr} ] Petugas: ${formData.petugas} | Gate: ${formData.gateId}`;
      
      const promises = currentPhotoFiles.map(async (file) => {
        const base64Data = await processImageWithWatermark(file, wmText);
        return { data: base64Data, type: 'image/jpeg', name: file.name };
      });
      
      fileDataArray = await Promise.all(promises);
    } catch (error) {
      toggleButtonLoading(btnSubmit, false);
      return showToast("Gagal memproses foto.", "error");
    }
  }

  await sendPayload({ action: 'dailyCheck', formData, fileDataArray }, form, btnSubmit);

  // Reset custom elements
  currentPhotoFiles = [];
  renderPhotoPreviews();
  document.querySelector('input[value="PASS"]').checked = true;
});

document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btnSubmit = document.getElementById('btnSubmitMaint');
  toggleButtonLoading(btnSubmit, true);

  const formData = {
    teknisi: sessionPetugas,
    tglLapor: form.tglLapor.value,
    statusTiket: form.statusTiket.value,
    gateId: form.gateId.value,
    hardware: Array.from(document.querySelectorAll('#hw-container-maint .hw-select')).map(s => s.value).filter(v => v).join(', '),
    masalah: form.masalah.value,
    tindakan: form.tindakan.value,
    tglSelesai: form.tglSelesai.value
  };

  await sendPayload({ action: 'maintenance', formData }, form, btnSubmit);
});

async function sendPayload(payload, formElement, btnElement) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    toggleButtonLoading(btnElement, false);

    if (result.success) {
      showToast("Berhasil: " + result.message, "success");
      
      // Trigger Share Dialog
      const shareData = {
        title: payload.action === 'dailyCheck' ? 'Laporan Daily Check' : 'Laporan Maintenance',
        gateId: payload.formData.gateId,
        hardware: payload.formData.hardware,
        status: payload.formData.status || payload.formData.statusTiket,
        petugas: payload.formData.petugas || payload.formData.teknisi,
        keterangan: payload.formData.keterangan || payload.formData.masalah || payload.formData.tindakan,
        date: new Date().toLocaleString('id-ID')
      };
      
      setTimeout(() => {
        showShareDialog(shareData);
      }, 1000);

      formElement.reset();
      fetchData(false); // Reload data stat di background
    } else {
      showToast("Gagal: " + result.message, "error");
    }
  } catch (error) {
    toggleButtonLoading(btnElement, false);
      showToast("Terjadi kesalahan jaringan: " + error.message, "error");
  }
}

// ================= SHARE FEATURE =================
function showShareDialog(data) {
  const text = `*${data.title}*
--------------------------
📅 *Waktu:* ${data.date}
📍 *Gate:* ${data.gateId}
🔧 *Hardware:* ${data.hardware}
📊 *Status:* ${data.status}
👤 *Petugas:* ${data.petugas}
📝 *Keterangan:* ${data.keterangan || '-'}

_Laporan dikirim via BMS GateOps_`;

  if (navigator.share) {
    // Desktop/Mobile Native Share
    const btnShareNative = document.createElement('button');
    btnShareNative.className = "ios-btn bg-blue-600 text-white w-full py-3 mt-4 flex items-center justify-center gap-2";
    btnShareNative.innerHTML = `<i data-lucide="share-2" class="w-4 h-4"></i> Bagikan Laporan`;
    
    const container = document.createElement('div');
    container.id = "shareOverlay";
    container.className = "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4";
    container.innerHTML = `
      <div class="bg-white dark:bg-slate-800 rounded-[28px] p-6 w-full max-w-sm shadow-2xl scale-in">
        <div class="text-center mb-4">
          <div class="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <i data-lucide="check-circle" class="w-8 h-8"></i>
          </div>
          <h3 class="font-bold text-lg text-slate-800 dark:text-slate-100">Berhasil Dikirim!</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Ingin membagikan ringkasan laporan ini?</p>
        </div>
        <div class="space-y-2">
          <button id="btnShareWA" class="ios-btn-secondary w-full flex items-center justify-center gap-2 py-3 border-emerald-100 hover:bg-emerald-50">
            <i data-lucide="message-circle" class="w-4 h-4 text-emerald-500"></i> WhatsApp
          </button>
          <button id="btnShareNative" class="ios-btn bg-slate-800 dark:bg-slate-700 text-white w-full flex items-center justify-center gap-2 py-3">
            <i data-lucide="share-2" class="w-4 h-4"></i> Opsi Lainnya
          </button>
          <button id="btnSkipShare" class="w-full text-slate-400 text-xs font-medium py-2 mt-2">Selesai</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    lucide.createIcons();

    document.getElementById('btnShareWA').onclick = () => {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
    };

    document.getElementById('btnShareNative').onclick = async () => {
      try {
        await navigator.share({
          title: data.title,
          text: text
        });
      } catch (err) {
        console.log("Share cancelled or failed");
      }
    };

    document.getElementById('btnSkipShare').onclick = () => {
      container.remove();
    };
    
    container.onclick = (e) => {
      if(e.target === container) container.remove();
    };

  } else {
    // Fallback for browsers without navigator.share
    const urlWA = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(urlWA, '_blank');
  }
}

// ================= ISSUE MODAL LOGIC =================
function openIssueModal(index) {
  const iss = window.currentFilteredIssues[index];
  if (!iss) return;
  
  const modal = document.getElementById('issueModal');
  const body = document.getElementById('issueModalBody');
  const photoContainer = document.getElementById('issuePhotoContainer');
  const btnLoadPhoto = document.getElementById('btnLoadIssuePhoto');
  
  body.innerHTML = `
    <div class="grid grid-cols-2 gap-3">
      <div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gate</span><span class="font-semibold text-slate-800 dark:text-slate-100">${iss.gateId}</span></div>
      <div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hardware</span><span class="font-semibold text-slate-800 dark:text-slate-100">${iss.hardware}</span></div>
      <div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Petugas</span><span class="font-semibold text-slate-800 dark:text-slate-100">${iss.petugas}</span></div>
      <div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Waktu</span><span class="font-semibold text-slate-800 dark:text-slate-100">${iss.date}</span></div>
    </div>
    <div class="mt-3">
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Keterangan / Tindakan</span>
      <p class="text-sm bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 p-2.5 rounded-lg text-slate-700 dark:text-slate-300 min-h-[60px]">${iss.keterangan || 'Tidak ada keterangan tambahan.'}</p>
    </div>
  `;
  
  photoContainer.classList.add('hidden');
  photoContainer.innerHTML = '';
  
  if (iss.foto && iss.foto.trim() !== '') {
    btnLoadPhoto.classList.remove('hidden');
    btnLoadPhoto.onclick = () => {
      btnLoadPhoto.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Memuat Foto...`;
      setTimeout(() => {
        const urls = iss.foto.split(',').map(u => u.trim()).filter(u => u);
        let imgHtml = '';
        urls.forEach(url => {
          // Attempting to extract ID to render a thumbnail if it's a Drive URL, but for simplicity we will just set src
          // A safer way to view drive images is to use the direct thumbnail URL, but since it's an internal app, we rely on the URL provided.
          imgHtml += `<a href="${url}" target="_blank" class="block"><img src="${url}" class="w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm mb-2" alt="Foto Isu" onerror="this.outerHTML='<div class=\\'p-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg text-center\\'>Gambar tidak dapat dimuat langsung. <a href=\\'${url}\\' target=\\'_blank\\' class=\\'underline\\'>Buka link</a></div>'"></a>`;
        });
        photoContainer.innerHTML = imgHtml;
        photoContainer.classList.remove('hidden');
        btnLoadPhoto.classList.add('hidden');
      }, 300); // small delay to simulate loading
    };
    btnLoadPhoto.innerHTML = `<i data-lucide="image" class="w-4 h-4"></i> Tampilkan Foto Terbaru`;
  } else {
    btnLoadPhoto.classList.add('hidden');
  }
  
  lucide.createIcons();
  openModalAnim(modal);
}

function closeIssueModal() {
  closeModalAnim(document.getElementById('issueModal'));
}
window.openIssueModal = openIssueModal;
window.closeIssueModal = closeIssueModal;

// ================= DYNAMIC HARDWARE SELECTS =================
function addHwSelect(containerId) {
  const container = document.getElementById(containerId);
  const opts = (containerId === 'hw-container-daily') ? (window.dailyHardwareOptions || window.hardwareOptions) : (window.maintHardwareOptions || window.hardwareOptions);
  
  const div = document.createElement('div');
  div.className = "ios-select-wrapper flex gap-2 hw-item items-center mt-2";
  div.innerHTML = `
    <select name="hardware" class="ios-input w-full font-medium hw-select" required>
      ${opts}
    </select>
    <button type="button" class="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg active:scale-95 transition-all shrink-0" onclick="this.parentElement.remove()">
      <i data-lucide="minus-circle" class="w-5 h-5"></i>
    </button>
  `;
  container.appendChild(div);
  lucide.createIcons();
  initTomSelect(div.querySelector('select'));
}

document.getElementById('btnAddHwDaily').addEventListener('click', () => addHwSelect('hw-container-daily'));
document.getElementById('btnAddHwMaint').addEventListener('click', () => addHwSelect('hw-container-maint'));

// Gate Change Listeners for Filtering Hardware
document.getElementById('gateId').addEventListener('change', (e) => {
  updateHardwareOptions(e.target.value, 'hw-container-daily', true);
});
document.getElementById('maint-gateId').addEventListener('change', (e) => {
  updateHardwareOptions(e.target.value, 'hw-container-maint', false);
});

function updateHardwareOptions(gateId, containerId, isDaily) {
  if (!globalData || !globalData.todayLogs) return;
  
  // Filter hardware from todayLogs where gateId matches
  const hws = [...new Set(globalData.todayLogs
    .filter(log => String(log.gateId) === String(gateId))
    .map(log => log.hardware))];

  let opts = '<option value="" disabled selected>Pilih Hardware...</option>';
  if (isDaily) {
    opts += '<option value="Semua Hardware Normal">Semua Hardware Normal</option>';
  }
  
  hws.forEach(hw => {
    if (hw !== "Semua Hardware Normal") {
      // Find latest status for this hardware in this gate
      const hwState = globalData.todayLogs.find(log => String(log.gateId) === String(gateId) && log.hardware === hw);
      const status = hwState ? hwState.status : 'PASS';
      let statusIndicator = "";
      if (status === 'FAIL') statusIndicator = "🔴 [FAIL]";
      else if (status === 'WARNING') statusIndicator = "🟡 [WARN]";
      else statusIndicator = "🟢 [OK]";

      opts += `<option value="${hw}">${hw} ${statusIndicator}</option>`;
    }
  });

  // Store options for the addHwSelect button
  if (containerId === 'hw-container-daily') {
    window.dailyHardwareOptions = opts;
  } else {
    window.maintHardwareOptions = opts;
  }

  // Update all existing selects in the container
  const container = document.getElementById(containerId);
  const selects = container.querySelectorAll('.hw-select');
  
  // If gate changes, it's safer to clear extra rows and reset the first one
  const items = container.querySelectorAll('.hw-item');
  items.forEach((item, idx) => {
    if (idx > 0) {
      item.remove();
    } else {
      const sel = item.querySelector('.hw-select');
      refreshTomSelectEl(sel, opts);
    }
  });
}

// ================= UTILITIES & EXPORTS =================
function initTomSelect(el) {
  if (el.tomselect) return;
  el.parentElement.classList.add('has-ts');
  new TomSelect(el, {
    create: false,
    placeholder: el.getAttribute('placeholder') || "Pilih opsi...",
  });
}

function refreshTomSelect(elId, htmlOpts) {
  const el = document.getElementById(elId);
  if (!el) return;
  refreshTomSelectEl(el, htmlOpts);
}

function refreshTomSelectEl(el, htmlOpts) {
  if (el.tomselect) {
    el.tomselect.destroy();
  }
  el.innerHTML = htmlOpts;
  initTomSelect(el);
}

function openModalAnim(modal) {
  modal.classList.remove('hidden');
  if (modal.id === 'cameraModal') modal.classList.add('flex');
  void modal.offsetWidth; // trigger reflow
  modal.classList.add('show');
}

function closeModalAnim(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.classList.add('hidden');
    if (modal.id === 'cameraModal') modal.classList.remove('flex');
  }, 300);
}

window.downloadDashboardReport = async function(type, format, event) {
  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;
  
  if (!startDate || !endDate) {
    showToast("Harap pilih Dari Tanggal dan Sampai Tanggal terlebih dahulu!", "error");
    return;
  }
  
  if (startDate > endDate) {
    showToast("Tanggal awal tidak boleh lebih besar dari tanggal akhir!", "error");
    return;
  }

  const btn = event.currentTarget;
  const oldHtml = btn.innerHTML;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Memproses...`;
  btn.disabled = true;

  try {
    const url = `${GAS_URL}?action=exportDashboard&type=${type}&format=${format}&start=${startDate}&end=${endDate}`;
    
    if (format === 'csv') {
      window.open(url, '_blank');
    } else if (format === 'pdf') {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error || "Gagal mengambil data dari server");
      
      const rows = data.data; 
      
      if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("Library jsPDF tidak termuat. Cek koneksi internet.");
      const doc = new window.jspdf.jsPDF('landscape');
      
      const titleReport = type === 'maint' ? 'LAPORAN PERBAIKAN (MAINTENANCE)' : 'LAPORAN TEMUAN OPERASIONAL';
      
      // Judul Laporan (Warna Oranye)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(249, 115, 22); // Orange-500
      doc.text(titleReport, 14, 20);
      
      // Subjudul (Abu-abu)
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Periode  : ${startDate} s/d ${endDate}`, 14, 28);
      doc.text(`Dicetak  : ${new Date().toLocaleString('id-ID')}`, 14, 33);
      
      // Garis Pembatas
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.setLineWidth(0.5);
      doc.line(14, 37, 283, 37);
      
      if (rows.length > 1) { 
        const headers = rows.shift();
        doc.autoTable({
          head: [headers],
          body: rows,
          startY: 42,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85] },
          headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold' }, // Oranye
          alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate-50 zebra striping
          columnStyles: type === 'maint' ? { 4: { cellWidth: 40 }, 5: { cellWidth: 40 } } : {}
        });
      } else {
        doc.text("Tidak ada data pada rentang tanggal ini.", 14, 45);
      }
      
      doc.save(`Laporan_${type}_${startDate}_to_${endDate}.pdf`);
    }
  } catch (err) {
    console.error(err);
      showToast("Gagal memproses laporan: " + err.message, "error");
  } finally {
    btn.innerHTML = oldHtml;
    btn.disabled = false;
    lucide.createIcons();
  }
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeIssueModal();
    if (typeof stopWebCam === 'function') stopWebCam();
  }
});

document.getElementById('issueModal').addEventListener('click', (e) => {
  if (e.target.id === 'issueModal') closeIssueModal();
});

document.getElementById('cameraModal').addEventListener('click', (e) => {
  if (e.target.id === 'cameraModal') stopWebCam();
});
