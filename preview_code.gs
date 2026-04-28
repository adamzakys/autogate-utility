/**
 * KONFIGURASI DASAR
 */
const SS_ID = "1oU4Fki6jtiRPgwFbUBg8IaEvJH9ub5Yv53jxjChLjtQ"; 
const FOLDER_ID = "1wy0nUvvf0ANSqu38_J_VLRl13LjgroGt"; 

/**
 * FUNGSI UNTUK MENANGANI GET REQUEST (REST API)
 */
function doGet(e) {
  try {
    if (e.parameter && e.parameter.action === 'exportDashboard') {
      const startParam = e.parameter.start; // format yyyy-mm-dd
      const endParam = e.parameter.end;
      const typeParam = e.parameter.type || 'daily';
      
      const ss = SpreadsheetApp.openById(SS_ID);
      
      // Map Nama Gate
      const gatesData = ss.getSheetByName("REF_GATES").getDataRange().getValues();
      const gateMap = {}; 
      for (let i = 1; i < gatesData.length; i++) {
        gateMap[gatesData[i][0]] = gatesData[i][1];
      }
      
      let results = [];
      let fileNamePrefix = "";
      
      if (typeParam === 'daily') {
        const dailyData = ss.getSheetByName("LOG_DAILY_CHECK").getDataRange().getValues();
        const headers = ["Waktu", "Nama Gate", "Hardware", "Status", "Petugas", "Keterangan"];
        results.push(headers);
        fileNamePrefix = "Laporan_Temuan";
        
        for (let i = 1; i < dailyData.length; i++) {
          const row = dailyData[i];
          if (!row[1]) continue;
          
          let tglStr = "";
          if (row[1] instanceof Date) {
            tglStr = Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd");
          } else {
            tglStr = String(row[1]).substring(0, 10);
          }
          
          if (tglStr >= startParam && tglStr <= endParam && (row[4] === 'FAIL' || row[4] === 'WARNING')) {
            results.push([
              row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+7", "dd/MM/yyyy HH:mm") : row[0],
              gateMap[row[2]] || row[2], 
              row[3], row[4], row[5], row[6]  
            ]);
          }
        }
      } else if (typeParam === 'maint') {
        const maintData = ss.getSheetByName("LOG_MAINTENANCE").getDataRange().getValues();
        const headers = ["Tgl Lapor", "Nama Gate", "Hardware", "Status Tiket", "Masalah", "Tindakan", "Tgl Selesai", "Teknisi"];
        results.push(headers);
        fileNamePrefix = "Laporan_Perbaikan";
        
        for (let i = 1; i < maintData.length; i++) {
          const row = maintData[i];
          if (!row[1]) continue;
          
          let tglStr = "";
          if (row[1] instanceof Date) {
            tglStr = Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd");
          } else {
            tglStr = String(row[1]).substring(0, 10);
          }
          
          // Kolom: 0=ID, 1=TglLapor, 2=Gate, 3=HW, 4=Masalah, 5=TglSelesai, 6=Tindakan, 7=Teknisi, 8=Status
          if (tglStr >= startParam && tglStr <= endParam) { 
            results.push([
              row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd") : row[1],
              gateMap[row[2]] || row[2],
              row[3], row[8], row[4], row[6], 
              row[5] instanceof Date ? Utilities.formatDate(row[5], "GMT+7", "yyyy-MM-dd") : row[5], 
              row[7]
            ]);
          }
        }
      }
      
      if (e.parameter.format === 'csv') {
        const csvContent = results.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
        return ContentService.createTextOutput(csvContent)
          .setMimeType(ContentService.MimeType.CSV)
          .downloadAsFile(`${fileNamePrefix}_${startParam}_to_${endParam}.csv`);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: results }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const data = getInitialData();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * FUNGSI UNTUK MENANGANI POST REQUEST (REST API)
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    let result;
    
    if (payload.action === 'maintenance') {
      result = submitMaintenance(payload.formData);
    } else {
      result = submitDailyCheck(payload.formData, payload.fileDataArray);
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fungsi untuk mengambil data dropdown & Dashboard
 */
function getInitialData() {
  const ss = SpreadsheetApp.openById(SS_ID);
  
  const officers = ss.getSheetByName("REF_OFFICERS").getDataRange().getValues();
  const gates = ss.getSheetByName("REF_GATES").getDataRange().getValues();
  const hardwares = ss.getSheetByName("REF_HARDWARE").getDataRange().getValues();
  
  // Map Gates dan Ekstrak Lokasi
  const gateRows = gates.slice(1);
  const gateMap = {};
  const gatesList = [];
  
  gateRows.forEach(r => {
    if (r[0]) {
      const lokasi = r[2] ? String(r[2]).trim() : "Lainnya";
      gateMap[r[0]] = lokasi; // Berdasarkan ID
      gateMap[r[1]] = lokasi; // Berdasarkan Nama
      gateMap[`${r[0]} - ${r[1]}`] = lokasi; // Berdasarkan format gabungan
      gatesList.push({ id: r[0], nama: r[1], lokasi: lokasi });
    }
  });

  // Proses Baseline & Timeline Events
  const allHardwares = hardwares.slice(1).map(r => String(r[1]).trim()).filter(Boolean);
  const latestStateMap = {};
  
  // 1. BASELINE: Semua alat di-set PASS pada awalnya
  gatesList.forEach(g => {
    allHardwares.forEach(hw => {
      latestStateMap[`${g.id}_${hw}`] = {
        gateId: g.id, lokasi: g.lokasi, hardware: hw, 
        status: 'PASS', date: '-', tglStr: '-', petugas: '-', keterangan: 'Baseline (Belum ada riwayat)', foto: ''
      };
    });
  });

  const allEvents = [];

  // 2. Kumpulkan Log Pengecekan Harian (Daily Check)
  const dailySheet = ss.getSheetByName("LOG_DAILY_CHECK");
  if (dailySheet) {
    const dailyData = dailySheet.getDataRange().getValues().slice(1);
    dailyData.forEach(row => {
      if (!row[0]) return;
      let ts = row[0] instanceof Date ? row[0].getTime() : new Date(row[0]).getTime();
      if (isNaN(ts)) ts = Date.now(); // Fallback aman
      
      allEvents.push({
        time: ts,
        type: 'DAILY', gateId: row[2], hardware: row[3], status: row[4],
        date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+7", "dd/MM/yyyy HH:mm") : row[1],
        tglStr: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd") : String(row[1]).substring(0, 10),
        petugas: row[5], keterangan: row[6], foto: row[7]
      });
    });
  }

  // 3. Kumpulkan Log Perbaikan (Maintenance)
  const maintSheet = ss.getSheetByName("LOG_MAINTENANCE");
  if (maintSheet) {
    const maintData = maintSheet.getDataRange().getValues().slice(1);
    maintData.forEach(row => {
      if (!row[0]) return;
      const status = String(row[8]).toUpperCase();
      let eventTime = 0;
      
      let dTime = row[5]; // Tgl Selesai
      if (!dTime) dTime = row[1]; // Fallback ke Tgl Lapor
      if (!dTime) dTime = row[0]; // Fallback ke Timestamp pembuatan tiket
      eventTime = dTime instanceof Date ? dTime.getTime() : new Date(dTime).getTime();
      if (isNaN(eventTime)) eventTime = Date.now();

      if (status === 'CLOSED') {
         allEvents.push({
           time: eventTime,
           type: 'MAINT', gateId: row[2], hardware: row[3], status: 'PASS', // Tiket Closed = Alat Sembuh
           date: row[5] instanceof Date ? Utilities.formatDate(row[5], "GMT+7", "dd/MM/yyyy HH:mm") : (row[5] || "-"),
           tglStr: row[5] instanceof Date ? Utilities.formatDate(row[5], "GMT+7", "yyyy-MM-dd") : String(row[5] || "").substring(0, 10),
           petugas: row[7], keterangan: 'Perbaikan Selesai: ' + row[6], foto: ''
         });
      } else {
         let openTime = row[1];
         if (!openTime) openTime = row[0];
         let evOpenTime = openTime instanceof Date ? openTime.getTime() : new Date(openTime).getTime();
         if (isNaN(evOpenTime)) evOpenTime = Date.now();
         
         allEvents.push({
           time: evOpenTime,
           type: 'MAINT', gateId: row[2], hardware: row[3], status: 'FAIL', // Tiket Open = Alat Rusak
           date: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "dd/MM/yyyy HH:mm") : (row[1] || "-"),
           tglStr: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "yyyy-MM-dd") : String(row[1] || "").substring(0, 10),
           petugas: row[7], keterangan: 'Tiket Open: ' + row[4], foto: ''
         });
      }
    });
  }

  // 4. Urutkan Waktu Kejadian dari terlama ke terbaru (Chronological)
  allEvents.sort((a, b) => a.time - b.time);

  // 5. Simulasikan Kejadian (Event Sourcing) untuk mendapatkan State Terkini
  allEvents.forEach(ev => {
    const hws = String(ev.hardware).split(',').map(s => s.trim()).filter(Boolean);
    
    if (ev.type === 'DAILY' && hws.includes("Semua Hardware Normal")) {
       // Pengecekan umum: Tidak boleh menimpa alat yang saat ini masih FAIL (tiket belum ditutup)
       allHardwares.forEach(hw => {
          const key = `${ev.gateId}_${hw}`;
          if (latestStateMap[key] && latestStateMap[key].status === 'PASS') {
             latestStateMap[key].date = ev.date;
             latestStateMap[key].tglStr = ev.tglStr;
             latestStateMap[key].petugas = ev.petugas;
             latestStateMap[key].keterangan = ev.keterangan;
             latestStateMap[key].foto = ev.foto || "";
          }
       });
    } else {
       // Pengecekan spesifik / Laporan Rusak / Laporan Perbaikan
       hws.forEach(hw => {
          const key = `${ev.gateId}_${hw}`;
          if (latestStateMap[key]) {
            latestStateMap[key].status = ev.status;
            latestStateMap[key].date = ev.date;
            latestStateMap[key].tglStr = ev.tglStr;
            latestStateMap[key].petugas = ev.petugas;
            latestStateMap[key].keterangan = ev.keterangan;
            latestStateMap[key].foto = ev.foto || "";
          }
       });
    }
  });

  // 6. BUILD FINAL STATE DARI REF_HARDWARE SEBAGAI SOURCE OF TRUTH UTAMA
  const hwSheetData = ss.getSheetByName("REF_HARDWARE").getDataRange().getValues().slice(1);
  const finalStateLogs = [];
  
  hwSheetData.forEach(row => {
    if (!row[1]) return;
    const hwName = String(row[1]).trim();
    const statusAktif = String(row[4] || "PASS").toUpperCase(); // Kolom E
    const lokasiAktif = String(row[5] || "").trim() || "Lainnya"; // Kolom F
    const gateIdRef = String(row[6] || "").trim(); // Kolom G (ID_Gate)
    
    // Cari metadata (keterangan, petugas, tanggal) dari event sourcing secara akurat
    const key = `${gateIdRef}_${hwName}`;
    const latestInfo = latestStateMap[key];
    
    finalStateLogs.push({
      gateId: gateIdRef || (latestInfo ? latestInfo.gateId : "-"),
      lokasi: lokasiAktif, // Lokasi absolut dari REF_HARDWARE Kolom F
      hardware: hwName,
      status: statusAktif, // Status absolut dari REF_HARDWARE Kolom E
      date: latestInfo ? latestInfo.date : "-",
      tglStr: latestInfo ? latestInfo.tglStr : "-",
      petugas: latestInfo ? latestInfo.petugas : "-",
      keterangan: latestInfo ? latestInfo.keterangan : "Baseline (Belum ada riwayat)",
      foto: latestInfo ? latestInfo.foto : ""
    });
  });

  const currentStateLogs = finalStateLogs;
  const recentIssues = currentStateLogs.filter(log => log.status === 'FAIL' || log.status === 'WARNING');


  return {
    officers: officers.slice(1).map(r => r[1]).filter(String),
    gates: gatesList,
    hardwares: ["Semua Hardware Normal", ...hardwares.slice(1).map(r => r[1]).filter(String)],
    todayLogs: currentStateLogs, // Array state terkini
    recentIssues: recentIssues
  };
}

/**
 * Helper untuk mengupdate Status_Aktif di REF_HARDWARE Kolom E (Index 5)
 */
function updateHardwareStatus(ss, hardwareString, newStatus, gateId) {
  try {
    const hwSheet = ss.getSheetByName("REF_HARDWARE");
    if (!hwSheet) return;
    const hwData = hwSheet.getDataRange().getValues();
    const submittedHws = String(hardwareString).split(',').map(s => s.trim()).filter(Boolean);
    
    for (let i = 1; i < hwData.length; i++) {
      const hwName = String(hwData[i][1]).trim();
      const hwGateId = String(hwData[i][6] || "").trim(); // Kolom G (ID_Gate)
      let shouldUpdate = false;
      
      if (submittedHws.includes("Semua Hardware Normal")) {
        // Cocokkan berdasarkan ID_Gate di Kolom G
        if (hwGateId === String(gateId).trim()) {
          shouldUpdate = true;
        }
      } else {
        if (submittedHws.includes(hwName)) {
          shouldUpdate = true;
        }
      }
      
      if (shouldUpdate) {
        hwSheet.getRange(i + 1, 5).setValue(newStatus); // Kolom E (Status_Aktif)
      }
    }
  } catch (e) {
    console.log("Gagal update REF_HARDWARE: " + e.toString());
  }
}

/**
 * Fungsi Submit Daily Check
 */
function submitDailyCheck(formData, fileDataArray) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName("LOG_DAILY_CHECK");
    const timestamp = new Date();
    
    let fileUrls = [];
    if (fileDataArray && Array.isArray(fileDataArray)) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      fileDataArray.forEach((fileData, idx) => {
        const fileName = `CHECK_${formData.gateId}_${Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd_HHmm")}_${idx+1}`;
        const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.type, fileName);
        const file = folder.createFile(blob);
        fileUrls.push(file.getUrl());
      });
    }

    const fileUrlStr = fileUrls.join(" ,");

    const watermark = `Petugas: ${formData.petugas} | Gate: ${formData.gateId} | Lokasi: ${formData.lokasi} | Waktu: ${timestamp}`;

    sheet.appendRow([
      timestamp,
      Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd"),
      formData.gateId,
      formData.hardware,
      formData.status,
      formData.petugas,
      formData.keterangan,
      fileUrlStr,
      "", 
      "", 
      watermark
    ]);

    if (formData.status === "FAIL" || formData.status === "WARNING") {
      try {
        sendUrgentNotification(formData, fileUrlStr, 'DAILY CHECK');
      } catch (mailError) {
        console.log("Email error: " + mailError.toString());
      }
      
      // AUTO-TICKETING LOGIC
      try {
        const maintSheet = ss.getSheetByName("LOG_MAINTENANCE");
        if (maintSheet) {
          const maintData = maintSheet.getDataRange().getValues();
          const submittedHws = String(formData.hardware).split(',').map(s => s.trim()).filter(Boolean);
          
          if (!submittedHws.includes("Semua Hardware Normal")) {
            submittedHws.forEach(hw => {
              let ticketExists = false;
              for (let i = maintData.length - 1; i > 0; i--) {
                if (maintData[i][2] === formData.gateId && maintData[i][3] === hw && (maintData[i][8] === 'Open' || maintData[i][8] === 'In Progress')) {
                  ticketExists = true;
                  break;
                }
              }
              if (!ticketExists) {
                maintSheet.appendRow([
                  `TKT-${Utilities.formatDate(timestamp, "GMT+7", "yyyyMMddHHmmss")}-${Math.floor(Math.random() * 1000)}`,
                  Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd"),
                  formData.gateId,
                  hw,
                  formData.keterangan || "Ditemukan saat pengecekan harian",
                  "", "", "", "Open"
                ]);
              }
            });
          }
        }
      } catch (ticketError) {
        console.log("Auto-ticket error: " + ticketError.toString());
      }
    }

    // UPDATE STATUS AKTIF KE REF_HARDWARE (KOLOM E)
    updateHardwareStatus(ss, formData.hardware, formData.status, formData.gateId);

    return { success: true, message: "Data Daily Check berhasil disimpan!" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Fungsi Submit Maintenance
 */
function submitMaintenance(formData) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName("LOG_MAINTENANCE");
    if (!sheet) return { success: false, message: "Sheet LOG_MAINTENANCE tidak ditemukan" };
    
    const timestamp = new Date();
    const tglLapor = formData.tglLapor || Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd");
    
    const maintData = sheet.getDataRange().getValues();
    let targetRowIndex = -1;
    let existingIdTiket = "";
    
    // Cari tiket yang masih Open/In Progress untuk Gate dan Hardware ini
    for (let i = maintData.length - 1; i > 0; i--) {
      if (maintData[i][2] === formData.gateId && maintData[i][3] === formData.hardware && maintData[i][8] !== 'Closed') {
        targetRowIndex = i + 1; // getRange is 1-indexed
        existingIdTiket = maintData[i][0];
        break;
      }
    }
    
    if (targetRowIndex !== -1) {
      // UPDATE TIKET YANG ADA
      const oldMasalah = maintData[targetRowIndex - 1][4];
      let newMasalah = formData.masalah;
      if (oldMasalah && newMasalah && oldMasalah !== newMasalah) {
        newMasalah = oldMasalah + "\nUpdate: " + newMasalah;
      } else if (!newMasalah) {
        newMasalah = oldMasalah;
      }
      
      sheet.getRange(targetRowIndex, 5).setValue(newMasalah); // Masalah
      sheet.getRange(targetRowIndex, 6).setValue(formData.tglSelesai || ""); // Tgl Selesai
      sheet.getRange(targetRowIndex, 7).setValue(formData.tindakan || ""); // Tindakan
      sheet.getRange(targetRowIndex, 8).setValue(formData.teknisi); // Teknisi
      sheet.getRange(targetRowIndex, 9).setValue(formData.statusTiket); // Status
      
      const watermark = `Updated by: ${formData.teknisi} | Gate: ${formData.gateId} | Tiket: ${existingIdTiket} | Waktu: ${timestamp}`;
      sheet.getRange(targetRowIndex, 10).setValue(watermark);
      
      // UPDATE STATUS AKTIF KE REF_HARDWARE (KOLOM E)
      let finalStatus = formData.statusTiket;
      if (finalStatus.toUpperCase() === 'CLOSED') finalStatus = 'PASS';
      else if (finalStatus.toUpperCase() === 'OPEN' || finalStatus.toUpperCase() === 'IN PROGRESS') finalStatus = 'FAIL';
      updateHardwareStatus(ss, formData.hardware, finalStatus, formData.gateId);
      
      return { success: true, message: "Tiket Maintenance berhasil diupdate!" };
      
    } else {
      // BUAT TIKET BARU JIKA TIDAK DITEMUKAN
      const idTiket = "MT-" + Utilities.formatDate(timestamp, "GMT+7", "yyyyMMddHHmmss");
      const watermark = `Teknisi: ${formData.teknisi} | Gate: ${formData.gateId} | Tiket: ${idTiket}`;

      sheet.appendRow([
        idTiket, tglLapor, formData.gateId, formData.hardware, formData.masalah,
        formData.tglSelesai || "", formData.tindakan || "", formData.teknisi,
        formData.statusTiket, watermark
      ]);

      // UPDATE STATUS AKTIF KE REF_HARDWARE (KOLOM E)
      let finalStatus = formData.statusTiket;
      if (finalStatus.toUpperCase() === 'CLOSED') finalStatus = 'PASS';
      else if (finalStatus.toUpperCase() === 'OPEN' || finalStatus.toUpperCase() === 'IN PROGRESS') finalStatus = 'FAIL';
      updateHardwareStatus(ss, formData.hardware, finalStatus, formData.gateId);

      return { success: true, message: "Tiket Maintenance baru berhasil dibuat!" };
    }
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * Fungsi Kirim Email Otomatis
 */
function sendUrgentNotification(data, photoLink, type) {
  const recipient = "email-teknis@perusahaan.com"; 
  const subject = `[${data.status}] ${type} di ${data.gateId} (${data.hardware})`;
  
  const body = `
    Ditemukan anomali/kerusakan:
    
    Status: ${data.status}
    Petugas/Teknisi: ${data.petugas || data.teknisi}
    Lokasi: ${data.lokasi || '-'}
    Unit: ${data.gateId}
    Alat: ${data.hardware}
    Keterangan/Masalah: ${data.keterangan || data.masalah}
    
    Link Foto: ${photoLink || 'Tidak ada foto'}
    
    Mohon segera ditindaklanjuti.
  `;
  
  MailApp.sendEmail(recipient, subject, body);
}