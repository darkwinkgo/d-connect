# Dusit Connect — Claude Code Project Instructions

## Project Overview

Dusit Connect is a hotel housekeeping management system for **Dusit Central Park Bangkok**.
Deployed as a LINE LIFF app (opens inside LINE), hosted on GitHub Pages, with Google Apps Script as backend.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (single file per page) |
| Hosting | GitHub Pages (`darkwinkgo.github.io/d-connect`) |
| Backend | Google Apps Script (GAS) Web App |
| Database | Google Sheets |
| Auth | Username + Password (checked against Sheet) |
| LINE Integration | LINE LIFF SDK v2 |

---

## File Structure

```
d-connect/
├── index.html      ← Registration page (LIFF: 2009946209-G2AuX4DH)
├── app.html        ← Main app — all 4 roles (LIFF: 2009946209-cFt4JqH1)
├── Code.gs         ← Google Apps Script backend (reference only)
└── CLAUDE.md       ← This file
```

---

## Hotel Domain

- **257 rooms**, floors 8–38
- **No floor 13**, no rooms ending in digit `4` (e.g. no 804, 814, 824...)
- **60 housekeeping staff** total, 30 active daily, max 15 rooms per person

---

## Room Status Flow

```
pending → cleaning → done → passed → ack
                       ↓ (ไม่ผ่าน)
                    pending (assign ใหม่)
```

| Status | ความหมาย | ทำโดย |
|---|---|---|
| `pending` | รอทำความสะอาด | — |
| `cleaning` | กำลังทำ | แม่บ้านกด |
| `done` | รอตรวจ | แม่บ้านกด |
| `passed` | ผ่านการตรวจ | หัวหน้ากด |
| `ack` | Front Desk รับทราบ | Front Desk กด |

---

## 4 User Roles

| Role | Key | หน้าที่ |
|---|---|---|
| หัวหน้าแม่บ้าน | `supervisor` | Assign ห้อง, ตรวจห้อง (ผ่าน/ไม่ผ่าน), Re-assign |
| แม่บ้าน | `housekeeper` | เห็นแค่ห้องตัวเอง, กด เริ่มทำ / เสร็จแล้ว |
| Front Desk | `frontdesk` | เห็นห้อง passed, กด รับทราบ |
| ผู้จัดการ | `manager` | Dashboard, ดูห้องทั้งหมด read-only |

---

## Google Sheets Structure

### Tab: พนักงาน
| Username | Password | ชื่อ | ชื่อเล่น | Role | Status |
|---|---|---|---|---|---|
| sup001 | 1234 | สมชาย ดูแลดี | ชาย | supervisor | active |

### Tab: ห้อง
| ห้อง | ชั้น | Status | assignedTo | assignedName | startTime | endTime | หมายเหตุ |
|---|---|---|---|---|---|---|---|
| 801 | 8 | pending | hk001 | หญิง | | | |

### Tab: ประวัติ
| Timestamp | ห้อง | User ID | ชื่อ | Action | หมายเหตุ |

---

## GAS API Actions (doPost)

| action | ใช้โดย | payload |
|---|---|---|
| `login` | ทุก role | `username`, `password` |
| `getRooms` | ทุก role | `role`, `staffId` |
| `getStaff` | supervisor | — |
| `updateStatus` | housekeeper | `roomId`, `status`, `staffId`, `staffName` |
| `assignRoom` | supervisor | `roomId`, `staffId`, `staffName`, `note` |
| `inspect` | supervisor | `roomId`, `result` (passed/failed), `note`, `newStaffId`, `newStaffName` |
| `ackRoom` | frontdesk | `roomId`, `staffId`, `staffName` |
| `getDashboard` | manager | — |
| `initSheets` | admin | — |

---

## CORS Constraint (สำคัญมาก)

GitHub Pages → GAS ใช้ `mode: "no-cors"` เท่านั้น
- **POST (write)**: `mode: "no-cors"` — fire & forget ไม่ได้อ่าน response
- **GET (read)**: ใช้ `headers: {"Content-Type": "text/plain"}` เพื่อหลีกเลี่ยง preflight → GAS redirect → อ่าน response ได้

```javascript
// Write (no response needed)
fetch(GAS_URL, {
  method: "POST", mode: "no-cors",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify(payload)
});

// Read (need response)
fetch(GAS_URL, {
  method: "POST",
  headers: {"Content-Type": "text/plain"},
  body: JSON.stringify(payload),
  redirect: "follow"
}).then(r => r.json()).then(data => ...);
```

---

## Design Language

- **Font**: Sarabun (Google Fonts) — ภาษาไทยอ่านง่าย
- **Primary color**: `#06C755` (LINE green)
- **Max width**: 390px (mobile-first)
- **Border radius**: 12px cards, 9px buttons
- **No frameworks** — vanilla CSS only, no Tailwind, no Bootstrap

---

## Development Notes

- **Session**: ใช้ `sessionStorage` เก็บ user object หลัง login
- **Optimistic UI**: อัปเดต state ใน memory ก่อน แล้วค่อย POST ไป GAS
- **No page reload**: render ทุกอย่างด้วย `innerHTML` แบบ SPA
- **Modal pattern**: สร้าง overlay div → append to body → remove on close

---

## Common Tasks

### เพิ่มพนักงานใหม่
เพิ่มแถวใน Google Sheet Tab **"พนักงาน"** โดยตรง ไม่ต้องแก้โค้ด

### เพิ่ม Role ใหม่
1. เพิ่มใน `tabCfg` object ใน `app.html`
2. เพิ่ม `case` ใน `renderView()` function
3. เพิ่ม `case` ใน `doPost()` switch ใน `Code.gs`

### Deploy ไฟล์ใหม่
1. แก้ไขไฟล์ใน local
2. Upload ไปที่ `github.com/darkwinkgo/d-connect`
3. GitHub Pages auto-deploy ใน ~1 นาที

### แก้ GAS Backend
1. แก้ `Code.gs`
2. Apps Script → Deploy → Manage deployments → Edit → New version → Deploy
3. URL ยังเป็นอันเดิม ไม่ต้องแก้ที่ไหน

---

## GAS Web App URL

```
https://script.google.com/macros/s/AKfycbyBSlxsIqNsxW7fO0vhsbgvJeKC783a0lQXvkChO-Sm_UofN9pZ0Xu3ceLxEF9M0s_vNg/exec
```

## LIFF IDs

| App | LIFF ID | URL |
|---|---|---|
| Register | `2009946209-G2AuX4DH` | `https://liff.line.me/2009946209-G2AuX4DH` |
| Main App | `2009946209-cFt4JqH1` | `https://liff.line.me/2009946209-cFt4JqH1` |
