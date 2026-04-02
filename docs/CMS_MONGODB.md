# ฐานข้อมูล MongoDB สำหรับ CMS (CardPay)

เอกสารนี้ระบุว่า **แต่ละเมนู/หน้าใน `/cms`** ควรอ่านและเขียนข้อมูลจากคอลเลกชันใด ฟิลด์ใดบ้าง เพื่อให้การออกแบบ API และสิทธิ์แอดมินสอดคล้องกัน

หลักการ:

- CMS ใช้ **ชุดคอลเลกชันเดียวกับแอปผู้ใช้** (เช่น `users`, `campaigns`) แต่ **มุมมองและสิทธิ์ต่างกัน** — แยกด้วย API ที่ตรวจ `session.user.role === 'admin'` (หรือกลไกที่ทีมกำหนด)
- **ไม่เก็บ mock ลง DB** — ข้อมูลที่บันทึกต้องมาจำการกระทำจริง (ผู้ใช้/แอดมิน/ระบบ)
- รหัสอ้างอิงบนหน้า CMS (เช่น `USER_xxx`) แสดงผลจาก `users._id` หรือฟิลด์ที่ออกแบบไว้ ไม่ควร hardcode

---

## ภาพรวมคอลเลกชันที่ CMS แตะ

| คอลเลกชัน | บทบาทหลักใน CMS |
|-----------|------------------|
| `users` | รายชื่อสมาชิก, สถานะ, รอโอน, แอดมิน, สปอนเซอร์ (ผ่าน `role`), `lastLoginAt` |
| `bankaccounts` | รายละเอียดสมาชิก — บัญชีธนาคาร (1 คน 1 บัญชี) |
| `sponsors` | ตาราง/รายละเอียดสปอนเซอร์, เพิ่มสปอนเซอร์จากสมาชิก |
| `campaigns` | แคมเปญต่อสปอนเซอร์, งบ, สถานะ, สร้างแคมเปญ + Flex/รูป (อ้างอิง Drive) |
| `campaignmemberstats` | สมาชิกที่แชร์ในแคมเปญ / แคมเปญที่สมาชิกแชร์ |
| `campaigntags` | แท็กหมวดแคมเปญ — ผูกกับ `campaigns.tagIds` |
| `campaignsharedailies` | กราฟแนวโน้มการแชร์ (รายวัน) |
| `withdrawalrequests` | แจ้งเตือนถอนแดชบอร์ด, ประวัติโอน, ยืนยันโอน |
| `auditlogs` | ประวัติเข้าใช้งาน CMS, กิจกรรมล่าสุด (เมื่อบันทึก) |

---

## ไล่ตามเมนู sidebar

### 1) `/cms/dashboard` — แดชบอร์ด

| บล็อก UI | ข้อมูลที่ต้องการ | แหล่งใน MongoDB |
|-----------|-------------------|------------------|
| การ์ดสถิติ (สมาชิกทั้งหมด) | จำนวนผู้ใช้ role `user` (และนิยามว่ารวม sponsor หรือไม่) | `users` — `countDocuments({ role: 'user' })` หรือตามนโยบาย |
| การ์ด “โฆษณาที่ใช้งาน” | จำนวนแคมเปญที่ `status: 'active'` | `campaigns` |
| การ์ด “แอดมินออนไลน์” | นิยามเช่น `users` ที่ `role: 'admin'` และ `lastLoginAt` ภายใน X นาที | `users.lastLoginAt` |
| การ์ด “การเข้าใช้งานวันนี้” | นับ session/login วันนี้ | `auditlogs` ที่ `category: 'auth'` และ `createdAt` วันนี้ หรืออัปเดต `lastLoginAt` รายวัน |
| กิจกรรมล่าสุด | รายการเหตุการณ์ล่าสุด | `auditlogs` เรียง `createdAt` desc + `category` |
| แจ้งเตือนการถอนเงิน | คำขอถอนที่รอดำเนินการ | `withdrawalrequests` ที่ `status: 'pending'` + join `users` สำหรับชื่อ |

