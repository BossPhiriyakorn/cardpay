# แผนข้อมูล MongoDB สำหรับ CardPay (FlexShare Premium)

เอกสารนี้สรุปจากการไล่ทุกเมนู/หน้าในโปรเจกต์ (แอปผู้ใช้ + CMS) ว่าควรเก็บอะไรในฐานข้อมูล และคอลเลกชันใดรองรับฟีเจอร์ใด

**เอกสารเฉพาะ CMS (ไล่ทีละเมนู `/cms`, คิวรีและการ sync):** [CMS_MONGODB.md](./CMS_MONGODB.md)

MongoDB จะสร้างคอลเลกชันอัตโนมัติเมื่อมีการ `insert` ครั้งแรกผ่าน Mongoose — ไม่จำเป็นต้องรัน SQL migration

### ความสัมพันธ์ `campaigns` ↔ `campaigntags`

- **`campaigns.tagIds`**: อาร์เรย์ของ `ObjectId` อ้างอิง `campaigntags._id` (หลายแท็กต่อแคมเปญได้)
- ดัชนี multikey บน `tagIds` รองรับการค้นหาแคมเปญตามแท็ก (`$in` / `tagIds: x`)
- **`campaigntags`**: `slug` ไม่ซ้ำ (stable key สำหรับ API/ฟีด); `isActive` ใช้ซ่อนแท็กจากฟีดแอปโดยไม่ลบข้อมูล

---

## สรุปคอลเลกชัน

| คอลเลกชัน | ไฟล์โมเดล | ใช้กับ |
|-----------|-----------|--------|
| `users` | `models/User.ts` | LINE Login, บทบาท, กระเป๋า, สถานะสมาชิก, ข้อมูลติดต่อ, `lastLoginAt` (CMS) |
| `bankaccounts` | `models/BankAccount.ts` | โปรไฟล์ — จัดการบัญชี / CMS — **1 user ต่อ 1 บัญชี** (`userId` unique) |
| `sponsors` | `models/Sponsor.ts` | CMS — จัดการสปอนเซอร์ |
| `campaigns` | `models/Campaign.ts` | ฟีดแคมเปญ, รายละเอียดแคมเปญ, งบประมาณ, Flex JSON บน Drive, **`tagIds` → แท็กหมวด** |
| `campaigntags` | `models/CampaignTag.ts` | แท็กหมวดแคมเปญ (slug, ชื่อไทย/อังกฤษ, ลำดับ, ปิดใช้งาน) — อ้างอิงจาก `campaigns.tagIds` |
| `campaignmemberstats` | `models/CampaignMemberStat.ts` | สมาชิกที่แชร์แต่ละแคมเปญ + ตารางแคมเปญในรายละเอียดสมาชิก |
| `withdrawalrequests` | `models/WithdrawalRequest.ts` | แจ้งเตือนถอนแดชบอร์ด, ประวัติโอน, ยืนยันโอน |
| `auditlogs` | `models/AuditLog.ts` | CMS — ประวัติเข้าใช้งาน / audit / กิจกรรมล่าสุด (`category`) |
| `campaignsharedailies` | `models/CampaignShareDaily.ts` | กราฟแนวโน้มการแชร์ (รายวัน) |
| `userdailystats` | `models/UserDailyStat.ts` | การ์ดยอดเงิน — แชร์วันนี้ / รายได้วันนี้ |

---

## ไล่ทีละเมนู

### แอปผู้ใช้ (Dynamic Island)

| เมนู / หน้า | ข้อมูลที่ต้องเก็บ | คอลเลกชันหลัก |
|-------------|-------------------|----------------|
| หน้าแรก `/user` | สรุปยอดเงิน, แชร์/รายได้วันนี้ | `users`, `userdailystats` |
| โปรไฟล์ `/profile` | ชื่อ, LINE ID, อีเมล, โทร, รูป, กระเป๋า, บัญชีธนาคาร + ไฟล์ KYC | `users`, `bankaccounts` |
| แคมเปญทั้งหมด (ฟีด) | รายการแคมเปญ, รูป, รางวัลต่อแชร์, โควตา, ฟิลเตอร์ตามแท็ก | `campaigns`, `campaigntags` ผ่าน `tagIds` |
| จัดการโฆษณา `/sponsor` | ถ้าใช้มุมมองสปอนเซอร์ — เชื่อม `users` role `sponsor` + `sponsors` + `campaigns` | `users`, `sponsors`, `campaigns` |

