// ===================================================
// Dusit Connect — Code.gs
// Backend: Username/Password Login + Room Management
// ===================================================

const SH_STAFF  = "พนักงาน";
const SH_ROOMS  = "ห้อง";
const SH_LOG    = "ประวัติ";

// -------------------------------------------------------
// doGet
// -------------------------------------------------------
function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile("app")
    .setTitle("Dusit Connect")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// -------------------------------------------------------
// doPost — router
// -------------------------------------------------------
function doPost(e) {
  const out = ContentService.createTextOutput();
  out.setMimeType(ContentService.MimeType.JSON);
  try {
    const req = JSON.parse(e.postData.contents);
    let res = {};
    switch (req.action) {
      case "login":        res = login(req.username, req.password); break;
      case "getRooms":     res = getRooms(req.role, req.staffId);   break;
      case "getStaff":     res = getStaff();                        break;
      case "updateStatus": res = updateStatus(req);                 break;
      case "assignRoom":   res = assignRoom(req);                   break;
      case "inspect":      res = inspect(req);                      break;
      case "ackRoom":      res = ackRoom(req);                      break;
      case "getDashboard": res = getDashboard();                    break;
      case "initSheets":   res = initSheets();                      break;
      default: res = { success: false, message: "Unknown action" };
    }
    out.setContent(JSON.stringify(res));
  } catch(err) {
    Logger.log(err.toString());
    out.setContent(JSON.stringify({ success: false, message: err.toString() }));
  }
  return out;
}

// -------------------------------------------------------
// login
// -------------------------------------------------------
function login(username, password) {
  if (!username || !password)
    return { success: false, message: "กรุณากรอก Username และ Password" };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_STAFF);
  if (!sheet)
    return { success: false, message: "ไม่พบข้อมูลพนักงาน กรุณาติดต่อ Admin" };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // คอลัมน์: 0=Username, 1=Password, 2=ชื่อ, 3=ชื่อเล่น, 4=Role, 5=Status
    if (String(row[0]).toLowerCase() === String(username).toLowerCase() &&
        String(row[1]) === String(password)) {
      if (row[5] && String(row[5]).toLowerCase() !== "active") {
        return { success: false, message: "บัญชีนี้ถูกระงับการใช้งาน" };
      }
      return {
        success:  true,
        staffId:  String(row[0]),
        name:     String(row[2]),
        nickname: String(row[3]),
        role:     String(row[4]),
      };
    }
  }
  return { success: false, message: "Username หรือ Password ไม่ถูกต้อง" };
}

// -------------------------------------------------------
// getRooms
// -------------------------------------------------------
function getRooms(role, staffId) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_ROOMS);
  if (!sheet) return { success: true, rooms: [] };

  const data = sheet.getDataRange().getValues();
  const rooms = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const room = {
      id:           String(r[0]),
      floor:        Number(r[1]),
      status:       String(r[2]),
      assignedTo:   String(r[3] || ""),
      assignedName: String(r[4] || ""),
      startTime:    r[5] ? new Date(r[5]).getTime() : null,
      endTime:      r[6] ? new Date(r[6]).getTime() : null,
      note:         String(r[7] || ""),
    };
    // กรองตาม role
    if (role === "housekeeper" && room.assignedTo !== staffId) continue;
    if (role === "frontdesk"   && room.status !== "passed")    continue;
    rooms.push(room);
  }
  return { success: true, rooms };
}

// -------------------------------------------------------
// getStaff (เฉพาะ housekeeper สำหรับ assign)
// -------------------------------------------------------
function getStaff() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SH_STAFF);
  if (!sheet) return { success: true, staff: [] };

  const data  = sheet.getDataRange().getValues();
  const staff = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[4]).toLowerCase() === "housekeeper" &&
        (!row[5] || String(row[5]).toLowerCase() === "active")) {
      staff.push({ id: String(row[0]), name: String(row[2]), nickname: String(row[3]) });
    }
  }
  return { success: true, staff };
}

// -------------------------------------------------------
// updateStatus
// -------------------------------------------------------
function updateStatus(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.roomId)) {
      sheet.getRange(i+1, 3).setValue(req.status);
      if (req.status === "cleaning") sheet.getRange(i+1, 6).setValue(new Date());
      if (req.status === "done")     sheet.getRange(i+1, 7).setValue(new Date());
      log(req.roomId, req.staffId, req.staffName, req.status, "");
      return { success: true };
    }
  }
  return { success: false, message: "ไม่พบห้อง" };
}

// -------------------------------------------------------
// assignRoom
// -------------------------------------------------------
function assignRoom(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.roomId)) {
      sheet.getRange(i+1, 3).setValue("pending");
      sheet.getRange(i+1, 4).setValue(req.staffId);
      sheet.getRange(i+1, 5).setValue(req.staffName);
      sheet.getRange(i+1, 6).setValue("");
      sheet.getRange(i+1, 7).setValue("");
      sheet.getRange(i+1, 8).setValue(req.note || "");
      log(req.roomId, req.supervisorId, req.supervisorName, "assigned", req.staffName);
      return { success: true };
    }
  }
  return { success: false, message: "ไม่พบห้อง" };
}