---

### 2) `/cms/members` — จัดการสมาชิก

| คอลัมน์ / การกระทำ | ฟิลด์ / คิวรี |
|---------------------|----------------|
| ชื่อ, อีเมล, โทร | `users.name`, `email`, `phone` |
| สถานะ (Active / Inactive / Banned / รอโอน) | `users.memberStatus` และ/หรือแสดง “รอโอน” จาก `pendingTransferAmount` / `WithdrawalRequest` |
| รอโอน | `users.pendingTransferAmount` (หรือ sum pending) |
| วันที่เข้าร่วม | `users.createdAt` |
| ปุ่ม “เพิ่มสมาชิกใหม่” | มักเป็น flow เชิญ/สร้างบัญชี — **ยังไม่มีโมเดลเฉพาะ** จนกว่าจะกำหนด (เช่น invite token) |
| ลิงก์ “จัดการ” → `/cms/members/[id]` | ใช้ `users._id` เป็น `memberId` |

---

### 3) `/cms/members/[memberId]` — รายละเอียดสมาชิก

| ส่วน UI | คอลเลกชัน / ฟิลด์ |
|---------|---------------------|
| โปรไฟล์ | `users` |
| ยอดทั้งหมด / รอโอน | `totalEarnedAllTime`, `pendingTransferAmount` (+ sync กับ `withdrawalrequests`) |
| บัญชีที่ผูก (1 คน 1 บัญชี) | `bankaccounts` หนึ่งเอกสารต่อ `userId` |
| ตารางแคมเปญที่แชร์ | `campaignmemberstats` + join `campaigns` สำหรับชื่อแคมเปญ |
| ประวัติการโอน + ยืนยันโอน | `withdrawalrequests`; ยืนยันแล้วตั้ง `status: 'completed'`, `completedAt`, `processedByUserId` |

---

### 4) `/cms/sponsors` — จัดการสปอนเซอร์

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| ตาราง: ชื่อลูกค้า/สปอนเซอร์, จำนวนแคมเปญ, งบรวม, สถานะ | `sponsors` + aggregate จาก `campaigns` (นับแคมเปญ, sum งบ) |
| เพิ่มสปอนเซอร์จากสมาชิก | `User` ที่เลือก → อัปเดต `role: 'sponsor'` (ถ้ายังไม่ใช่) + สร้าง `sponsors` ด้วย `userId` + `companyName` |

---

### 5) `/cms/sponsors/[sponsorId]` — แคมเปญของสปอนเซอร์

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| สรุปงบรวม / ใช้ / เหลือ | aggregate จาก `campaigns` ของ `sponsorId` |
| รายการแคมเปญ | `campaigns` ที่ `sponsorId` ตรงกัน |
| โมดอลสร้างแคมเปญ (รูป + JSON Flex) | อัปโหลดไป Google Drive แล้วเก็บ `imageUrls` / `flexMessageJsonDriveFileId` ใน `campaigns` |

---

### 6) `/cms/sponsors/[sponsorId]/campaigns/[campaignId]` — รายละเอียดแคมเปญ

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| งบรวม / ใช้ / เหลือ | `campaigns.totalBudget`, `usedBudget` |
| กราฟแนวโน้ม (วัน/สัปดาห์/เดือน) | `campaignsharedailies` (รายวัน) — ระดับชั่วโมงต้องออกแบบเพิ่ม |
| ตารางสมาชิกที่แชร์ | `campaignmemberstats` + join `users` |

---

### 7) `/cms/campaigns` — จัดการแคมเปญ

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| การ์ดจำนวนแคมเปญทั้งหมด / ใช้งาน / ไม่ใช้งาน | `campaigns` — `countDocuments`, `status` ∈ `active` \| `paused` \| `completed` |
| ตารางรายการ | `campaigns` + populate `sponsors.companyName` จาก `sponsorId`; แสดงแท็กจาก **`tagIds` → `campaigntags`** (slug, nameTh) |
| ลิงก์รายละเอียด | ใช้ `campaigns._id` และ `sponsors._id` ใน path (ไม่ใช้ mock id) |

