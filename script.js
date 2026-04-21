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
let sessionPetugas = "";
let sessionLokasi = "";

// ================= NAVIGATION LOGIC =================
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page-section');
const bottomNav = document.getElementById('bottomNav');

function navigateTo(pageId) {
  navBtns.forEach(b => {
    if (b.getAttribute('data-target') === pageId) {
      b.classList.remove('text-gray-400');
      b.classList.add('text-red-600');
    } else {
      b.classList.remove('text-red-600');
      b.classList.add('text-gray-400');
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
  } else {
    bottomNav.classList.remove('hidden');
    bottomNav.classList.add('flex');
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
  const startPetugas = document.getElementById('start-petugas');
  const startLokasi = document.getElementById('start-lokasi');

  // Populate Petugas
  let officerOpts = '<option value="" disabled selected>Pilih Petugas...</option>';
  data.officers.forEach(name => officerOpts += `<option value="${name}">${name}</option>`);
  startPetugas.innerHTML = officerOpts;

  // Populate Unique Lokasi
  const uniqueLokasi = [...new Set(data.gates.map(g => g.lokasi))];
  let lokasiOpts = '<option value="" disabled selected>Pilih Lokasi Tugas...</option>';
  uniqueLokasi.forEach(loc => lokasiOpts += `<option value="${loc}">${loc}</option>`);
  startLokasi.innerHTML = lokasiOpts;
}

// ================= LOGIN LOGIC =================
document.getElementById('startForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pet = document.getElementById('start-petugas').value;
  const lok = document.getElementById('start-lokasi').value;

  if (!pet || !lok) {
    alert("Harap pilih Petugas dan Lokasi Tugas terlebih dahulu!");
    return;
  }

  sessionPetugas = pet;
  sessionLokasi = lok;

  applySessionFilter();
  navigateTo('page-dashboard');
});


function applySessionFilter() {
  if (!globalData) return;
  const data = globalData;

  // Filter Gates by Location
  const filteredGates = data.gates.filter(g => g.lokasi === sessionLokasi);

  const gateSelect = document.getElementById("gateId");
  const maintGateSelect = document.getElementById("maint-gateId");
  let gateOpts = '<option value="" disabled selected>Pilih Gate...</option>';
  filteredGates.forEach(g => gateOpts += `<option value="${g.id}">${g.id} - ${g.nama}</option>`);
  gateSelect.innerHTML = gateOpts;
  maintGateSelect.innerHTML = gateOpts;

  // Populate Hardware
  window.hardwareOptions = '<option value="" disabled selected>Pilih Hardware...</option>';
  data.hardwares.forEach(hw => window.hardwareOptions += `<option value="${hw}">${hw}</option>`);
  document.querySelectorAll('.hw-select').forEach(sel => {
    sel.innerHTML = window.hardwareOptions;
  });

  // Filter Dashboard Stats
  document.getElementById('dash-lokasi').textContent = sessionLokasi;
  document.getElementById('dash-lokasi-isu').textContent = sessionLokasi;

  const filteredTodayLogs = data.todayLogs.filter(log => log.lokasi === sessionLokasi);
  let pass = 0, warn = 0, fail = 0;
  filteredTodayLogs.forEach(log => {
    if (log.status === 'PASS') pass++;
    if (log.status === 'WARNING') warn++;
    if (log.status === 'FAIL') fail++;
  });

  document.getElementById('stat-pass').textContent = pass;
  document.getElementById('stat-warn').textContent = warn;
  document.getElementById('stat-fail').textContent = fail;

  updateChart(pass, warn, fail);

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
        <div onclick="openIssueModal(${index})" class="bg-white dark:bg-slate-800 p-3.5 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-3 border border-slate-100 dark:border-slate-700/60">
          <div class="w-10 h-10 rounded-full bg-${color}-50 dark:bg-${color}-500/10 flex items-center justify-center shrink-0">
            <i data-lucide="${icon}" class="w-5 h-5 text-${color}-500"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">${iss.gateId}</p>
            <p class="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5" title="${iss.hardware}">${iss.hardware}</p>
            <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-1"><i data-lucide="clock" class="inline w-3 h-3"></i> ${iss.date}</p>
          </div>
          <span class="px-2.5 py-1 bg-${color}-50 dark:bg-${color}-500/10 text-${color}-700 dark:text-${color}-400 text-[10px] font-bold rounded-lg border border-${color}-100 dark:border-${color}-800/30">${iss.status}</span>
        </div>
      `;
    });
    container.innerHTML = html;
    lucide.createIcons();
  } else {
    container.innerHTML = `<div class="text-center p-4 text-sm text-gray-400 italic bg-white rounded-xl border border-gray-100">Tidak ada kendala terbaru di area ini.</div>`;
  }
}

function updateChart(pass, warn, fail) {
  const chartParent = document.getElementById('conditionChart').parentElement;
  if (pass === 0 && warn === 0 && fail === 0) {
    chartParent.innerHTML = `<div class="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><i data-lucide="inbox" class="w-8 h-8 mb-2 opacity-50"></i><p class="text-xs">Belum ada data hari ini</p></div><canvas id="conditionChart" class="hidden"></canvas>`;
    lucide.createIcons();
    if (conditionChartInstance) conditionChartInstance.destroy();
    return;
  } else {
    if(chartParent.querySelector('div.absolute')) {
      chartParent.innerHTML = `<canvas id="conditionChart"></canvas>`;
    }
  }

  const ctx = document.getElementById('conditionChart').getContext('2d');
  if (conditionChartInstance) conditionChartInstance.destroy();

  conditionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pass', 'Warn', 'Fail'],
      datasets: [{
        data: [pass, warn, fail],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 11 } } }
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
  cameraModal.classList.remove('hidden');
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    videoElement.srcObject = currentStream;
  } catch (err) {
    alert("Kamera tidak dapat diakses. Mohon izinkan akses kamera atau gunakan Galeri.");
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
  cameraModal.classList.add('hidden');
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

// ================= FORM SUBMISSIONS =================
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
  if (isPhotoRequired && currentPhotoFiles.length === 0) return alert("Status WARNING/FAIL mewajibkan Anda melampirkan foto!");

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
      return alert("Gagal memproses foto.");
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
      alert("Berhasil: " + result.message);
      formElement.reset();
      fetchData(false); // Reload data stat di background
    } else {
      alert("Gagal: " + result.message);
    }
  } catch (error) {
    toggleButtonLoading(btnElement, false);
    alert("Terjadi kesalahan jaringan: " + error.message);
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
  modal.classList.remove('hidden');
}

function closeIssueModal() {
  document.getElementById('issueModal').classList.add('hidden');
}
window.openIssueModal = openIssueModal;
window.closeIssueModal = closeIssueModal;

// ================= DYNAMIC HARDWARE SELECTS =================
function addHwSelect(containerId) {
  const container = document.getElementById(containerId);
  const div = document.createElement('div');
  div.className = "ios-select-wrapper flex gap-2 hw-item items-center mt-2";
  div.innerHTML = `
    <select name="hardware" class="ios-input w-full font-medium hw-select" required>
      ${window.hardwareOptions || '<option value="" disabled selected>Pilih Hardware...</option>'}
    </select>
    <button type="button" class="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg active:scale-95 transition-all shrink-0" onclick="this.parentElement.remove()">
      <i data-lucide="minus-circle" class="w-5 h-5"></i>
    </button>
  `;
  container.appendChild(div);
  lucide.createIcons();
}

document.getElementById('btnAddHwDaily').addEventListener('click', () => addHwSelect('hw-container-daily'));
document.getElementById('btnAddHwMaint').addEventListener('click', () => addHwSelect('hw-container-maint'));
