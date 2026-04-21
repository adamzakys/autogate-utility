const GAS_URL = "https://script.google.com/macros/s/AKfycbzhzU1DsJ5Y6dX6RGs09-ZWJvVB6mTEv0tYjwfCQP9myHrdgkWUqEtLA44lIJYDnxaLnQ/exec";

lucide.createIcons();
let conditionChartInstance = null;
let currentPhotoFile = null;

// ================= NAVIGATION LOGIC =================
const navBtns = document.querySelectorAll('.nav-btn');
const pages = document.querySelectorAll('.page-section');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Reset all buttons
    navBtns.forEach(b => {
      b.classList.remove('text-red-600');
      b.classList.add('text-gray-400');
    });
    // Set active button
    btn.classList.remove('text-gray-400');
    btn.classList.add('text-red-600');

    // Hide all pages
    pages.forEach(p => {
      p.classList.add('hidden');
      p.classList.remove('block');
    });
    
    // Show target page
    const targetId = btn.getAttribute('data-target');
    const targetPage = document.getElementById(targetId);
    targetPage.classList.remove('hidden');
    targetPage.classList.add('block');
  });
});

// ================= DATA FETCHING =================
document.addEventListener("DOMContentLoaded", () => {
  fetchData();
});

async function fetchData() {
  const syncText = document.getElementById('syncText');
  const syncLoader = document.querySelector('.loader-mini');
  
  syncText.textContent = "Syncing...";
  syncText.classList.replace('text-green-500', 'text-gray-400');
  syncLoader.classList.remove('hidden');

  try {
    const response = await fetch(GAS_URL);
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    
    const textData = await response.text();
    const data = JSON.parse(textData);
    if (data.error) throw new Error(data.error);

    populateDropdowns(data);
    updateDashboard(data);
    
    syncText.textContent = "Online";
    syncText.classList.replace('text-gray-400', 'text-green-500');
    syncLoader.classList.add('hidden');
  } catch (error) {
    console.error("Fetch Error:", error);
    syncText.textContent = "Offline / Error";
    syncText.classList.replace('text-gray-400', 'text-red-500');
    syncLoader.classList.add('hidden');
    alert("Gagal memuat data dari server. Pastikan URL GAS benar.");
  }
}

function populateDropdowns(data) {
  // Populate Petugas / Teknisi
  const petugasSelect = document.getElementById("petugas");
  const teknisiSelect = document.getElementById("maint-teknisi");
  let officerOpts = '<option value="" disabled selected>Pilih...</option>';
  data.officers.forEach(name => officerOpts += `<option value="${name}">${name}</option>`);
  petugasSelect.innerHTML = officerOpts;
  teknisiSelect.innerHTML = officerOpts;

  // Populate Gate
  const gateSelect = document.getElementById("gateId");
  const maintGateSelect = document.getElementById("maint-gateId");
  let gateOpts = '<option value="" disabled selected>Pilih Gate...</option>';
  data.gates.forEach(g => gateOpts += `<option value="${g.id}">${g.id} - ${g.nama}</option>`);
  gateSelect.innerHTML = gateOpts;
  maintGateSelect.innerHTML = gateOpts;

  // Populate Hardware
  const hwSelect = document.getElementById("hardware");
  const maintHwSelect = document.getElementById("maint-hardware");
  let hwOpts = '<option value="" disabled selected>Pilih Hardware...</option>';
  data.hardwares.forEach(hw => hwOpts += `<option value="${hw}">${hw}</option>`);
  hwSelect.innerHTML = hwOpts;
  maintHwSelect.innerHTML = hwOpts;
}