เลเยอร์โค้ด: `lib/cms/campaigns-repository.ts` — ถ้าไม่มี `MONGODB_URI` จะ fallback mock จาก `app/cms/sponsors/data.ts`

---

### 8) `/cms/campaigns/tags` — แท็กแคมเปญ

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| รายการแท็ก | `campaigntags`: `slug` (unique), `nameTh`, `nameEn`, `sortOrder`, **`isActive`** |
| สร้าง default ครั้งแรก | upsert slug `tech` / `beauty` / `food` เมื่อ collection ว่าง (หรือจาก `npm run seed`) |

การนำไปใช้บนแคมเปญ: อัปเดต `campaigns.tagIds` เป็นอาร์เรย์ของ `_id` จาก `campaigntags` (API บันทึกแยกตามที่ออกแบบ)

---

### 9) `/cms/admins` — จัดการแอดมิน

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| รายชื่อ, อีเมล, บทบาท | `users` ที่ `role: 'admin'` (หรือรวม moderator ถ้าขยาย enum ภายหลัง) |
| สถานะ Online / Offline | เปรียบเทียบ `lastLoginAt` กับช่วงเวลาปัจจุบัน (หรือ heartbeat แยก) |
| ล่าสุด | `lastLoginAt` หรือข้อความคำนวณจากค่านี้ |

หมายเหตุ: ถ้าแอดมินไม่ได้ล็อกอินผ่าน LINE แต่ใช้ email/password ภายหลัง อาจต้องมีโมเดลหรือ provider เพิ่ม — ปัจจุบันโครงสร้างอิง `User` + `role`.

---

### 10) `/cms/logs` — ประวัติเข้าใช้งาน

| ส่วน UI | การเก็บใน DB |
|---------|----------------|
| ผู้ใช้งาน, การกระทำ, อุปกรณ์/สถานที่, เวลา | `auditlogs`: `actorUserId`, `action`, `device`, `location`, `ip`, `createdAt`, `category` |

---

### 11) `/cms/ads` — จัดการโฆษณา (มีไฟล์หน้าแต่ไม่อยู่ใน sidebar)

แนะนำให้ใช้ **`campaigns` เป็นชุดเดียวกับแคมเปญในระบบ** เพื่อไม่ซ้ำซ้อน หรือถ้าต้องแยกมุมมอง ให้ใช้ฟิลด์แท็ก/ประเภทใน `campaigns` แทนการสร้างคอลเลกชันโฆษณาแยก จนกว่าจะมีความต่างชัดเจนทางธุรกิจ

---

## ลำดับความสำคัญของการ sync (ธุรกิจ)

1. **ถอนเงิน:** สร้าง/อัปเดต `withdrawalrequests` → อัปเดต `users.pendingTransferAmount` และ `walletBalance` แบบ **transaction**
2. **สปอนเซอร์:** สร้าง `sponsors` คู่กับการตั้ง `users.role = sponsor`
3. **บัญชีธนาคาร:** หนึ่งเอกสารต่อ `userId` — แก้ไขด้วย `findOneAndUpdate` แทกการ insert ซ้ำ

---

## สรุปความครบถ้วนของ CMS กับโมเดลปัจจุบัน

- ครอบคลุมเมนูหลักใน sidebar และหน้า drill-down ที่มีอยู่
- ฟิลด์ `users.lastLoginAt` และ `auditlogs.category` รองรับแดชบอร์ดและ `/cms/logs` ให้ query ชัดเจน
- ส่วนที่ยังเป็น “นโยบาย/อนาคต”: เพิ่มสมาชิกด้วยมือ, แอดมินไม่ใช่ LINE, กราฟรายชั่วโมง — ระบุในเอกสารหลัก `MONGODB_DATA_MODEL.md`

ดูรายละเอียดฟิลด์ทุกคอลเลกชันเพิ่มเติมที่ [MONGODB_DATA_MODEL.md](./MONGODB_DATA_MODEL.md)
