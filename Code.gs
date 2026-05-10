// ===================================================
// Dusit Connect — Code.gs
// ===================================================

const SH_STAFF       = "พนักงาน";
const SH_ROOMS       = "ห้อง";
const SH_LOG         = "ประวัติ";
const SH_COMPLAINTS  = "ข้อร้องเรียน";

// ห้อง columns (0-indexed):
// 0=ห้อง  1=ชั้น  2=วันที่  3=Status  4=assignedTo  5=assignedName  6=startTime  7=endTime  8=หมายเหตุ

function todayStr() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function fmtDate(d) {
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Dusit Connect API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const req = JSON.parse(e.postData.contents);
    let res = {};
    switch (req.action) {
      case "login":          res = login(req.username, req.password); break;
      case "getRooms":       res = getRooms(req.role, req.staffId, req.date, req.showAll); break;
      case "getStaff":       res = getStaff(); break;
      case "updateStatus":   res = updateStatus(req); break;
      case "assignRoom":     res = assignRoom(req); break;
      case "inspect":        res = inspect(req); break;
      case "ackRoom":        res = ackRoom(req); break;
      case "getReport":      res = getReport(req.startDate, req.endDate); break;
      case "getPerformance": res = getPerformance(req.startDate, req.endDate); break;
      case "logComplaint":   res = logComplaint(req); break;
      case "getComplaints":  res = getComplaints(req.startDate, req.endDate, req.assignedName); break;
      case "getStaffReport": res = getStaffReport(req.startDate, req.endDate); break;
      case "adminSetStatus": res = adminSetStatus(req); break;
      case "initDaily":      res = initDaily(req.date); break;
      case "initSheets":     res = initSheets(); break;
      case "seedTestData":   res = seedTestData(); break;
      default: res = { success: false, message: "Unknown action" };
    }
    out.setContent(JSON.stringify(res));
  } catch(err) {
    Logger.log(err.toString());
    out.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
  return out;
}

function login(username, password) {
  if (!username || !password)
    return { success: false, message: "กรุณากรอก Username และ Password" };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_STAFF);
  if (!sheet) return { success: false, message: "ไม่พบข้อมูลพนักงาน กรุณาติดต่อ Admin" };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[0]).toLowerCase() === String(username).toLowerCase() &&
        String(row[1]) === String(password)) {
      if (row[5] && String(row[5]).toLowerCase() !== "active")
        return { success: false, message: "บัญชีนี้ถูกระงับการใช้งาน" };
      return { success: true, staffId: String(row[0]), name: String(row[2]), nickname: String(row[3]), role: String(row[4]) };
    }
  }
  return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
}

function getRooms(role, staffId, date, showAll) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_ROOMS);
  if (!sheet) return { success: true, rooms: [] };
  const targetDate = date || todayStr();
  const data = sheet.getDataRange().getValues();

  // Front Desk with showAll: return FULL hotel (250 rooms), fill from sheet
  if (role === "frontdesk" && showAll) {
    const sheetMap = {};
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r[0]) continue;
      const rowDate = r[2] ? fmtDate(r[2]) : "";
      if (rowDate !== targetDate) continue;
      sheetMap[String(r[0])] = {
        id: String(r[0]), floor: Number(r[1]), date: rowDate,
        status: String(r[3] || "pending"),
        assignedTo: String(r[4] || ""), assignedName: String(r[5] || ""),
        startTime: r[6] ? new Date(r[6]).getTime() : null,
        endTime:   r[7] ? new Date(r[7]).getTime() : null,
        note: String(r[8] || ""),
      };
    }
    const rooms = [];
    for (let f = 8; f <= 38; f++) {
      if (f === 13) continue;
      for (let n = 1; n <= 9; n++) {
        const roomId = String(f) + String(n).padStart(2, "0");
        if (roomId.endsWith("4")) continue;
        rooms.push(sheetMap[roomId] || {
          id: roomId, floor: f, date: targetDate,
          status: "pending", assignedTo: "", assignedName: "",
          startTime: null, endTime: null, note: "",
        });
      }
    }
    return { success: true, rooms };
  }

  // All other roles: read from sheet only
  const rooms = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    const rowDate = r[2] ? fmtDate(r[2]) : "";
    if (rowDate !== targetDate) continue;
    const room = {
      id: String(r[0]), floor: Number(r[1]), date: rowDate,
      status: String(r[3]),
      assignedTo: String(r[4] || ""), assignedName: String(r[5] || ""),
      startTime: r[6] ? new Date(r[6]).getTime() : null,
      endTime:   r[7] ? new Date(r[7]).getTime() : null,
      note: String(r[8] || ""),
    };
    if (role === "housekeeper" && room.assignedTo !== staffId) continue;
    rooms.push(room);
  }
  return { success: true, rooms };
}