function updateDashboard(data) {
  // Stats
  document.getElementById('stat-pass').textContent = data.stats.pass;
  document.getElementById('stat-warn').textContent = data.stats.warning;
  document.getElementById('stat-fail').textContent = data.stats.fail;

  // Render Chart
  const ctx = document.getElementById('conditionChart').getContext('2d');
  if (conditionChartInstance) conditionChartInstance.destroy();
  
  conditionChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pass', 'Warning', 'Fail'],
      datasets: [{
        data: [data.stats.pass, data.stats.warning, data.stats.fail],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }
      }
    }
  });

  // Recent Issues List
  const container = document.getElementById('recent-issues-container');
  if (data.recentIssues && data.recentIssues.length > 0) {
    let html = '';
    data.recentIssues.forEach(iss => {
      const isFail = iss.status === 'FAIL';
      const color = isFail ? 'red' : 'yellow';
      html += `
        <div class="bg-white p-3 rounded-xl border-l-4 border-l-${color}-500 shadow-sm flex justify-between items-center">
          <div>
            <p class="text-xs font-bold text-gray-800">${iss.gate} <span class="text-gray-400 font-normal">| ${iss.hardware}</span></p>
            <p class="text-[10px] text-gray-500 mt-0.5"><i data-lucide="clock" class="inline w-3 h-3"></i> ${iss.date} - ${iss.petugas}</p>
          </div>
          <span class="px-2 py-1 bg-${color}-50 text-${color}-700 text-[10px] font-bold rounded">${iss.status}</span>
        </div>
      `;
    });
    container.innerHTML = html;
    lucide.createIcons(); // re-init icons for new HTML
  } else {
    container.innerHTML = `<div class="text-center p-4 text-sm text-gray-400 italic bg-white rounded-xl border border-gray-200">Tidak ada isu terbaru.</div>`;
  }
}

// ================= PHOTO INPUT LOGIC =================
const photoCam = document.getElementById('photoCam');
const photoGal = document.getElementById('photoGal');
const display = document.getElementById('fileNameDisplay');

function handleFileSelection(e) {
  if (e.target.files && e.target.files.length > 0) {
    currentPhotoFile = e.target.files[0];
    display.textContent = `Foto terpilih: ${currentPhotoFile.name}`;
    display.classList.replace('text-gray-400', 'text-blue-600');
  }
}
photoCam.addEventListener('change', handleFileSelection);
photoGal.addEventListener('change', handleFileSelection);

// Require photo logic
const statusRadios = document.querySelectorAll('input[name="status"]');
const photoLabelText = document.getElementById('photoLabelText');
let isPhotoRequired = false;

statusRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'FAIL' || e.target.value === 'WARNING') {
      isPhotoRequired = true;
      photoLabelText.innerHTML = 'Foto Lapangan <span class="text-red-500">* (Wajib Kamera/Galeri)</span>';
    } else {
      isPhotoRequired = false;
      photoLabelText.innerHTML = 'Foto Lapangan (Opsional)';
    }
  });
});

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
const loadingOverlay = document.getElementById('loadingOverlay');

document.getElementById('dailyCheckForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (isPhotoRequired && !currentPhotoFile) {
    alert("Status WARNING/FAIL mewajibkan Anda melampirkan foto!");
    return;
  }
  
  loadingOverlay.classList.remove('hidden');
  const form = e.target;
  const formData = {
    petugas: form.petugas.value,
    gateId: form.gateId.value,
    hardware: form.hardware.value,
    status: form.status.value,
    keterangan: form.keterangan.value
  };

  let fileData = null;
  if (currentPhotoFile) {
    try {
      const dateStr = new Date().toLocaleString('id-ID');
      const watermarkText = `[ ${dateStr} ] Petugas: ${formData.petugas} | Gate: ${formData.gateId}`;
      const base64Data = await processImageWithWatermark(currentPhotoFile, watermarkText);
      fileData = { data: base64Data, type: 'image/jpeg', name: currentPhotoFile.name };
    } catch (error) {
      loadingOverlay.classList.add('hidden');
      return alert("Gagal memproses foto.");
    }
  }

  await sendPayload({ action: 'dailyCheck', formData, fileData }, form);
  currentPhotoFile = null;
  display.textContent = "Belum ada foto terpilih";
  display.classList.replace('text-blue-600', 'text-gray-400');
  document.querySelector('input[value="PASS"]').checked = true;
});

document.getElementById('maintenanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  loadingOverlay.classList.remove('hidden');
  const form = e.target;
  const formData = {
    teknisi: form.teknisi.value,
    tglLapor: form.tglLapor.value,
    statusTiket: form.statusTiket.value,
    gateId: form.gateId.value,
    hardware: form.hardware.value,
    masalah: form.masalah.value,
    tindakan: form.tindakan.value,
    tglSelesai: form.tglSelesai.value
  };

  await sendPayload({ action: 'maintenance', formData }, form);
});

async function sendPayload(payload, formElement) {
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    loadingOverlay.classList.add('hidden');
    
    if (result.success) {
      alert("Berhasil: " + result.message);
      formElement.reset();
      fetchData(); // Refresh dashboard data in background
    } else {
      alert("Gagal: " + result.message);
    }
  } catch (error) {
    loadingOverlay.classList.add('hidden');
    alert("Terjadi kesalahan jaringan: " + error.message);
  }
}
