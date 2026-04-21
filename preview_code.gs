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
      result = submitDailyCheck(payload.formData, payload.fileData);
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
  
  // Dashboard Data
  let stats = { pass: 0, warning: 0, fail: 0 };
  let recentIssues = [];
  
  const dailySheet = ss.getSheetByName("LOG_DAILY_CHECK");
  if (dailySheet) {
    const dailyLogs = dailySheet.getDataRange().getValues();
    if (dailyLogs.length > 1) {
      const logsData = dailyLogs.slice(1);
      
      // Ambil data hari ini saja untuk stats
      const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
      
      logsData.forEach(row => {
        const tglStr = String(row[1]).substring(0, 10);
        if (tglStr === today || true) { // kita hitung semua dulu sementara
          const status = row[4];
          if (status === 'PASS') stats.pass++;
          else if (status === 'WARNING') stats.warning++;
          else if (status === 'FAIL') stats.fail++;
        }
      });
      
      // 5 Issue Terbaru (Warning / Fail)
      recentIssues = logsData
        .filter(row => row[4] === 'FAIL' || row[4] === 'WARNING')
        .slice(-5)
        .map(row => ({
          date: row[1] instanceof Date ? Utilities.formatDate(row[1], "GMT+7", "dd/MM/yyyy") : row[1],
          gate: row[2],
          hardware: row[3],
          status: row[4],
          petugas: row[5]
        })).reverse();
    }
  }

  return {
    officers: officers.slice(1).map(r => r[1]).filter(String),
    gates: gates.slice(1).map(r => ({id: r[0], nama: r[1]})).filter(g => g.id),
    hardwares: hardwares.slice(1).map(r => r[1]).filter(String),
    stats: stats,
    recentIssues: recentIssues
  };
}

/**
 * Fungsi Submit Daily Check
 */
function submitDailyCheck(formData, fileData) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = ss.getSheetByName("LOG_DAILY_CHECK");
    const timestamp = new Date();
    
    let fileUrl = "";
    if (fileData) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const fileName = `CHECK_${formData.gateId}_${Utilities.formatDate(timestamp, "GMT+7", "yyyyMMdd_HHmm")}`;
      const blob = Utilities.newBlob(Utilities.base64Decode(fileData.data), fileData.type, fileName);
      const file = folder.createFile(blob);
      fileUrl = file.getUrl();
    }

    const watermark = `Petugas: ${formData.petugas} | Gate: ${formData.gateId} | Waktu: ${timestamp}`;

    sheet.appendRow([
      timestamp,
      Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd"),
      formData.gateId,
      formData.hardware,
      formData.status,
      formData.petugas,
      formData.keterangan,
      fileUrl,
      "", 
      "", 
      watermark
    ]);

    if (formData.status === "FAIL" || formData.status === "WARNING") {
      sendUrgentNotification(formData, fileUrl, 'DAILY CHECK');
    }

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
    const idTiket = "MT-" + Utilities.formatDate(timestamp, "GMT+7", "yyyyMMddHHmmss");
    
    const watermark = `Teknisi: ${formData.teknisi} | Gate: ${formData.gateId} | Tiket: ${idTiket}`;

    sheet.appendRow([
      idTiket,
      tglLapor,
      formData.gateId,
      formData.hardware,
      formData.masalah,
      formData.tglSelesai,
      formData.tindakan,
      formData.teknisi,
      formData.statusTiket,
      watermark
    ]);

    return { success: true, message: "Tiket Maintenance berhasil dibuat/diupdate!" };
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
    Unit: ${data.gateId}
    Alat: ${data.hardware}
    Keterangan/Masalah: ${data.keterangan || data.masalah}
    
    Link Foto: ${photoLink || 'Tidak ada foto'}
    
    Mohon segera ditindaklanjuti.
  `;
  
  MailApp.sendEmail(recipient, subject, body);
}