function getStaff() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_STAFF);
  if (!sheet) return { success: true, staff: [] };
  const data = sheet.getDataRange().getValues();
  const staff = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[4]).toLowerCase() === "housekeeper" &&
        (!row[5] || String(row[5]).toLowerCase() === "active"))
      staff.push({ id: String(row[0]), name: String(row[2]), nickname: String(row[3]) });
  }
  return { success: true, staff };
}

function findRow(sheet, roomId, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
    if (String(data[i][0]) === String(roomId) && rowDate === date) return i + 1;
  }
  return -1;
}

function updateStatus(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  const row = findRow(sheet, req.roomId, date);
  if (row < 0) return { success: false, message: "ไม่พบห้อง" };
  sheet.getRange(row, 4).setValue(req.status);
  if (req.status === "cleaning") sheet.getRange(row, 7).setValue(new Date());
  if (req.status === "done")     sheet.getRange(row, 8).setValue(new Date());
  log(req.roomId, req.staffId, req.staffName, req.status, "");
  return { success: true };
}

function assignRoom(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  const row = findRow(sheet, req.roomId, date);
  if (row < 0) return { success: false, message: "ไม่พบห้อง" };
  sheet.getRange(row, 4).setValue("pending");
  sheet.getRange(row, 5).setValue(req.staffId);
  sheet.getRange(row, 6).setValue(req.staffName);
  sheet.getRange(row, 7).setValue("");
  sheet.getRange(row, 8).setValue("");
  sheet.getRange(row, 9).setValue(req.note || "");
  log(req.roomId, req.supervisorId, req.supervisorName, "assigned", req.staffName);
  return { success: true };
}

function inspect(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  const row = findRow(sheet, req.roomId, date);
  if (row < 0) return { success: false, message: "ไม่พบห้อง" };
  if (req.result === "passed") {
    sheet.getRange(row, 4).setValue("passed");
    sheet.getRange(row, 9).setValue(req.note || "");
  } else {
    sheet.getRange(row, 4).setValue("pending");
    if (req.newStaffId)   sheet.getRange(row, 5).setValue(req.newStaffId);
    if (req.newStaffName) sheet.getRange(row, 6).setValue(req.newStaffName);
    sheet.getRange(row, 7).setValue("");
    sheet.getRange(row, 8).setValue("");
    sheet.getRange(row, 9).setValue(req.note || "ตรวจไม่ผ่าน กรุณาทำใหม่");
  }
  log(req.roomId, req.supervisorId, req.supervisorName,
      req.result === "passed" ? "passed" : "failed", req.note || "");
  return { success: true };
}

function ackRoom(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  const row = findRow(sheet, req.roomId, date);
  if (row < 0) return { success: false, message: "ไม่พบห้อง" };
  sheet.getRange(row, 4).setValue("ack");
  log(req.roomId, req.staffId, req.staffName, "ack", "");
  return { success: true };
}

function getReport(startDate, endDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  if (!sheet) return { success: true, byDate: [] };
  const data = sheet.getDataRange().getValues();
  const byDate = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
    if (!rowDate) continue;
    if (startDate && rowDate < startDate) continue;
    if (endDate   && rowDate > endDate)   continue;
    const status = String(data[i][3]);
    byDate[rowDate] = byDate[rowDate] || { date:rowDate, pending:0, cleaning:0, done:0, passed:0, ack:0, total:0 };
    byDate[rowDate][status] = (byDate[rowDate][status] || 0) + 1;
    byDate[rowDate].total++;
  }
  return { success: true, byDate: Object.values(byDate).sort((a,b) => b.date.localeCompare(a.date)) };
}