### CMS

| เมนู | ข้อมูลที่ต้องเก็บ | คอลเลกชันหลัก |
|------|-------------------|----------------|
| แดชบอร์ด | จำนวนสมาชิก, แคมเปญใช้งาน, แอดมินออนไลน์*, เข้าใช้วันนี้*, กิจกรรมล่าสุด*, แจ้งเตือนถอน | นับจาก `users`, `campaigns`; กิจกรรม/แจ้งเตือนใช้ `auditlogs` หรือ `withdrawalrequests` ตามดีไซน์ |
| จัดการสมาชิก | รายชื่อ, สถานะ, รอโอน, วันที่เข้าร่วม | `users` |
| รายละเอียดสมาชิก | โปรไฟล์, ยอดรวม/รอโอน, ตารางแคมเปญที่แชร์, ประวัติโอน, บัญชีที่ผูก | `users`, `campaignmemberstats`, `withdrawalrequests`, `bankaccounts` |
| จัดการสปอนเซอร์ | สปอนเซอร์, เพิ่มจากสมาชิก | `sponsors`, `users` |
| **จัดการแคมเปญ** (`/cms/campaigns`) | สรุปจำนวน/สถานะ, ตารางรายการ | `campaigns` + join `sponsors` (ชื่อบริษัท), join `campaigntags` (ผ่าน `tagIds`) |
| **แท็กแคมเปญ** (`/cms/campaigns/tags`) | รายการแท็ก, เปิด/ปิดใช้งาน | `campaigntags` (`slug` unique, `isActive`) |
| แคมเปญของสปอนเซอร์ | งบรวม/ใช้/คงเหลือ, รายการแคมเปญ | `campaigns` |
| รายละเอียดแคมเปญ | กราฟแนวโน้ม, สมาชิกที่แชร์ | `campaignsharedailies`, `campaignmemberstats` |
| จัดการแอดมิน | รายชื่อแอดมิน — แนะนำใช้ `users` ที่ `role: admin` (หรือระบบ staff แยกในอนาคต) | `users` |
| ประวัติเข้าใช้งาน | บันทึกการกระทำ | `auditlogs` |
| หน้า `/cms/ads` (ถ้ายังใช้) | โครงสร้างคล้ายแคมเปญโฆษณา — **แนะนำผูกกับ `campaigns` เป็นชุดเดียว** เพื่อไม่ซ้ำซ้อน | `campaigns` |

\* ตัวเลข “แอดมินออนไลน์” / “การเข้าใช้งานวันนี้” มักมาจาก session หรือนับจาก `auditlogs` / ตาราง session — ยังไม่บังคับมีคอลเลกชันแยกในเฟสนี้

---

## การแมปสถานะ UI ↔ ค่าใน DB

- สมาชิก CMS (`Active` / `Inactive` / `Banned` / `รอโอน`): ใช้ `users.memberStatus` = `active` | `inactive` | `banned` | `pending_transfer`
- สปอนเซอร์ / แคมเปญ: `sponsors.status`, `campaigns.status` (ค่าเป็นตัวพิมพ์เล็กในโมเดล)

---

## สคริปต์และการสร้างดัชนี

- รัน `npm run seed` เพื่อเชื่อมต่อและสร้างตัวอย่างข้อมูล (ต้องตั้ง `MONGODB_URI` ใน `.env.local`)
- ดัชนีถูกประกาศใน schema แล้ว — เมื่อแอปรันและมีการเขียนข้อมูล Mongoose จะสร้าง index บน MongoDB ตามที่กำหนด

---

## หมายเหตุ Google Drive

รูปแคมเปญและไฟล์ JSON Flex เก็บบน Drive ตามที่ตั้งค่าใน env — ในฐานข้อมูลเก็บเป็น `imageUrls` / `flexMessageJsonDriveFileId` และใน `bankaccounts` เก็บ id ไฟล์เอกสาร KYC

---

## การตรวจสอบความถูกต้องและความครบถ้วน (รูปแบบการเก็บ)

### 1) สถานะการเชื่อมต่อจริงในโค้ดปัจจุบัน

- **บันทึกลง MongoDB แล้ว:** การลงทะเบียนผ่าน LINE (`User.create` ใน NextAuth `signIn`) เท่านั้น
- **ยังไม่บันทึก:** หน้า CMS / โปรไฟล์ / ฟีดแคมเปญส่วนใหญ่ยังใช้ **mock / state ใน React** — ดังนั้น “รูปแบบโมเดล” พร้อมใช้งาน แต่ **การส่งข้อมูลจาก UI ไป DB ยังไม่ครบ** จนกว่าจะมี API routes + เรียกจากหน้าเหล่านั้น

