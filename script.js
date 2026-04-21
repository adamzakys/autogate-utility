const GAS_URL = "https://script.google.com/macros/s/AKfycbzhzU1DsJ5Y6dX6RGs09-ZWJvVB6mTEv0tYjwfCQP9myHrdgkWUqEtLA44lIJYDnxaLnQ/exec";

lucide.createIcons();
let conditionChartInstance = null;
let currentPhotoFile = null;

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
    const response = await fetch(GAS_URL);
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
      if (startupText) startupText.textContent = "Gagal memuat data dari server.";
      alert("Gagal memuat data awal dari server.");
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
  const hwSelect = document.getElementById("hardware");
  const maintHwSelect = document.getElementById("maint-hardware");
  let hwOpts = '<option value="" disabled selected>Pilih Hardware...</option>';
  data.hardwares.forEach(hw => hwOpts += `<option value="${hw}">${hw}</option>`);
  hwSelect.innerHTML = hwOpts;
  maintHwSelect.innerHTML = hwOpts;

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
  const filteredIssues = data.recentIssues.filter(log => log.lokasi === sessionLokasi).slice(0, 5); // top 5
  const container = document.getElementById('recent-issues-container');
  if (filteredIssues.length > 0) {
    let html = '';
    filteredIssues.forEach(iss => {
      const isFail = iss.status === 'FAIL';
      const color = isFail ? 'red' : 'yellow';
      html += `
        <div class="bg-white p-3 rounded-xl border-l-4 border-l-${color}-500 shadow-sm flex justify-between items-center border border-gray-100">
          <div>
            <p class="text-xs font-bold text-gray-800">${iss.gateId} <span class="text-gray-400 font-normal">| ${iss.hardware}</span></p>
            <p class="text-[10px] text-gray-500 mt-0.5"><i data-lucide="clock" class="inline w-3 h-3"></i> ${iss.date} - ${iss.petugas}</p>
          </div>
          <span class="px-2 py-1 bg-${color}-50 text-${color}-700 text-[10px] font-bold rounded">${iss.status}</span>
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
const photoPreview = document.getElementById('photoPreview');
const btnRemovePhoto = document.getElementById('btnRemovePhoto');
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
    const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
    setPhotoPreview(file, URL.createObjectURL(blob));
  }, 'image/jpeg', 0.9);

  stopWebCam();
});

// Handle Gallery
photoGal.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    const file = e.target.files[0];
    setPhotoPreview(file, URL.createObjectURL(file));
  }
});

// Set Preview
function setPhotoPreview(file, url) {
  currentPhotoFile = file;
  photoPreview.src = url;
  photoPreviewContainer.classList.remove('hidden');
  fileNameDisplay.textContent = `Foto siap: ${file.name}`;
}

// Remove Photo
btnRemovePhoto.addEventListener('click', () => {
  currentPhotoFile = null;
  photoPreview.src = "";
  photoPreviewContainer.classList.add('hidden');
  fileNameDisplay.textContent = "Belum ada foto terpilih";
  photoGal.value = "";
});

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
        const MAX_WIDTH = 1200;
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

        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
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
  if (isPhotoRequired && !currentPhotoFile) return alert("Status WARNING/FAIL mewajibkan Anda melampirkan foto!");

  const form = e.target;
  const btnSubmit = document.getElementById('btnSubmitDaily');
  toggleButtonLoading(btnSubmit, true);

  const formData = {
    petugas: sessionPetugas,
    lokasi: sessionLokasi,
    gateId: form.gateId.value,
    hardware: form.hardware.value,
    status: form.status.value,
    keterangan: form.keterangan.value
  };

  let fileData = null;
  if (currentPhotoFile) {
    try {
      const dateStr = new Date().toLocaleString('id-ID');
      const wmText = `[ ${dateStr} ] Petugas: ${formData.petugas} | Gate: ${formData.gateId}`;
      const base64Data = await processImageWithWatermark(currentPhotoFile, wmText);
      fileData = { data: base64Data, type: 'image/jpeg', name: currentPhotoFile.name };
    } catch (error) {
      toggleButtonLoading(btnSubmit, false);
      return alert("Gagal memproses foto.");
    }
  }

  await sendPayload({ action: 'dailyCheck', formData, fileData }, form, btnSubmit);

  // Reset custom elements
  btnRemovePhoto.click();
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
    hardware: form.hardware.value,
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