function initDaily(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_ROOMS);
  if (!sheet) return { success: false, message: "ไม่พบ Sheet ห้อง" };
  const targetDate = date || todayStr();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
    if (rowDate === targetDate) return { success: false, message: "มีข้อมูลของวันนี้แล้ว" };
  }
  const rows = [];
  for (let f = 8; f <= 38; f++) {
    if (f === 13) continue;
    for (let n = 1; n <= 9; n++) {
      const room = String(f) + String(n).padStart(2, "0");
      if (room.endsWith("4")) continue;
      rows.push([room, f, targetDate, "pending", "", "", "", "", ""]);
    }
  }
  if (rows.length > 0)
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  return { success: true, count: rows.length };
}

function getPerformance(startDate, endDate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  if (!sheet) return { success: true, byStaff: [] };
  const data = sheet.getDataRange().getValues();
  const byStaff = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
    if (startDate && rowDate < startDate) continue;
    if (endDate   && rowDate > endDate)   continue;
    const status = String(data[i][3]);
    if (!["done","passed"].includes(status)) continue;
    const startMs = data[i][6] ? new Date(data[i][6]).getTime() : null;
    const endMs   = data[i][7] ? new Date(data[i][7]).getTime() : null;
    if (!startMs || !endMs || endMs <= startMs) continue;
    const dur = endMs - startMs;
    const name = String(data[i][5] || "");
    if (!name) continue;
    if (!byStaff[name]) byStaff[name] = { name, count: 0, totalMs: 0 };
    byStaff[name].count++;
    byStaff[name].totalMs += dur;
  }
  const result = Object.values(byStaff)
    .map(s => ({ name: s.name, count: s.count, avgDuration: Math.round(s.totalMs / s.count) }))
    .sort((a, b) => a.avgDuration - b.avgDuration);
  return { success: true, byStaff: result };
}

function log(roomId, userId, userName, action, note) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SH_LOG);
  if (!sh) {
    sh = ss.insertSheet(SH_LOG);
    sh.appendRow(["Timestamp","ห้อง","User ID","ชื่อ","Action","หมายเหตุ"]);
  }
  sh.appendRow([new Date(), roomId, userId, userName, action, note]);
}

function logComplaint(req) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SH_COMPLAINTS);
  if (!sh) {
    sh = ss.insertSheet(SH_COMPLAINTS);
    sh.appendRow(["Timestamp","วันที่","ห้อง","ชั้น","assignedTo","assignedName","reportedBy","reportedByName","รายละเอียด"]);
    const h = sh.getRange(1,1,1,9);
    h.setBackground("#1a237e"); h.setFontColor("#fff"); h.setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  const roomSheet = ss.getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  let assignedTo = "", assignedName = "", floor = req.floor || "";
  if (roomSheet) {
    const row = findRow(roomSheet, req.roomId, date);
    if (row > 0) {
      const d = roomSheet.getRange(row, 1, 1, 9).getValues()[0];
      assignedTo = d[4] || ""; assignedName = d[5] || ""; floor = d[1] || floor;
    }
  }
  sh.appendRow([new Date(), date, req.roomId, floor, assignedTo, assignedName, req.staffId, req.staffName, req.description]);
  log(req.roomId, req.staffId, req.staffName, "complaint", req.description);
  return { success: true };
}

function getComplaints(startDate, endDate, filterStaff) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_COMPLAINTS);
  if (!sh) return { success: true, complaints: [] };
  const data = sh.getDataRange().getValues();
  const complaints = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const rowDate = r[1] ? fmtDate(r[1]) : "";
    if (startDate && rowDate < startDate) continue;
    if (endDate   && rowDate > endDate)   continue;
    if (filterStaff && String(r[5]) !== filterStaff) continue;
    complaints.push({
      timestamp:      r[0] ? new Date(r[0]).getTime() : null,
      date:           rowDate,
      roomId:         String(r[2]),
      floor:          r[3],
      assignedTo:     String(r[4] || ""),
      assignedName:   String(r[5] || ""),
      reportedBy:     String(r[6] || ""),
      reportedByName: String(r[7] || ""),
      description:    String(r[8] || "")
    });
  }
  return { success: true, complaints: complaints.reverse() };
}

