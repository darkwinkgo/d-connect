// ===================================================
// Dusit Connect — Code.gs
// ===================================================

const SH_STAFF = "พนักงาน";
const SH_ROOMS = "ห้อง";
const SH_LOG   = "ประวัติ";

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
      case "bulkAssign":     res = bulkAssign(req); break;
      case "inspect":        res = inspect(req); break;
      case "getReport":      res = getReport(req.startDate, req.endDate); break;
      case "getPerformance": res = getPerformance(req.startDate, req.endDate); break;
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
          status: "unassigned", assignedTo: "", assignedName: "",
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

function bulkAssign(req) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_ROOMS);
  if (!sheet) return { success: false, message: "ไม่พบ Sheet ห้อง" };
  const date        = req.date || todayStr();
  const assignments = req.assignments || [];
  if (!assignments.length) return { success: true, count: 0 };

  // Build row-index map for today's existing data
  const data   = sheet.getDataRange().getValues();
  const rowMap = {};
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (fmtDate(data[i][2]) === date) rowMap[String(data[i][0])] = i + 1;
  }

  const newRows = [];
  const logRows = [];
  const now     = new Date();

  for (const a of assignments) {
    const rowIdx = rowMap[String(a.roomId)];
    if (rowIdx) {
      // Update existing: status=pending + staff + clear times
      sheet.getRange(rowIdx, 4, 1, 6).setValues([["pending", a.staffId, a.staffName, "", "", ""]]);
    } else {
      newRows.push([a.roomId, a.floor, date, "pending", a.staffId, a.staffName, "", "", ""]);
    }
    logRows.push([now, a.roomId, a.staffId, a.staffName, "assign", "auto"]);
  }

  // Batch-insert new room rows
  if (newRows.length)
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 9).setValues(newRows);

  // Batch-insert log rows
  let logSh = ss.getSheetByName(SH_LOG);
  if (!logSh) {
    logSh = ss.insertSheet(SH_LOG);
    logSh.appendRow(["Timestamp","ห้อง","User ID","ชื่อ","Action","หมายเหตุ"]);
  }
  if (logRows.length)
    logSh.getRange(logSh.getLastRow() + 1, 1, logRows.length, 6).setValues(logRows);

  return { success: true, count: assignments.length };
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
      rows.push([room, f, targetDate, "unassigned", "", "", "", "", ""]);
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

