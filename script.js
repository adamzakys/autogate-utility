// script.js
let appData = { hardware: [], gates: [], officers: [], issues: [] };
let selectedPhotos = [];

// Fungsi utama bikin form dinamis
function renderChecker() {
    const container = document.getElementById('view-container');
    
    // 1. Ambil kategori unik dari hardware (misal: CCTV, Mechanical, dll)
    const categories = [...new Set(appData.hardware.map(item => item.kategori))];

    let html = `
        <div class="p-4 animate-fade-in pb-20">
            <h1 class="text-2xl font-black mb-6">Daily Check</h1>
            <div class="card mb-6 bg-primary_light border-primary/20">
                <p class="text-[10px] font-bold text-primary uppercase">Gate Aktif</p>
                <p class="font-bold">${document.getElementById('select-gate')?.value || 'Belum Pilih Gate'}</p>
            </div>
            <form id="main-form" onsubmit="handleFormSubmit(event)">
    `;

    // 2. Looping per Kategori
    categories.forEach(cat => {
        html += `
            <div class="mb-8">
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">${cat}</h3>
                <div class="space-y-3">
        `;

        // 3. Looping Alat di dalam kategori tersebut
        const items = appData.hardware.filter(h => h.kategori === cat);
        items.forEach(item => {
            html += `
                <div class="card flex flex-col gap-3">
                    <p class="font-bold text-sm text-slate-700">${item.nama}</p>
                    <div class="flex gap-2">
                        ${['Normal', 'Warning', 'Rusak/Error'].map(status => `
                            <label class="flex-1">
                                <input type="radio" name="hw-${item.id}" value="${status}" class="hidden peer" required>
                                <div class="text-[10px] font-bold text-center p-2 rounded-xl border-2 border-slate-100 text-slate-400 
                                     peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white transition-all cursor-pointer uppercase">
                                    ${status}
                                </div>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    // 4. Tambah bagian Keterangan & Foto
    html += `
                <div class="card mb-6">
                    <label class="block text-xs font-bold text-slate-500 mb-2 uppercase">Keterangan Tambahan</label>
                    <textarea id="form-ket" class="w-full bg-slate-50 border-none rounded-xl p-3 text-sm" rows="3" placeholder="Catatan lapangan..."></textarea>
                </div>

                <div class="card mb-6">
                    <label class="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">Dokumentasi</label>
                    <div id="preview-foto" class="flex gap-2 overflow-x-auto mb-3"></div>
                    <div class="grid grid-cols-2 gap-3">
                        <button type="button" onclick="openCameraModal('daily')" class="btn-secondary">Kamera</button>
                        <button type="button" onclick="document.getElementById('file-input').click()" class="btn-secondary">Galeri</button>
                    </div>
                    <input type="file" id="file-input" class="hidden" multiple accept="image/*" onchange="handleFile(event)">
                </div>

                <button type="submit" class="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all">SUBMIT DATA</button>
            </form>
        </div>
    `;

    container.innerHTML = html;
}

// script.js (Lanjutan)

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const gateId = document.getElementById('select-gate')?.value;
    if (!gateId) return Swal.fire('Error', 'Pilih Gate terlebih dahulu!', 'error');

    // Tampilkan Loading
    document.getElementById('loading-screen').classList.remove('hidden');

    // 1. Kumpulkan semua hasil pengecekan hardware
    const checks = [];
    appData.hardware.forEach(hw => {
        const status = document.querySelector(`input[name="hw-${hw.id}"]:checked`)?.value;
        if (status) {
            checks.push({
                hardware_id: hw.id,
                status: status
            });
        }
    });

    // 2. Siapkan Payload (Data yang dikirim)
    const payload = {
        type: "daily",
        tanggal: new Date().toLocaleDateString('id-ID'),
        gate_id: gateId,
        officer: appData.user || "Zaky", // Ganti dengan sistem login kamu
        checks: checks, // Ini Array of Objects
        keterangan: document.getElementById('form-ket').value,
        photos: selectedPhotos // Array base64 foto
    };

    // 3. Kirim ke Google Apps Script
    google.script.run
        .withSuccessHandler(response => {
            document.getElementById('loading-screen').classList.add('hidden');
            if (response.status === "success") {
                Swal.fire('Berhasil!', 'Laporan harian telah tersimpan.', 'success')
                    .then(() => changeTab('dashboard'));
            }
        })
        .withFailureHandler(err => {
            document.getElementById('loading-screen').classList.add('hidden');
            Swal.fire('Gagal', 'Terjadi kesalahan: ' + err, 'error');
        })
        .processSubmission(payload); // Fungsi ini harus ada di backend.gs
}