function getStaffReport(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roomSheet = ss.getSheetByName(SH_ROOMS);
  const compSheet = ss.getSheetByName(SH_COMPLAINTS);
  const byStaff = {};

  if (roomSheet) {
    const data = roomSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
      if (startDate && rowDate < startDate) continue;
      if (endDate   && rowDate > endDate)   continue;
      const name = String(data[i][5] || ""); if (!name) continue;
      if (!byStaff[name]) byStaff[name] = { name, totalRooms:0, completedRooms:0, totalMs:0, timingCount:0, complaints:0, complaintList:[] };
      byStaff[name].totalRooms++;
      const status = String(data[i][3]);
      if (["done","passed"].includes(status)) {
        byStaff[name].completedRooms++;
        const s0 = data[i][6] ? new Date(data[i][6]).getTime() : null;
        const e0 = data[i][7] ? new Date(data[i][7]).getTime() : null;
        if (s0 && e0 && e0 > s0) { byStaff[name].totalMs += (e0-s0); byStaff[name].timingCount++; }
      }
    }
  }

  if (compSheet) {
    const cdata = compSheet.getDataRange().getValues();
    for (let i = 1; i < cdata.length; i++) {
      const rowDate = cdata[i][1] ? fmtDate(cdata[i][1]) : "";
      if (startDate && rowDate < startDate) continue;
      if (endDate   && rowDate > endDate)   continue;
      const name = String(cdata[i][5] || ""); if (!name) continue;
      if (!byStaff[name]) byStaff[name] = { name, totalRooms:0, completedRooms:0, totalMs:0, timingCount:0, complaints:0, complaintList:[] };
      byStaff[name].complaints++;
      byStaff[name].complaintList.push({ date:rowDate, roomId:String(cdata[i][2]), description:String(cdata[i][8]||""), reportedByName:String(cdata[i][7]||"") });
    }
  }

  const result = Object.values(byStaff).map(s => ({
    name: s.name,
    totalRooms: s.totalRooms,
    completedRooms: s.completedRooms,
    avgDuration: s.timingCount > 0 ? Math.round(s.totalMs / s.timingCount) : 0,
    complaints: s.complaints,
    complaintList: s.complaintList.slice(-20)
  })).sort((a,b) => b.complaints - a.complaints || a.avgDuration - b.avgDuration);
  return { success: true, byStaff: result };
}

function adminSetStatus(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const date = req.date || todayStr();
  const row = findRow(sheet, req.roomId, date);
  if (row < 0) return { success: false, message: "ไม่พบห้อง" };
  sheet.getRange(row, 4).setValue(req.status);
  if (req.assignedTo)       sheet.getRange(row, 5).setValue(req.assignedTo);
  if (req.assignedName)     sheet.getRange(row, 6).setValue(req.assignedName);
  if (req.note !== undefined) sheet.getRange(row, 9).setValue(req.note);
  if (req.status === "cleaning") sheet.getRange(row, 7).setValue(new Date());
  if (req.status === "done")     sheet.getRange(row, 8).setValue(new Date());
  if (["pending","passed"].includes(req.status) && req.clearTimes) {
    sheet.getRange(row, 7).setValue(""); sheet.getRange(row, 8).setValue("");
  }
  log(req.roomId, req.staffId, req.staffName, "admin_override:"+req.status, req.note||"");
  return { success: true };
}

function seedTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roomSheet  = ss.getSheetByName(SH_ROOMS);
  const staffSheet = ss.getSheetByName(SH_STAFF);
  if (!roomSheet || !staffSheet) return { success: false, message: "ไม่พบ Sheets" };

  // ─── Ensure enough housekeepers ───────────────────────
  const extraStaff = [
    ["hk005","1234","นภา ทองดี","นภา","housekeeper","active"],
    ["hk006","1234","กัญญา ใจงาม","กัญญา","housekeeper","active"],
    ["hk007","1234","มยุรี แสงจันทร์","มยุรี","housekeeper","active"],
    ["hk008","1234","ฝน พรมดี","ฝน","housekeeper","active"],
    ["hk009","1234","จิรา สุขใจ","จิรา","housekeeper","active"],
    ["hk010","1234","ดาว ชมพู","ดาว","housekeeper","active"],
    ["hk011","1234","Aye Aye","Aye","housekeeper","active"],
    ["hk012","1234","Phyu Phyu","Phyu","housekeeper","active"],
    ["hk013","1234","Moe Moe","Moe","housekeeper","active"],
    ["hk014","1234","Su Su","Su","housekeeper","active"],
    ["hk015","1234","Win Win","Win","housekeeper","active"],
  ];
  const existingIds = staffSheet.getDataRange().getValues().slice(1).map(r => String(r[0]));
  extraStaff.forEach(r => { if (!existingIds.includes(r[0])) staffSheet.appendRow(r); });

  // ─── Collect all housekeepers ──────────────────────────
  const staffData = staffSheet.getDataRange().getValues().slice(1);
  const hks = staffData.filter(r => String(r[4]) === "housekeeper" && (!r[5] || String(r[5]) === "active"))
    .map(r => ({ id: String(r[0]), name: String(r[2]), nick: String(r[3]) }));
  if (hks.length === 0) return { success: false, message: "ไม่พบ housekeeper" };

  // ─── Build room list ───────────────────────────────────
  const allRooms = [];
  for (let f = 8; f <= 38; f++) {
    if (f === 13) continue;
    for (let n = 1; n <= 9; n++) {
      if (n === 4) continue;
      allRooms.push({ room: String(f) + String(n).padStart(2,"0"), floor: f });
    }
  }

  // ─── Generate 90 days of data ──────────────────────────
  const today = new Date();
  today.setHours(0,0,0,0);
  const rows = [];
  const compRows = [];

  // Check existing dates to avoid duplication
  const existingDates = new Set();
  const existing = roomSheet.getDataRange().getValues().slice(1);
  existing.forEach(r => { if (r[2]) existingDates.add(fmtDate(r[2])); });

  for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = fmtDate(d);
    if (existingDates.has(dateStr)) continue;

    // Shuffle rooms and assign to housekeepers
    const shuffled = allRooms.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach((r, i) => {
      const hk = hks[i % hks.length];
      const startH = 7 + Math.floor(i / hks.length) % 5; // stagger start 7–11am
      const startM = Math.floor(Math.random() * 60);
      const durMin = 18 + Math.floor(Math.random() * 42); // 18–60 min

      const startDt = new Date(d);
      startDt.setHours(startH, startM, 0, 0);
      const endDt   = new Date(startDt);
      endDt.setMinutes(endDt.getMinutes() + durMin);

      // All historical records use "passed" as final status (no ack step)
      const status = daysAgo <= 2 ? (Math.random()<0.3 ? "done" : "passed") : "passed";
      rows.push([r.room, r.floor, d, status, hk.id, hk.nick, startDt, endDt, ""]);
    });

    // Add 2–4 complaints per day (5 days apart roughly)
    if (daysAgo % 5 === 0) {
      const numComp = 2 + Math.floor(Math.random() * 3);
      for (let c = 0; c < numComp; c++) {
        const victim = shuffled[Math.floor(Math.random() * shuffled.length)];
        const hk = hks[Math.floor(Math.random() * hks.length)];
        const issues = [
          "แขกร้องเรียนห้องน้ำไม่สะอาด", "ผ้าปูที่นอนมีรอยเปื้อน",
          "กระจกมีคราบ", "ห้องมีกลิ่นอับ", "ผ้าเช็ดตัวไม่เพียงพอ",
          "ถังขยะไม่ได้เปลี่ยนถุง", "พรมยังมีเศษอาหาร"
        ];
        compRows.push([new Date(d), dateStr, victim.room, victim.floor,
          hk.id, hk.nick, "fd001", "วิชัย",
          issues[Math.floor(Math.random() * issues.length)]]);
      }
    }
  }

  // ─── Batch write ──────────────────────────────────────
  if (rows.length > 0)
    roomSheet.getRange(roomSheet.getLastRow()+1, 1, rows.length, 9).setValues(rows);

  let compSheet = ss.getSheetByName(SH_COMPLAINTS);
  if (!compSheet) {
    compSheet = ss.insertSheet(SH_COMPLAINTS);
    compSheet.appendRow(["Timestamp","วันที่","ห้อง","ชั้น","assignedTo","assignedName","reportedBy","reportedByName","รายละเอียด"]);
    const ch = compSheet.getRange(1,1,1,9);
    ch.setBackground("#1a237e"); ch.setFontColor("#fff"); ch.setFontWeight("bold");
    compSheet.setFrozenRows(1);
  }
  if (compRows.length > 0)
    compSheet.getRange(compSheet.getLastRow()+1, 1, compRows.length, 9).setValues(compRows);

  return { success: true, rooms: rows.length, complaints: compRows.length };
}