// -------------------------------------------------------
// inspect
// -------------------------------------------------------
function inspect(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.roomId)) {
      if (req.result === "passed") {
        sheet.getRange(i+1, 3).setValue("passed");
        sheet.getRange(i+1, 8).setValue(req.note || "");
      } else {
        sheet.getRange(i+1, 3).setValue("pending");
        sheet.getRange(i+1, 4).setValue(req.newStaffId   || data[i][3]);
        sheet.getRange(i+1, 5).setValue(req.newStaffName || data[i][4]);
        sheet.getRange(i+1, 6).setValue("");
        sheet.getRange(i+1, 7).setValue("");
        sheet.getRange(i+1, 8).setValue(req.note || "ตรวจไม่ผ่าน กรุณาทำใหม่");
      }
      log(req.roomId, req.supervisorId, req.supervisorName,
          req.result === "passed" ? "passed" : "failed", req.note || "");
      return { success: true };
    }
  }
  return { success: false, message: "ไม่พบห้อง" };
}

// -------------------------------------------------------
// ackRoom
// -------------------------------------------------------
function ackRoom(req) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(req.roomId)) {
      sheet.getRange(i+1, 3).setValue("ack");
      log(req.roomId, req.staffId, req.staffName, "ack", "");
      return { success: true };
    }
  }
  return { success: false, message: "ไม่พบห้อง" };
}

// -------------------------------------------------------
// getDashboard
// -------------------------------------------------------
function getDashboard() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_ROOMS);
  if (!sheet) return { success: true, summary: {}, byFloor: [], byStaff: [] };

  const data = sheet.getDataRange().getValues();
  const summary = { pending:0, cleaning:0, done:0, passed:0, ack:0, total:0 };
  const byFloor = {}, byStaff = {};

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][2]);
    const floor  = Number(data[i][1]);
    const sname  = String(data[i][4] || "ยังไม่ assign");

    summary[status] = (summary[status] || 0) + 1;
    summary.total++;

    byFloor[floor] = byFloor[floor] || { floor, done:0, total:0 };
    byFloor[floor].total++;
    if (["done","passed","ack"].includes(status)) byFloor[floor].done++;

    if (data[i][3]) {
      byStaff[sname] = byStaff[sname] || { name:sname, done:0, total:0 };
      byStaff[sname].total++;
      if (["done","passed","ack"].includes(status)) byStaff[sname].done++;
    }
  }
  return {
    success: true, summary,
    byFloor: Object.values(byFloor).sort((a,b) => a.floor - b.floor),
    byStaff: Object.values(byStaff).sort((a,b) => b.done  - a.done),
  };
}

// -------------------------------------------------------
// log
// -------------------------------------------------------
function log(roomId, userId, userName, action, note) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh   = ss.getSheetByName(SH_LOG);
  if (!sh) {
    sh = ss.insertSheet(SH_LOG);
    sh.appendRow(["Timestamp","ห้อง","User ID","ชื่อ","Action","หมายเหตุ"]);
  }
  sh.appendRow([new Date(), roomId, userId, userName, action, note]);
}

// -------------------------------------------------------
// initSheets — สร้าง Sheet โครงสร้าง + ข้อมูลตัวอย่าง
// -------------------------------------------------------
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── พนักงาน ──
  if (!ss.getSheetByName(SH_STAFF)) {
    const sh = ss.insertSheet(SH_STAFF);
    sh.appendRow(["Username","Password","ชื่อ","ชื่อเล่น","Role","Status"]);
    [
      ["sup001","1234","สมชาย ดูแลดี","ชาย","supervisor","active"],
      ["hk001", "1234","สมหญิง ใจดี","หญิง","housekeeper","active"],
      ["hk002", "1234","มาลี รักงาน","มาลี","housekeeper","active"],
      ["hk003", "1234","นุ่น สวยงาม","นุ่น","housekeeper","active"],
      ["hk004", "1234","แอ๊ม ขยัน","แอ๊ม","housekeeper","active"],
      ["fd001", "1234","วิชัย ต้อนรับ","วิชัย","frontdesk","active"],
      ["mgr001","1234","พิมพ์ใจ บริหาร","พิมพ์","manager","active"],
    ].forEach(r => sh.appendRow(r));
    const hdr = sh.getRange(1,1,1,6);
    hdr.setBackground("#1a237e"); hdr.setFontColor("#fff"); hdr.setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  // ── ห้อง ──
  if (!ss.getSheetByName(SH_ROOMS)) {
    const sh = ss.insertSheet(SH_ROOMS);
    sh.appendRow(["ห้อง","ชั้น","Status","assignedTo","assignedName","startTime","endTime","หมายเหตุ"]);
    const hk = [
      { id:"hk001", nick:"หญิง" },
      { id:"hk002", nick:"มาลี" },
      { id:"hk003", nick:"นุ่น"  },
      { id:"hk004", nick:"แอ๊ม"  },
    ];
    const statuses = ["pending","cleaning","done","passed","ack"];
    let idx = 0;
    for (let f = 8; f <= 38; f++) {
      if (f === 13) continue;
      for (let n = 1; n <= 9; n++) {
        const room = String(f) + String(n).padStart(2,"0");
        if (room.endsWith("4")) continue;
        const h  = hk[idx % hk.length];
        const st = statuses[idx % statuses.length];
        sh.appendRow([
          room, f, st, h.id, h.nick,
          ["cleaning","done","passed","ack"].includes(st) ? new Date() : "",
          ["done","passed","ack"].includes(st) ? new Date() : "",
          ""
        ]);
        idx++;
      }
    }
    const hdr = sh.getRange(1,1,1,8);
    hdr.setBackground("#1a237e"); hdr.setFontColor("#fff"); hdr.setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  return { success: true, message: "สร้าง Sheets สำเร็จ" };
}