function getStaffReport(startDate, endDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roomSheet = ss.getSheetByName(SH_ROOMS);
  const byStaff = {};

  if (roomSheet) {
    const data = roomSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      const rowDate = data[i][2] ? fmtDate(data[i][2]) : "";
      if (startDate && rowDate < startDate) continue;
      if (endDate   && rowDate > endDate)   continue;
      const name = String(data[i][5] || ""); if (!name) continue;
      if (!byStaff[name]) byStaff[name] = { name, totalRooms:0, completedRooms:0, totalMs:0, timingCount:0 };
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

  const result = Object.values(byStaff).map(s => ({
    name: s.name,
    totalRooms: s.totalRooms,
    completedRooms: s.completedRooms,
    avgDuration: s.timingCount > 0 ? Math.round(s.totalMs / s.timingCount) : 0
  })).sort((a,b) => b.completedRooms - a.completedRooms || a.avgDuration - b.avgDuration);
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

// ─── SEED 3-MONTH TEST DATA ───────────────────────────
// รันจาก Apps Script editor: เลือก seedTestData → Run
// เติมข้อมูลย้อนหลัง 90 วัน (ข้ามวันที่มีข้อมูลอยู่แล้ว)
// ใช้แม่บ้านจาก sheet จริง — รัน addMissingStaff() ก่อนถ้ายังไม่มี
function seedTestData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roomSheet  = ss.getSheetByName(SH_ROOMS);
  const staffSheet = ss.getSheetByName(SH_STAFF);
  if (!roomSheet || !staffSheet) return { success: false, message: "ไม่พบ Sheets — รัน initSheets() ก่อน" };

  // ─── Read housekeepers from sheet ─────────────────────
  const staffData = staffSheet.getDataRange().getValues().slice(1);
  const hks = staffData
    .filter(r => String(r[4]) === "housekeeper" && (!r[5] || String(r[5]).toLowerCase() === "active"))
    .map(r => ({ id: String(r[0]), nick: String(r[3]) }));
  if (hks.length === 0) return { success: false, message: "ไม่พบ housekeeper ที่ active — รัน addMissingStaff() ก่อน" };

  // ─── Assign each housekeeper a fixed profile (capacity + speed) ──
  // capacity: max rooms per day (5–10)
  // baseMin: average cleaning duration in minutes (20–50)
  // absence: 8% daily chance of not working
  const profiles = hks.map(hk => ({
    ...hk,
    capacity: 5 + Math.floor(Math.random() * 6),    // 5–10
    baseMin:  20 + Math.floor(Math.random() * 31),   // 20–50
    absence:  0.08 + (Math.random() - 0.5) * 0.06   // 5%–11%
  }));

  // ─── Build hotel room list (same rules as app) ─────────
  const allRooms = [];
  for (let f = 8; f <= 38; f++) {
    if (f === 13) continue;
    for (let n = 1; n <= 9; n++) {
      const room = String(f) + String(n).padStart(2, "0");
      if (room.endsWith("4")) continue;
      allRooms.push({ room, floor: f });
    }
  }

  // ─── Skip dates that already have data ────────────────
  const existingDates = new Set();
  roomSheet.getDataRange().getValues().slice(1)
    .forEach(r => { if (r[2]) existingDates.add(fmtDate(r[2])); });

  // ─── Generate 90 days of room data ────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const rows = [];

  for (let daysAgo = 90; daysAgo >= 1; daysAgo--) {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    if (existingDates.has(fmtDate(d))) continue;

    // Determine which housekeepers are present today
    const present = profiles.filter(hk => Math.random() > hk.absence);
    if (present.length === 0) continue; // skip rare all-absent days

    // Shuffle rooms and distribute by each housekeeper's capacity
    const shuffled = allRooms.slice().sort(() => Math.random() - 0.5);
    let idx = 0;
    present.forEach((hk, hi) => {
      // Actual rooms taken today: ±20% variation around capacity
      const cap = Math.max(1, Math.round(hk.capacity * (0.8 + Math.random() * 0.4)));
      const myRooms = shuffled.slice(idx, idx + cap);
      idx += cap;
      if (myRooms.length === 0) return;

      // Stagger start times 7am–10am across housekeepers
      const baseStartH = 7 + Math.floor(hi / Math.max(present.length, 1) * 3);
      myRooms.forEach((r, ri) => {
        const startH  = baseStartH;
        const startM  = Math.floor(Math.random() * 55) + (ri * 2 % 5); // slight stagger
        // Duration: baseMin ± 30%, capped 15–90 min
        const durMin  = Math.min(90, Math.max(15, Math.round(hk.baseMin * (0.7 + Math.random() * 0.6))));
        const startDt = new Date(d); startDt.setHours(startH, startM, 0, 0);
        const endDt   = new Date(startDt); endDt.setMinutes(endDt.getMinutes() + durMin);
        const status  = daysAgo <= 2 ? (Math.random() < 0.3 ? "done" : "passed") : "passed";
        rows.push([r.room, r.floor, d, status, hk.id, hk.nick, startDt, endDt, ""]);
      });
    });
  }

  if (rows.length > 0)
    roomSheet.getRange(roomSheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);

  Logger.log(`✓ Seed complete: ${rows.length} rows across ${Math.round(rows.length/allRooms.length)} days`);
  return { success: true, rooms: rows.length };
}

// ─── RESET: ล้างข้อมูลทั้งหมด เก็บแค่ header + พนักงาน ───
// รันครั้งเดียวจาก Apps Script editor: เลือก resetProductionData → Run
// ─── ADD MISSING STAFF ────────────────────────────────
// รันจาก Apps Script editor: เลือก addMissingStaff → Run
// เพิ่มเฉพาะ username ที่ยังไม่มีในชีต ไม่แตะรายการเดิม
function addMissingStaff() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SH_STAFF);
  if (!sh) { Logger.log("ไม่พบ sheet พนักงาน — รัน initSheets() ก่อน"); return; }

  const existing = sh.getDataRange().getValues().slice(1).map(r => String(r[0]));

  const allStaff = [
    ["admin001","1234","ผู้ดูแลระบบ","แอดมิน","admin","active"],
    ["sup001","1234","สมชาย ดูแลดี","ชาย","supervisor","active"],
    ["sup002","1234","สุดา ใจดี","สุดา","supervisor","active"],
    ["hk001","1234","สมหญิง ใจดี","หญิง","housekeeper","active"],
    ["hk002","1234","มาลี รักงาน","มาลี","housekeeper","active"],
    ["hk003","1234","นุ่น สวยงาม","นุ่น","housekeeper","active"],
    ["hk004","1234","แอ๊ม ขยัน","แอ๊ม","housekeeper","active"],
    ["hk005","1234","นภา ทองดี","นภา","housekeeper","active"],
    ["hk006","1234","กัญญา ใจงาม","กัญญา","housekeeper","active"],
    ["hk007","1234","มยุรี แสงจันทร์","มยุรี","housekeeper","active"],
    ["hk008","1234","ฝน พรมดี","ฝน","housekeeper","active"],
    ["hk009","1234","จิรา สุขใจ","จิรา","housekeeper","active"],
    ["hk010","1234","ดาว ชมพู","ดาว","housekeeper","active"],
    ["hk011","1234","อ้อย มีสุข","อ้อย","housekeeper","active"],
    ["hk012","1234","แป้ง รักดี","แป้ง","housekeeper","active"],
    ["hk013","1234","ปุ้ย ทำงาน","ปุ้ย","housekeeper","active"],
    ["hk014","1234","หน่อย ขันที","หน่อย","housekeeper","active"],
    ["hk015","1234","กิ๊ฟ งานดี","กิ๊ฟ","housekeeper","active"],
    ["hk016","1234","Aye Aye Khin","Aye","housekeeper","active"],
    ["hk017","1234","Phyu Phyu Win","Phyu","housekeeper","active"],
    ["hk018","1234","Moe Moe Lwin","Moe","housekeeper","active"],
    ["hk019","1234","Su Su Htwe","Su","housekeeper","active"],
    ["hk020","1234","Win Win Myint","Win","housekeeper","active"],
    ["hk021","1234","Khin Khin Oo","Khin","housekeeper","active"],
    ["hk022","1234","Thin Thin Aung","Thin","housekeeper","active"],
    ["hk023","1234","Nwe Nwe Soe","Nwe","housekeeper","active"],
    ["hk024","1234","May May Thwe","May","housekeeper","active"],
    ["hk025","1234","Hnin Hnin Wai","Hnin","housekeeper","active"],
    ["hk026","1234","Ei Ei Mon","Ei","housekeeper","active"],
    ["hk027","1234","Cho Cho Zin","Cho","housekeeper","active"],
    ["hk028","1234","Zin Zin Aye","Zin","housekeeper","active"],
    ["hk029","1234","Yee Yee Naing","Yee","housekeeper","active"],
    ["hk030","1234","San San Myat","San","housekeeper","active"],
    ["fd001","1234","วิชัย ต้อนรับ","วิชัย","frontdesk","active"],
    ["fd002","1234","กมล สวัสดี","กมล","frontdesk","active"],
    ["mgr001","1234","พิมพ์ใจ บริหาร","พิมพ์","manager","active"],
  ];

  let added = 0;
  allStaff.forEach(r => {
    if (!existing.includes(r[0])) { sh.appendRow(r); added++; }
  });

  Logger.log(`✓ เพิ่มพนักงาน ${added} คน (ข้าม ${allStaff.length - added} คนที่มีอยู่แล้ว)`);
  return { success: true, added };
}

