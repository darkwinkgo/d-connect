# D-CONNECT — Developer Guide

> คู่มือสำหรับนักพัฒนาที่มาทำงานต่อ  
> อัปเดตล่าสุด: พฤษภาคม 2568

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [โครงสร้างไฟล์](#2-โครงสร้างไฟล์)
3. [Tech Stack](#3-tech-stack)
4. [การตั้งค่าเริ่มต้น](#4-การตั้งค่าเริ่มต้น)
5. [โครงสร้างฐานข้อมูล (Google Sheets)](#5-โครงสร้างฐานข้อมูล-google-sheets)
6. [Backend — Code.gs](#6-backend--codegs)
7. [Frontend — app.html](#7-frontend--apphtml)
8. [State Management](#8-state-management)
9. [สถานะห้องและ Flow](#9-สถานะห้องและ-flow)
10. [Role และสิทธิ์การใช้งาน](#10-role-และสิทธิ์การใช้งาน)
11. [ระบบภาษา (i18n)](#11-ระบบภาษา-i18n)
12. [CORS และการเรียก API](#12-cors-และการเรียก-api)
13. [Auto-refresh และ Data Sync](#13-auto-refresh-และ-data-sync)
14. [Responsive Layout](#14-responsive-layout)
15. [การ Deploy](#15-การ-deploy)
16. [งาน Admin ที่ใช้บ่อย](#16-งาน-admin-ที่ใช้บ่อย)
17. [การเพิ่ม Feature ใหม่](#17-การเพิ่ม-feature-ใหม่)
18. [ปัญหาที่พบบ่อยและวิธีแก้](#18-ปัญหาที่พบบ่อยและวิธีแก้)

---

## 1. ภาพรวมระบบ

D-CONNECT คือระบบบริหารจัดการแม่บ้าน (Housekeeping Management) ของโรงแรม Dusit Central Park Bangkok

**สิ่งที่ระบบทำได้:**
- หัวหน้าแม่บ้านมอบหมายห้องให้แม่บ้านแต่ละคน
- แม่บ้านกดเริ่มทำ / เสร็จแล้ว บนมือถือ
- หัวหน้าตรวจห้อง — ผ่าน หรือ ไม่ผ่าน (assign ใหม่)
- Front Desk เห็น real-time ว่าห้องไหนพร้อมแล้ว
- ผู้จัดการดูรายงานรายวัน สถิติพนักงาน วิเคราะห์ผลงาน

**โรงแรม:** 250 ห้อง ชั้น 8–38 (ข้าม 13) ห้องที่ลงท้ายด้วย 4 ไม่มี

---

## 2. โครงสร้างไฟล์

```
d-connect/
├── app.html              ← แอปหลัก (ทุก role อยู่ในไฟล์เดียว)
├── index.html            ← หน้า Register LINE LIFF (ไม่ได้ใช้งานหลัก)
├── seed.html             ← เครื่องมือเติมข้อมูลทดสอบ (ใช้ GAS test endpoint)
├── Code.gs               ← Google Apps Script backend (reference copy)
├── CLAUDE.md             ← Project instructions สำหรับ AI assistant
└── DEVELOPER_GUIDE.md    ← คู่มือนี้
```

> **หมายเหตุ:** `Code.gs` ใน repo นี้คือ reference copy เท่านั้น  
> ต้นฉบับจริงอยู่ใน Google Apps Script editor ของ Google Sheet

---

## 3. Tech Stack

| Layer | Technology | หมายเหตุ |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS | ไม่มี framework |
| Hosting | GitHub Pages | `darkwinkgo.github.io/d-connect` |
| Backend | Google Apps Script (GAS) | Web App endpoint |
| Database | Google Sheets | 3 tabs |
| Auth | Username + Password | ตรวจกับ Sheet |
| LINE Integration | LINE LIFF SDK v2 | เปิดใน LINE app |
| Font | Sarabun (Google Fonts) | รองรับภาษาไทย |

---

## 4. การตั้งค่าเริ่มต้น

### URLs และ IDs สำคัญ

```javascript
// GAS Web App URL (อยู่ใน app.html บรรทัดแรกของ <script>)
const GAS_URL = "https://script.google.com/macros/s/AKfycbx6.../exec";

// LIFF IDs
Register App : 2009946209-G2AuX4DH
Main App     : 2009946209-cFt4JqH1
```

### ข้อมูล Login ตัวอย่าง

| Role | Username | Password |
|---|---|---|
| Admin | admin001 | 1234 |
| Supervisor | sup001 | 1234 |
| Housekeeper | hk001 | 1234 |
| Front Desk | fd001 | 1234 |
| Manager | mgr001 | 1234 |

---

## 5. โครงสร้างฐานข้อมูล (Google Sheets)

### Tab: `พนักงาน`

| คอลัมน์ | ตัวอย่าง | หมายเหตุ |
|---|---|---|
| Username | hk001 | Primary key |
| Password | 1234 | Plain text |
| ชื่อ | สมหญิง ใจดี | ชื่อเต็ม |
| ชื่อเล่น | หญิง | แสดงในแอป |
| Role | housekeeper | supervisor / housekeeper / frontdesk / manager / admin |
| Status | active | active / inactive |

### Tab: `ห้อง`

| Index | คอลัมน์ | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| 0 | ห้อง | 801 | Room ID |
| 1 | ชั้น | 8 | Floor number |
| 2 | วันที่ | 2025-05-10 | yyyy-MM-dd |
| 3 | Status | pending | ดูหัวข้อ 9 |
| 4 | assignedTo | hk001 | Username แม่บ้าน |
| 5 | assignedName | หญิง | ชื่อเล่นแม่บ้าน |
| 6 | startTime | Date object | เวลาเริ่มทำ |
| 7 | endTime | Date object | เวลาเสร็จ |
| 8 | หมายเหตุ | สกปรกมาก | Note จากหัวหน้า |

> **สำคัญ:** แต่ละห้องมีหนึ่งแถวต่อหนึ่งวัน ถ้าวันนั้นไม่มีข้อมูล = ห้องยังไม่ถูก initialize

### Tab: `ประวัติ`

| คอลัมน์ | หมายเหตุ |
|---|---|
| Timestamp | เวลาที่ทำ action |
| ห้อง | Room ID |
| User ID | Username |
| ชื่อ | ชื่อพนักงาน |
| Action | assign / cleaning / done / passed / failed |
| หมายเหตุ | รายละเอียดเพิ่มเติม |

---

## 6. Backend — Code.gs

### Entry Point

```javascript
function doPost(e) {
  const req = JSON.parse(e.postData.contents);
  // req.action เป็น string ที่บอกว่าจะทำอะไร
  switch(req.action) { ... }
}
```

### API Actions ทั้งหมด

| action | ใช้โดย | Parameters หลัก | คืนค่า |
|---|---|---|---|
| `login` | ทุก role | username, password | `{success, staffId, name, nickname, role}` |
| `getRooms` | ทุก role | role, staffId, date, showAll | `{success, rooms[]}` |
| `getStaff` | supervisor, admin | — | `{success, staff[]}` |
| `updateStatus` | housekeeper | roomId, status, staffId, date | `{success}` |
| `assignRoom` | supervisor, admin | roomId, staffId, staffName, note, date | `{success}` |
| `bulkAssign` | supervisor, admin | assignments[], date | `{success, count}` |
| `inspect` | supervisor, admin | roomId, result, note, newStaffId, date | `{success}` |
| `getReport` | manager | startDate, endDate | `{success, byDate[]}` |
| `getStaffReport` | manager | startDate, endDate | `{success, byStaff[]}` |
| `getPerformance` | supervisor | startDate, endDate | `{success, ...}` |
| `adminSetStatus` | admin | roomId, status, assignedTo, note | `{success}` |
| `initDaily` | admin | date | `{success, count}` |
| `initSheets` | admin | — | `{success, message}` |
| `seedTestData` | admin | — | `{success, rooms}` |

### getRooms — logic สำคัญ

```javascript
// FD และ Manager ส่ง showAll:true → GAS คืน 250 ห้อง (merge กับ sheet)
// Housekeeper → คืนเฉพาะห้องที่ assigned ให้ตัวเอง
// Supervisor/Admin → คืนทุกห้องในวันนั้น (ที่มีในชีต)
```

> **หมายเหตุ Frontend:** Supervisor และ Manager ยังทำ client-side merge ด้วย `getMergedRooms()` อีกรอบ เพื่อให้เห็น 250 ห้องเสมอแม้ไม่มีข้อมูลใน sheet วันนั้น

### assignRoom — auto-create

```javascript
// ถ้าไม่มีแถวใน sheet (ยังไม่ได้ initDaily)
// assignRoom จะสร้างแถวใหม่เองโดยอัตโนมัติ
// ไม่ต้องรัน initDaily ก่อนเสมอ
```

### Functions สำหรับ Admin (รันใน Apps Script Editor)

| Function | ทำอะไร | เมื่อไหร่ใช้ |
|---|---|---|
| `initSheets()` | สร้าง Sheets ทั้งหมด + สร้างข้อมูลวันนี้ | ครั้งแรก |
| `initDaily(date)` | สร้างแถว 250 ห้องสำหรับวันที่กำหนด | เริ่มวันใหม่ (optional) |
| `addMissingStaff()` | เพิ่มพนักงาน default ที่ยังไม่มีในชีต | เพิ่มพนักงานชุดแรก |
| `resetProductionData()` | ล้างข้อมูลห้องและประวัติ ไม่แตะพนักงาน | reset ข้อมูล |
| `seedTestData()` | เติมข้อมูลย้อนหลัง 90 วัน | ทดสอบ report |

---

## 7. Frontend — app.html

ไฟล์เดียวประกอบด้วย HTML + CSS + JavaScript ทั้งหมด

### โครงสร้าง HTML

```
<div class="app">
  <div id="login-screen">   ← หน้า login
  <div id="main-app">       ← แอปหลัก (hidden จนกว่าจะ login)
    <div class="hdr">       ← Header: logo, badge, date nav, tabs
    <div class="content">   ← เนื้อหาหลัก (innerHTML สลับไปตาม view)
```

### JavaScript ภายใน `<script>`

แบ่งเป็น section ดังนี้ (ตามลำดับในไฟล์):

```
GAS_URL constant
SESSION & STATE (USER, ST)
LANGUAGE (LANG, LANG_DATA, t())
DATE HELPERS
STATUS HELPERS
GAS CALLS (gasCall, gasGet)
AUTO-REFRESH (startAutoRefresh, softRefresh)
LIVE TIMER
LOGIN / LOGOUT / SHOW APP
TABS (tabCfg, renderTabs, goTab)
DATE NAV
CALENDAR
LOAD DATA (loadAndRender, loadStaffReport, getStaffDateRange)
ERROR HANDLING (showError, showLoader)
RENDER (renderContent, renderView)
── VIEW FUNCTIONS ──
  vSupRooms, vSupAssign, vSupPerf
  vHkRooms
  vFdStatus
  vMgrDash, vMgrAll, vMgrStaff
  vAdmRooms, vAdmInspect
── HELPERS ──
  allHotelRooms, getMergedRooms
  vFdStatus (FD merge logic)
── ACTIONS (Write) ──
  doStatus, doAssign, doAutoAssign
  doInspect, doAdminOverride, doInitDaily
── MODALS ──
  openAssign, openInspect, openAutoAssign
  showModal, closeModal
── UTILITY ──
  toast, fmtDateTH, fmtMonth, elapsed, duration, sb
```

### การ Render

แอปทำงานแบบ SPA (Single Page Application) ทั้งหมด:

```javascript
// เปลี่ยน view โดยแทนที่ innerHTML ของ #content
function renderContent(){
  document.getElementById("content").innerHTML = renderView(getView());
}

// renderView() ดูจาก ST.tabIdx → เรียก view function ที่ถูกต้อง
function renderView(v){
  switch(v){
    case "sup_rooms": return vSupRooms();
    case "hk_rooms":  return vHkRooms();
    // ...
  }
}
```

---

## 8. State Management

### ST Object — Global State

```javascript
const ST = {
  tabIdx:      0,        // tab ที่กำลังแสดง
  filter:      "all",    // chip filter ที่เลือก (all/pending/cleaning/...)
  fdFloor:     "",       // filter ชั้น (FD + Sup + Mgr)
  fdHk:        "",       // filter แม่บ้าน (FD)
  supFloor:    "",       // filter ชั้น (Supervisor)
  supHk:       "",       // filter แม่บ้าน (Supervisor)
  rooms:       [],       // ข้อมูลห้องจาก GAS (วันที่เลือก)
  staff:       [],       // รายชื่อแม่บ้านทั้งหมด (getStaff)
  date:        "...",    // วันที่ที่กำลังดู (yyyy-MM-dd)
  report:      [],       // ข้อมูล report รายวัน
  perf:        [],       // ข้อมูล performance
  staffReport: [],       // ข้อมูล staff stats
  reportMode:  "daily",  // daily/monthly/yearly
  staffMode:   "30d",    // 7d/30d/90d/month/year
  staffMonth:  "",       // เดือนที่เลือก (1-12)
  staffYear:   "",       // ปีที่เลือก (เช่น 2025)
};
```

### USER Object — Session

```javascript
// เก็บใน sessionStorage["dc_user"]
USER = {
  success:  true,
  staffId:  "sup001",
  name:     "สมชาย ดูแลดี",
  nickname: "ชาย",
  role:     "supervisor"
}
```

### กฎการ reset State

```javascript
function goTab(i){
  // เปลี่ยน tab → reset filter และ floor/hk filter เสมอ
  ST.tabIdx=i; ST.filter="all"; ST.supFloor=""; ST.supHk="";
}

function changeDate(delta){
  // เปลี่ยนวัน → reset filter และล้าง report cache
  ST.filter="all"; ST.report=[]; ST.perf=[];
}
```

---

## 9. สถานะห้องและ Flow

```
unassigned → pending → cleaning → done → passed
                ↑          ↓ (ไม่ผ่านตรวจ)
                └──── pending (assign ใหม่)
```

| Status | สี | ความหมาย | ใครเปลี่ยน |
|---|---|---|---|
| `unassigned` | ฟ้าเทา | ยังไม่ได้มอบหมาย | ระบบ (initDaily) |
| `pending` | เทาอุ่น | มอบหมายแล้ว รอแม่บ้าน | assignRoom/bulkAssign |
| `cleaning` | ส้มอ่อน | กำลังทำความสะอาด | แม่บ้านกด "เริ่มทำ" |
| `done` | น้ำเงิน | รอหัวหน้าตรวจ | แม่บ้านกด "เสร็จแล้ว" |
| `passed` | เขียว | ผ่านการตรวจ | หัวหน้ากด "ผ่าน" |

### CSS Class ของ Status Badge

```css
.s-unassigned { background:#E8EBF2; color:#3B4B6B }
.s-pending    { background:var(--warm); color:#555 }
.s-cleaning   { background:var(--ol); color:#9A3E00 }
.s-done       { background:var(--bl); color:#1E40AF }
.s-passed     { background:var(--sagel); color:var(--saged) }
```

---

## 10. Role และสิทธิ์การใช้งาน

### Tabs ต่อ Role

| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 |
|---|---|---|---|---|
| `supervisor` | ห้องทั้งหมด | มอบหมาย | เวลาทำงาน | — |
| `housekeeper` | ห้องของฉัน | — | — | — |
| `frontdesk` | ห้องทั้งหมด | — | — | — |
| `manager` | รายงานรายวัน | ห้องทั้งหมด | สถิติพนักงาน | — |
| `admin` | ห้องทั้งหมด | มอบหมาย | ตรวจห้อง | สถิติพนักงาน |

### สิ่งที่แต่ละ Role เห็น

| Role | เห็นห้องอะไร | showAll |
|---|---|---|
| housekeeper | เฉพาะห้องที่ assign ให้ตัวเอง | ✗ |
| supervisor | ทุกห้องในวันนั้น (merge 250) | ✗ (merge client-side) |
| frontdesk | 250 ห้อง เสมอ | ✓ |
| manager | 250 ห้อง เสมอ (merge client-side) | ✓ |
| admin | ทุกห้อง (ใช้ logic ของ supervisor) | ✗ |

> Admin ใช้ `role = "supervisor"` เมื่อเรียก getRooms

---

## 11. ระบบภาษา (i18n)

รองรับ 3 ภาษา: ไทย (`th`), อังกฤษ (`en`), พม่า (`my`)

```javascript
let LANG = localStorage.getItem("dc_lang") || "th"; // default: ไทย

function t(key){
  return (LANG_DATA[LANG] || LANG_DATA.th)[key] || key;
}
```

### วิธีเพิ่ม String ใหม่

ต้องเพิ่มใน **ทั้ง 3** language objects เสมอ:

```javascript
const LANG_DATA = {
  th: {
    my_new_key: "ข้อความภาษาไทย",
    // ...
  },
  en: {
    my_new_key: "English text",
    // ...
  },
  my: {
    my_new_key: "မြန်မာဘာသာ",
    // ...
  }
};
```

### Keys ที่ใช้บ่อย

```
s_unassigned, s_pending, s_cleaning, s_done, s_passed
tab_all_rooms, tab_assign, tab_daily_report, tab_staff
btn_start, btn_done, btn_inspect, btn_assign, btn_cancel
floor, housekeeper, min, hr
err_load, btn_retry
```

---

## 12. CORS และการเรียก API

เนื่องจาก GitHub Pages → GAS มีข้อจำกัด CORS:

### Read (ต้องการ response)

```javascript
// ใช้ Content-Type: text/plain เพื่อหลีกเลี่ยง CORS preflight
// GAS จะ redirect → browser follow → อ่าน response ได้
async function gasGet(payload){
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });
  return await r.json();
}
```

### Write (ไม่ต้องการ response)

```javascript
// ใช้ mode: "no-cors" → fire & forget
// ไม่สามารถอ่าน response ได้
async function gasCall(payload){
  await fetch(GAS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
```

### GAS Cold Start

GAS อาจใช้เวลา **15–30 วินาที** ในการตอบครั้งแรกหลัง idle  
**ห้ามใช้ fetch timeout ต่ำกว่า 30 วินาที** — จะทำให้ app ใช้งานไม่ได้

---

## 13. Auto-refresh และ Data Sync

### Auto-refresh (ทุก 30 วินาที)

```javascript
// ทำงานเงียบๆ เบื้องหลัง
// render ใหม่เฉพาะเมื่อข้อมูลเปลี่ยน (JSON diff check)
_refreshTimer = setInterval(async () => {
  const res = await gasGet({ action:"getRooms", ... });
  const newJson = JSON.stringify(res.rooms||[]);
  if(newJson !== JSON.stringify(ST.rooms)){
    ST.rooms = res.rooms||[];
    renderContent(); // re-render เฉพาะเมื่อข้อมูลเปลี่ยน
  }
}, 30000);
```

### softRefresh — หลัง Write Action

```javascript
// เรียกหลัง doStatus / doAssign / doInspect ฯลฯ
// รอ 2.5 วินาที แล้ว silent refresh
function softRefresh(delayMs=2500){
  setTimeout(async () => {
    // fetch และ update ST.rooms ถ้าข้อมูลเปลี่ยน
  }, delayMs);
}
```

### getMergedRooms — 250 ห้องเสมอ

```javascript
function getMergedRooms(){
  if(!isToday()) return ST.rooms; // วันก่อน: ใช้ข้อมูลชีตเท่านั้น
  // วันนี้: merge ข้อมูลชีตกับ 250 ห้อง hotel
  // ห้องที่ไม่มีในชีต → แสดงเป็น unassigned
  const sheetMap = {};
  ST.rooms.forEach(r => { sheetMap[r.id] = r; });
  return allHotelRooms().map(r => sheetMap[r.id] || {
    ...r, status:"unassigned", assignedTo:"", assignedName:"", ...
  });
}
```

> ใช้ใน: `vSupRooms`, `vSupAssign`, `vMgrDash`, `vMgrAll`

---

## 14. Responsive Layout

### Breakpoints

| Screen | Max-width | Cards | Stats |
|---|---|---|---|
| Mobile (<700px) | 390px | 1 col | 3 col |
| Tablet/Desktop (≥700px) | 900px | 2 col | 4 col |
| Wide desktop (≥1100px) | 1200px | 3 col | 4 col |

### CSS Class สำคัญ

```css
/* Cards ที่ต้องการ responsive grid ให้ wrap ด้วย */
<div class="card-list">
  <div class="card">...</div>
  <div class="card">...</div>
</div>

/* Modal บน desktop จะ center แทนที่จะ bottom-sheet */
@media(min-width:700px){
  .overlay { align-items: center; }
  .modal   { border-radius: 16px; }
}
```

### Views ที่ใช้ card-list แล้ว

`vSupRooms`, `vSupAssign`, `vHkRooms`, `vFdStatus`, `vMgrAll`, `vAdmRooms`

---

## 15. การ Deploy

### Frontend (app.html)

```bash
# แก้ไขไฟล์ในเครื่อง → push ขึ้น GitHub
git add app.html
git commit -m "..."
git push origin main
# GitHub Pages auto-deploy ภายใน ~1 นาที
```

URL: `https://darkwinkgo.github.io/d-connect/app.html`

### Backend (Code.gs)

1. เปิด Google Apps Script editor
2. แก้ไขโค้ด
3. **Deploy → Manage deployments → ✏️ Edit → New version → Deploy**
4. URL เดิม ไม่ต้องแก้ที่ไหน

> **สำคัญ:** ต้อง deploy ใหม่ทุกครั้งที่แก้ Code.gs ไม่งั้น production ยังใช้เวอร์ชันเก่า

### Checklist หลัง Deploy GAS ใหม่

- [ ] เปิด GAS URL ตรงๆ ใน browser ตรวจว่า return `{"status":"Dusit Connect API running"}`
- [ ] ล็อกอินแอปแล้วทดสอบ action อย่างน้อย 1 อย่าง

---

## 16. งาน Admin ที่ใช้บ่อย

### เพิ่มพนักงานใหม่

เพิ่มแถวใน Google Sheet Tab **"พนักงาน"** โดยตรง ตามรูปแบบ:
```
username | password | ชื่อเต็ม | ชื่อเล่น | role | active
```

หรือรัน `addMissingStaff()` ใน Apps Script editor เพื่อเพิ่มพนักงาน default ทั้งหมด

### Reset ข้อมูลและ Seed ใหม่

```
1. Apps Script editor → รัน resetProductionData()
   → ล้างข้อมูลห้องและประวัติ (ไม่แตะพนักงาน)

2. รัน addMissingStaff()
   → เพิ่มพนักงาน default ถ้ายังไม่มี

3. รัน seedTestData()
   → เติมข้อมูลย้อนหลัง 90 วัน สำหรับทดสอบ report
```

### ข้อมูลที่ seedTestData สร้าง

- แต่ละแม่บ้านมี **capacity** แตกต่างกัน (5–10 ห้อง/วัน)
- แต่ละแม่บ้านมี **baseMin** แตกต่างกัน (20–50 นาที/ห้อง)
- มีโอกาส **absent** 5–11% ต่อวัน
- ทำให้สถิติแต่ละคนต่างกันจริงๆ (ไม่เท่ากันทุกคน)

---

## 17. การเพิ่ม Feature ใหม่

### เพิ่ม Tab ใหม่ให้ Role

```javascript
// 1. เพิ่มใน tabCfg()
function tabCfg(){
  return {
    manager: [
      ...,
      { lbl:t("tab_new_feature"), v:"mgr_new" }  // เพิ่มตรงนี้
    ],
  };
}

// 2. เพิ่มใน renderView()
function renderView(v){
  switch(v){
    case "mgr_new": return vMgrNew();  // เพิ่มตรงนี้
    // ...
  }
}

// 3. สร้าง view function
function vMgrNew(){
  return `<div>...</div>`;
}

// 4. ถ้าต้องโหลดข้อมูลพิเศษ เพิ่มใน loadAndRender()
async function loadAndRender(){
  if(v==="mgr_new"){ await loadNewData(); return; }
  // ...
}
```

### เพิ่ม API Action ใหม่ใน GAS

```javascript
// Code.gs — เพิ่มใน doPost() switch
case "myNewAction": res = myNewAction(req); break;

// เพิ่ม function
function myNewAction(req) {
  // ...
  return { success: true, data: [...] };
}
```

### เพิ่ม Status ใหม่

1. เพิ่ม CSS class `.s-newstatus` ใน `<style>`
2. เพิ่ม key `s_newstatus` ใน LANG_DATA ทั้ง 3 ภาษา
3. เพิ่มใน `SL()` function
4. เพิ่มใน flist ของ views ที่เกี่ยวข้อง
5. ถ้า GAS ต้องรู้จัก status นี้ด้วย ตรวจ `getReport()` และ `getStaffReport()`

---

## 18. ปัญหาที่พบบ่อยและวิธีแก้

### แอปโหลดช้า / ค้าง

**สาเหตุ:** GAS cold start (ไม่มีใครเรียกนานแล้ว)  
**แก้:** รอ 15–30 วินาที ถ้าโหลดสำเร็จครั้งหนึ่งแล้ว ครั้งต่อไปจะเร็วขึ้น  
**ห้ามทำ:** ใส่ fetch timeout ต่ำกว่า 30 วินาที

### "ไม่มีแม่บ้านที่พร้อมทำงาน" ตอน Auto-assign

**สาเหตุ:** `ST.staff` ว่าง — `getStaff()` ไม่ได้ถูกเรียก  
**แก้:** `getStaff()` จะถูกเรียกอัตโนมัติเมื่อ `ST.staff.length === 0` ตอน `loadAndRender`  
ตรวจว่า Sheet "พนักงาน" มี housekeeper ที่ Status = active หรือไม่

### ข้อมูลห้องไม่อัปเดต

**สาเหตุ:** Write action ใช้ `mode: "no-cors"` → ไม่รู้ว่า GAS รับข้อมูลหรือยัง  
**วิธีการทำงาน:** `softRefresh()` จะ fetch ใหม่หลัง 2.5 วินาที  
Auto-refresh ทำงานทุก 30 วินาที → ข้อมูลจะอัปเดตเองในไม่ช้า

### resetProductionData error "cannot delete all non-frozen rows"

**สาเหตุ:** Google Sheets ไม่ยอมลบทุกแถว  
**แก้:** ใช้ `clearContent()` แทน `deleteRows()` (แก้แล้วใน Code.gs ปัจจุบัน)

### แก้ Code.gs แล้วแต่ไม่เห็นการเปลี่ยนแปลง

**สาเหตุ:** ลืม deploy เวอร์ชันใหม่  
**แก้:** Apps Script → Deploy → Manage deployments → Edit → New version → Deploy

---

## Color Palette Reference

```css
--g:    #C89A5B  /* Gold — primary brand */
--gd:   #A57B3A  /* Gold Dark */
--gl:   #F7EDD8  /* Gold Light — backgrounds */
--navy: #1F2433  /* Deep Navy — headers */
--sage: #A8B59A  /* Soft Sage */
--saged:#4E6642  /* Sage Dark — passed status text */
--sagel:#EEF1EB  /* Sage Light — passed status bg */
--warm: #ECE9E3  /* Warm Gray — pending bg */
--r:    #C0392B  /* Red — errors, fail */
--o:    #C45C10  /* Orange — in-progress, warning */
--b:    #1A56DB  /* Blue — done status */
--mu:   #737373  /* Muted — secondary text */
--br:   #ECE9E3  /* Border */
--bg:   #FAF8F3  /* Page background */
```

---

*จัดทำโดย Claude — อัปเดตตามสถานะโค้ด ณ พฤษภาคม 2568*