// ─── RESET: ล้างข้อมูลทั้งหมด เก็บแค่ header + พนักงาน ───
// รันครั้งเดียวจาก Apps Script editor: เลือก resetProductionData → Run
function resetProductionData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function clearSheetData(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  }

  clearSheetData(SH_ROOMS);       // ล้างข้อมูลห้องทั้งหมด
  clearSheetData(SH_LOG);         // ล้างประวัติทั้งหมด
  clearSheetData(SH_COMPLAINTS);  // ล้างข้อร้องเรียนทั้งหมด
  // SH_STAFF (พนักงาน) ไม่แตะ — ข้อมูลพนักงานยังอยู่ครบ

  Logger.log("✓ Reset เสร็จแล้ว — ห้อง/ประวัติ/ข้อร้องเรียน ถูกล้างแล้ว พนักงานยังอยู่ครบ");
  return { success: true, message: "Reset complete" };
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // พนักงาน
  if (!ss.getSheetByName(SH_STAFF)) {
    const sh = ss.insertSheet(SH_STAFF);
    sh.appendRow(["Username","Password","ชื่อ","ชื่อเล่น","Role","Status"]);
    [
      ["admin001","1234","ผู้ดูแลระบบ","แอดมิน","admin","active"],
      ["sup001","1234","สมชาย ดูแลดี","ชาย","supervisor","active"],
      ["hk001","1234","สมหญิง ใจดี","หญิง","housekeeper","active"],
      ["hk002","1234","มาลี รักงาน","มาลี","housekeeper","active"],
      ["hk003","1234","นุ่น สวยงาม","นุ่น","housekeeper","active"],
      ["hk004","1234","แอ๊ม ขยัน","แอ๊ม","housekeeper","active"],
      ["fd001","1234","วิชัย ต้อนรับ","วิชัย","frontdesk","active"],
      ["mgr001","1234","พิมพ์ใจ บริหาร","พิมพ์","manager","active"],
    ].forEach(r => sh.appendRow(r));
    const hdr = sh.getRange(1,1,1,6);
    hdr.setBackground("#1a237e"); hdr.setFontColor("#fff"); hdr.setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  // ห้อง — upgrade ถ้า schema เก่า (ไม่มีคอลัมน์ วันที่)
  let roomSheet = ss.getSheetByName(SH_ROOMS);
  if (roomSheet) {
    const hdr = roomSheet.getRange(1, 1, 1, roomSheet.getLastColumn()).getValues()[0];
    if (hdr[2] !== "วันที่") {
      roomSheet.clearContents();
      roomSheet.appendRow(["ห้อง","ชั้น","วันที่","Status","assignedTo","assignedName","startTime","endTime","หมายเหตุ"]);
      const h = roomSheet.getRange(1,1,1,9);
      h.setBackground("#1a237e"); h.setFontColor("#fff"); h.setFontWeight("bold");
      roomSheet.setFrozenRows(1);
    }
  } else {
    roomSheet = ss.insertSheet(SH_ROOMS);
    roomSheet.appendRow(["ห้อง","ชั้น","วันที่","Status","assignedTo","assignedName","startTime","endTime","หมายเหตุ"]);
    const h = roomSheet.getRange(1,1,1,9);
    h.setBackground("#1a237e"); h.setFontColor("#fff"); h.setFontWeight("bold");
    roomSheet.setFrozenRows(1);
  }

  // ข้อร้องเรียน
  if (!ss.getSheetByName(SH_COMPLAINTS)) {
    const csh = ss.insertSheet(SH_COMPLAINTS);
    csh.appendRow(["Timestamp","วันที่","ห้อง","ชั้น","assignedTo","assignedName","reportedBy","reportedByName","รายละเอียด"]);
    const ch = csh.getRange(1,1,1,9);
    ch.setBackground("#1a237e"); ch.setFontColor("#fff"); ch.setFontWeight("bold");
    csh.setFrozenRows(1);
  }

  const res = initDaily(todayStr());
  return { success: true, message: `สร้าง Sheets สำเร็จ (${res.count || 0} ห้อง)` };
}