### 2) รูปแบบที่ถือว่าเหมาะสม

- ใช้ **ObjectId + ref** ระหว่าง `User` ↔ `BankAccount` / `Sponsor` / `CampaignMemberStat` / `WithdrawalRequest` เป็นแนวทางมาตรฐานของ MongoDB/Mongoose
- แยก **งบแคมเปญ** (`usedBudget`, `totalBudget`) ออกจาก **จำนวนครั้งแชร์** (`currentShares`, `quota`) ถูกต้อง เพราะเป็นหน่วยคนละชนิด
- **`CampaignMemberStat`** แบบ unique `(campaignId, userId)` เหมาะกับตารางสรุปต่อคน

### 3) จุดที่ต้องกำหนดกฎธุรกิจ (ไม่ใช่ bug ของ schema แต่ต้องออกแบบ API)

| หัวข้อ | คำอธิบาย |
|--------|-----------|
| `users.pendingTransferAmount` vs `WithdrawalRequest` | ถ้าเก็บทั้งยอดรวมบน user และรายการ pending แยก อาจ **ไม่ตรงกัน** หลายคำขอพร้อมกัน — แนะนำ: **ยอดรวม pending = ผลรวมจาก `WithdrawalRequest` สถานะ `pending`** หรืออัปเดตฟิลด์บน user ด้วย **transaction** ทุกครั้งที่สร้าง/ยืนยัน/ยกเลิก |
| `users.memberStatus` = `pending_transfer` | อาจ **ซ้ำกับ** การมีคำขอถอนค้าง — ควรตัดสินใจว่าใช้สถานะนี้เป็นตัวจริง หรือแสดง “รอโอน” จากยอด/คำขอถอนอย่างเดียว |
| `users.walletBalance` | ต้องนิยามชัด: คงเหลือถอนได้ / หักแล้วหรือยังเมื่อสร้างคำขอถอน — ควรเขียน flow ชัด (hold vs available) |
| กราฟรายละเอียดแคมเปญแบบ **รายชั่วโมง** | `CampaignShareDaily` เก็บได้ระดับ **วัน** — กราฟตามชั่วโมงในหน้า CMS ต้องเพิ่มคอลเลกชันอีกชุด (เช่น รายชั่วโมง) หรือเก็บ **อีเวนต์แชร์รายครั้ง** แล้ว aggregate |

### 4) ความปลอดภัยและความละเอียดของข้อมูล

- เลขบัญชีใน `BankAccount` เก็บเป็น **สตริงธรรมดา** — สำหรับ production ควรพิจารณา **เข้ารหัสที่ระดับแอป** หรือนโยบาย masking + สิทธิ์เข้าถึง CMS
- ตัวเลขเงินใช้ `Number` — พอใช้กับ THB ทั่วไป; ถ้าต้องการความแม่นยำระดับบัญชี อาจเปลี่ยนเป็น **เก็บสตางค์เป็นจำนวนเต็ม** หรือ Decimal128

### 5) ฟิลด์ที่เสริมเพื่อให้สอดคล้องฟีเจอร์ CMS

- `WithdrawalRequest.processedByUserId` — ผู้แอดมินที่ยืนยันโอน (สอดคล้องปุ่ม “ยืนยันโอน”)
- `BankAccount` — **1 คน 1 บัญชี:** `userId` เป็น unique — การเปลี่ยนบัญชีทำด้วย `findOneAndUpdate` เอกสารเดิมหรือลบแล้วสร้างใหม่ภายใต้ transaction ตามนโยบาย

### สรุป

- **รูปแบบการเก็บ (โครงสร้างคอลเลกชันและความสัมพันธ์):** เหมาะสมเป็นฐานสำหรับ CardPay แต่มีจุดที่ต้อง **กำหนดกฎธุรกิจและ flow การอัปเดต** เป็นข้อเขียน (ไม่ใช่แค่ schema)
- **ความครบถ้วนการ “ส่งข้อมูลไปเก็บ”:** ยัง **ไม่สมบูรณ์** ในระดับแอปพลิเคชัน — ต้องเชื่อม API แต่ละเมนูต่อจากโมเดลนี้
