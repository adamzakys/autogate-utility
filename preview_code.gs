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
    if (e.parameter && e.parameter.action === 'export') {
      const ss = SpreadsheetApp.openById(SS_ID);
      const sheetName = e.parameter.type === 'maint' ? "LOG_MAINTENANCE" : "LOG_DAILY_CHECK";
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) throw new Error("Sheet not found");
      const data = sheet.getDataRange().getDisplayValues();
      const csvContent = data.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\n");
      return ContentService.createTextOutput(csvContent)
        .setMimeType(ContentService.MimeType.CSV)
        .downloadAsFile(sheetName + ".csv");
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
      gateMap[r[0]] = lokasi;
      gatesList.push({ id: r[0], nama: r[1], lokasi: lokasi });
    }
  });

  // Proses Logs
  let todayLogs = [];
  let recentIssues = [];
  const dailySheet = ss.getSheetByName("LOG_DAILY_CHECK");
  
  if (dailySheet) {
    const dailyLogs = dailySheet.getDataRange().getValues();
    if (dailyLogs.length > 1) {
      const logsData = dailyLogs.slice(1);
      const today = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
      
      const parsedLogs = logsData.map(row => {
        let timestampObj = row[0];
        if (!(timestampObj instanceof Date)) timestampObj = new Date(row[0]);

        let dateObj = row[1];
        if (!(dateObj instanceof Date)) dateObj = new Date(row[1]);
        
        let tglStr = "";
        if (!isNaN(dateObj.getTime())) {
          tglStr = Utilities.formatDate(dateObj, "GMT+7", "yyyy-MM-dd");
        } else {
          tglStr = String(row[1]).substring(0, 10);
        }
        
        return {
          date: !isNaN(timestampObj.getTime()) ? Utilities.formatDate(timestampObj, "GMT+7", "dd/MM/yyyy HH:mm") : row[1],
          tglStr: tglStr,
          gateId: row[2],
          lokasi: gateMap[row[2]] || "Lainnya",
          hardware: row[3],
          status: row[4],
          petugas: row[5],
          keterangan: row[6] || "-",
          foto: row[7] || ""
        };
      });

      todayLogs = parsedLogs.filter(log => log.tglStr === today);
      recentIssues = parsedLogs.filter(log => log.status === 'FAIL' || log.status === 'WARNING').slice(-20);
    }
  }

  return {
    officers: officers.slice(1).map(r => r[1]).filter(String),
    gates: gatesList,
    hardwares: hardwares.slice(1).map(r => r[1]).filter(String),
    todayLogs: todayLogs,
    recentIssues: recentIssues
  };
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
        // Abaikan error permission email agar data tetap berhasil tersimpan
        console.log("Email error: " + mailError.toString());
      }
      
      // AUTO-TICKETING LOGIC
      try {
        const maintSheet = ss.getSheetByName("LOG_MAINTENANCE");
        if (maintSheet) {
          const maintData = maintSheet.getDataRange().getValues();
          let ticketExists = false;
          // Cek dari bawah (terbaru) apakah sudah ada tiket Open untuk Gate & Hardware ini
          for (let i = maintData.length - 1; i > 0; i--) {
            if (maintData[i][2] === formData.gateId && maintData[i][3] === formData.hardware && (maintData[i][8] === 'Open' || maintData[i][8] === 'In Progress')) {
              ticketExists = true;
              break;
            }
          }
          
          if (!ticketExists) {
            const idTiket = "MT-" + Utilities.formatDate(timestamp, "GMT+7", "yyyyMMddHHmmss");
            const tglLapor = Utilities.formatDate(timestamp, "GMT+7", "yyyy-MM-dd");
            const ket = formData.keterangan || "Temuan otomatis dari Daily Check (" + formData.status + ")";
            const watermarkMaint = `System Auto | Gate: ${formData.gateId} | Tiket: ${idTiket}`;
            
            maintSheet.appendRow([
              idTiket, tglLapor, formData.gateId, formData.hardware, ket,
              "", "", formData.petugas, "Open", watermarkMaint
            ]);
          }
        }
      } catch (ticketError) {
        console.log("Auto-ticket error: " + ticketError.toString());
      }
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