function resetProductionData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  function clearSheetData(name) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    if (lastRow <= 1) return;
    sh.getRange(2, 1, lastRow - 1, sh.getMaxColumns()).clearContent();
  }

  clearSheetData(SH_ROOMS);         // ล้างข้อมูลห้องทั้งหมด
  clearSheetData(SH_LOG);           // ล้างประวัติทั้งหมด
  clearSheetData("ข้อร้องเรียน");   // ล้าง sheet เก่า (ถ้ายังมี)
  // SH_STAFF (พนักงาน) ไม่แตะ — ข้อมูลพนักงานยังอยู่ครบ

  Logger.log("✓ Reset เสร็จแล้ว — ห้อง/ประวัติ ถูกล้างแล้ว พนักงานยังอยู่ครบ");
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
      ["sup002","1234","สุดา ใจดี","สุดา","supervisor","active"],
      // แม่บ้านไทย hk001–hk015
      ["hk001","1234","สมหญิง ใจดี","หญิง","housekeeper","active"],
      ["hk002","1234","มาลี รักงาน","มาลี","housekeeper","active"],
      ["hk003","1234","นุ่น สวยงาม","นุ่น","housekeeper","active"],
      ["hk004","1234","แอ๊ม ขยัน","แอ๊ม","housekeeper","active"],
      ["hk005","1234","นภา ทองดี","นภา","housekeeper","active"],
      ["hk006","1234","กัญญา ใจงาม","กัญญา","housekeeper","active"],
      ["hk007","1234","มยุรี แสงจันทร์","มยุรี","housekeeper","active"],
      ["hk008","1234","ฝน พรมดี","ฝน","housekeeper","active"],
      ["hk009","1234","จิรา สุขใจ","จิรา","housekeeper","active"],
      ["hk010","1234","ดาว ชมพู","ดาว","housekeeper","active"],
      ["hk011","1234","อ้อย มีสุข","อ้อย","housekeeper","active"],
      ["hk012","1234","แป้ง รักดี","แป้ง","housekeeper","active"],
      ["hk013","1234","ปุ้ย ทำงาน","ปุ้ย","housekeeper","active"],
      ["hk014","1234","หน่อย ขันที","หน่อย","housekeeper","active"],
      ["hk015","1234","กิ๊ฟ งานดี","กิ๊ฟ","housekeeper","active"],
      // แม่บ้านเมียนมา hk016–hk030
      ["hk016","1234","Aye Aye Khin","Aye","housekeeper","active"],
      ["hk017","1234","Phyu Phyu Win","Phyu","housekeeper","active"],
      ["hk018","1234","Moe Moe Lwin","Moe","housekeeper","active"],
      ["hk019","1234","Su Su Htwe","Su","housekeeper","active"],
      ["hk020","1234","Win Win Myint","Win","housekeeper","active"],
      ["hk021","1234","Khin Khin Oo","Khin","housekeeper","active"],
      ["hk022","1234","Thin Thin Aung","Thin","housekeeper","active"],
      ["hk023","1234","Nwe Nwe Soe","Nwe","housekeeper","active"],
      ["hk024","1234","May May Thwe","May","housekeeper","active"],
      ["hk025","1234","Hnin Hnin Wai","Hnin","housekeeper","active"],
      ["hk026","1234","Ei Ei Mon","Ei","housekeeper","active"],
      ["hk027","1234","Cho Cho Zin","Cho","housekeeper","active"],
      ["hk028","1234","Zin Zin Aye","Zin","housekeeper","active"],
      ["hk029","1234","Yee Yee Naing","Yee","housekeeper","active"],
      ["hk030","1234","San San Myat","San","housekeeper","active"],
      // Front Desk & Manager
      ["fd001","1234","วิชัย ต้อนรับ","วิชัย","frontdesk","active"],
      ["fd002","1234","กมล สวัสดี","กมล","frontdesk","active"],
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

  const res = initDaily(todayStr());
  return { success: true, message: `สร้าง Sheets สำเร็จ (${res.count || 0} ห้อง)` };
}
