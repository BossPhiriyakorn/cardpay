# วิเคราะห์โปรเจกต์ MagicBiz-Card (`line_flex_tem`) → นำไปใช้กับ CardPay

อ้างอิงโค้ดจาก  
`CodeingWork/line_flex_/linedlex2/line_flex_tem`  
(Express + Next.js frontend, PostgreSQL, LINE LIFF + Messaging)

---

## 1) ภาพรวมการ “แชร์การ์ด Flex”

| ขั้นตอน | รายละเอียด |
|---------|-------------|
| ผู้ใช้สร้างการ์ด | Backend สร้าง `unique_id`, สร้าง **ลิงก์ LIFF สำหรับแชร์**, แทนที่ placeholder ใน template, บันทึก JSON (ไฟล์ใน `json/` หรือ Google Drive) + แถวในตาราง `user_cards` |
| ปุ่มบน Flex | ใน template ใช้ `action.type === "uri"` และใส่ **`{liff_url}`** — ตอนสร้างการ์ดจะถูกแทนที่เป็น URL จริง |
| ผู้รับกดปุ่ม / เปิดลิงก์ | เปิด **LIFF** (`https://liff.line.me/<LIFF_ID>?name=...&id=...`) → หน้า `/share` |
| ใน LIFF | โหลด LIFF SDK → `liff.init({ liffId })` → ถ้ายังไม่ล็อกอินเรียก `liff.login()` → ดึง JSON จาก API → ประกอบ **Flex Message** → `liff.shareTargetPicker([flexMessage])` เพื่อเลือกแชทแล้วส่งข้อความ |

**สำคัญ:** `shareTargetPicker` ใช้ได้ **เฉพาะเมื่อเปิด LIFF ภายในแอป LINE** (`liff.isInClient() === true`) — ถ้าเปิดลิงก์ในเบราว์เซอร์นอก LINE โค้ดจะ redirect ไปหน้าอื่น (เช่น `/home`) ตาม logic ใน `Share.jsx`

---

## 2) รูปแบบลิงก์ที่ “ถูกต้อง” สำหรับปุ่มแชร์ (ใน MagicBiz)

สร้างที่ `controllers/cardController.js` (ตอนสร้างการ์ด):

```text
https://liff.line.me/${LIFF_ID}?name=${uniqueId}&id=1
```

- **`LIFF_ID`** — จาก `.env` (`LIFF_ID`) ต้องตรงกับ LIFF app ใน LINE Developers  
- **`name`** — ใช้ระบุการ์ด (เทียบเท่า `unique_id` หรือชื่อไฟล์ JSON โดยไม่มี `.json`)  
- **`id`** — index ในอาร์เรย์ `tectony1` (การ์ดหลายใบในไฟล์เดียว; ค่าเริ่มต้น `1` = `tectony1[1]`)

ใน LINE Developers ต้องตั้ง **Endpoint URL** ของ LIFF app นี้ให้ชี้ไปที่หน้าแชร์จริงของโดเมนคุณ เช่น  
`https://your-domain.com/share`  
(หรือ path ที่ Next ของคุณใช้ — ใน MagicBiz คือ `/share`)

---

## 3) โครงสร้าง JSON ที่ระบบใช้ (tectony1)

ไฟล์ที่บันทึก (และที่ `/api/card-json/:name` ส่งกลับ) ใช้รูปแบบจาก `utils/templateEngine.js`:

```json
{
  "tectony1": [
    { "linemsg": "ข้อความ alt สำหรับแชร์ (สูงสุด ~400 ตัวอักษรใน client)" },
    { "type": "bubble" หรือ "carousel", "...": "..." }
  ]
}
```

- `tectony1[0].linemsg` → ใช้เป็น **altText** ของ Flex  
- `tectony1[1]` → เป็น **contents** ของ bubble/carousel (โครงสร้างตาม [Flex Message](https://developers.line.biz/en/docs/messaging-api/using-flex-messages/))

หน้าแชร์ (`frontend/app/Share.jsx`) ตรวจว่า `contents.type` เป็น `bubble` หรือ `carousel` แล้วสร้าง:

```js
{ type: 'flex', altText, contents: { ...tectony1[1] } }
```

---

## 4) API ที่เกี่ยวกับการอ่าน JSON และ LIFF

| Endpoint | หน้าที่ |
|----------|---------|
| `GET /api/liff-id` | ส่ง `{ success, liff_id }` จาก `process.env.LIFF_ID` ให้ frontend เรียก `liff.init` |
| `GET /api/liff-login-id` | ใช้ LIFF อีกตัวสำหรับ login (`LIFF_LOGIN_ID` หรือ fallback `LIFF_ID`) |
| `GET /api/card-json/:name` | โหลด JSON การ์ด: ค้นจาก DB (`json_file_name` หรือ `unique_id`) แล้วอ่านจาก **Google Drive** (`drive_json_file_id`) หรือไฟล์ในโฟลเดอร์ `json/` |

นอกจากนี้มี **`GET /api/drive-image/:fileId`** — proxy รูปจาก Drive เพื่อให้แสดงใน LINE ได้ (แก้ปัญหา URL Drive ไม่โหลดใน in-app browser)

---

## 5) Placeholder สำคัญใน Template (ปุ่มแชร์)

- **`{liff_url}`** — แทนที่ด้วย URL แชร์จริง (สตริงเดียวกับที่สร้างตอน `create-card`)  
- ฟังก์ชัน `replaceLiffUrlPlaceholder` ใน `cardController.js` ยังรองรับการแทนที่ทั้ง object สำหรับกรณีอื่น  
- `injectProfileIntoFlexJson` — แทนที่ `tel:` / `mailto:` จากโปรไฟล์

CMS มีคำอธิบายใน `frontend/app/cms/templates/page.jsx` และ `create-custom/page.jsx` ว่าต้องมี `{liff_url}` ในปุ่มแชร์

---

## 6) สิ่งที่ต้องตั้งใน LINE Developers (สรุป)

1. **LIFF app (แชร์)**  
   - Endpoint URL = URL ของหน้า `/share` บนโดเมนที่ deploy จริง  
   - เปิด scope ที่ต้องใช้ (เช่น `profile`, `openid` ตามที่ login ใช้)  
   - เปิดการใช้ **Share Target Picker** ตามเอกสาร LIFF (ถ้า error `shareTargetPicker is not allowed` ต้องไปเปิดใน console)

2. **Channel** เดียวกับ Messaging API / Login (ตามที่โปรเจกต์ผูก)

3. **Optional:** LIFF แยกสำหรับ login (`/liff/login`) — MagicBiz ใช้ `LIFF_LOGIN_ID` แยกได้

---

## 7) นำมาใช้กับโปรเจกต์ CardPay (`flexshare-premium`) อย่างไร

โปรเจกต์ปัจจุบันเป็น **Next.js App Router + MongoDB + Google Drive** โดย `Campaign` มี `flexMessageJsonDriveFileId`, `imageUrls` อยู่แล้ว

### แนวทางที่สอดคล้องกับ MagicBiz

| หัวข้อ | แนวทาง |
|--------|--------|
| เก็บ Flex JSON | เก็บบน Google Drive (มี `lib/googleDriveUpload.ts`) — เก็บ `fileId` ใน `Campaign.flexMessageJsonDriveFileId` (หรืออ่านผ่าน API คล้าย `getCardJson`) |
| ลิงก์แชร์ | สร้าง `https://liff.line.me/<NEXT_PUBLIC_LIFF_SHARE_ID>?campaignId=<id>&id=1` (หรือใช้ `name` = id ไฟล์ — ให้สอดคล้องกับ API ที่อ่าน JSON) |
| หน้า LIFF ใน Next | เพิ่ม route เช่น `app/share/page.tsx` (หรือ `/liff/share`) — พอร์ต logic จาก `Share.jsx`: `fetch('/api/liff-id')` → `liff.init` → `fetch('/api/campaign-flex-json/...')` → `shareTargetPicker` |
| API | `GET /api/liff-id`, `GET /api/campaign-flex-json/[campaignId]` ดึง JSON จาก Drive/Mongo แล้วคืนรูปแบบ `tectony1` หรือคืนเป็น `{ type, altText, contents }` แล้วให้ฝั่ง client ห่อเป็น Flex message |
| Env | `LIFF_ID` (หรือแยก `LIFF_SHARE_ID` / `LIFF_LOGIN_ID` ให้ชัด) + โดเมนใน `NEXTAUTH_URL` / public URL ตรงกับที่ใส่ใน LINE |

### ความต่างที่ต้องตัดสินใจ

- MagicBiz ใช้ **PostgreSQL + `user_cards`** — CardPay ใช้ **Campaign เป็นศูนย์กลาง** — mapping คือ “หนึ่งแคมเปญ = หนึ่งชุด Flex + ลิงก์แชร์”  
- ถ้าต้องการ placeholder `{liff_url}` ใน template เหมือนเดิม — ตอนสร้าง/อัปเดตแคมเปญให้ **แทนที่ `{liff_url}`** ด้วย URL ที่สร้างจาก `NEXT_PUBLIC_APP_URL` + `LIFF_ID` + query ที่ออกแบบไว้

---

## 8) ไฟล์อ้างอิงหลักใน MagicBiz (ถ้าจะเปิดดูต้นฉบับ)

- `frontend/app/Share.jsx` — flow LIFF + `shareTargetPicker`  
- `frontend/app/liff/login/page.jsx` — redirect ไป LINE Login  
- `routes/api.js` — `GET /api/card-json/:name`, `/api/liff-id`  
- `controllers/cardController.js` — `getCardJson`, `replaceLiffUrlPlaceholder`, สร้าง `liffUrl`  
- `utils/templateEngine.js` — `tectony1`, `createFlexMessageJson`  
- `server.js` — โฟลเดอร์ `json/`, static `/json`

---

## สรุปสั้นๆ

- **แชร์การ์ด** = ลิงก์ **LIFF** ที่ชี้มาหน้า `/share` + query ระบุการ์ด → โหลด JSON → **shareTargetPicker**  
- **ลิงก์ปุ่มที่ถูกต้อง** = `https://liff.line.me/<LIFF_ID>?name=<รหัสการ์ด>&id=<index>` และใน Flex ใช้ `{liff_url}` แทนที่ก่อนส่งออก  
- **JSON** = โครง `tectony1` หรืออย่างน้อยต้องแปลงให้ได้ `bubble`/`carousel` สำหรับ `shareTargetPicker`  
- **นำไปใช้กับ CardPay** = เพิ่มหน้า LIFF + API อ่าน Flex จาก Drive/Mongo ตาม `Campaign` และตั้งค่า LINE Developers ให้ Endpoint ตรงกับ URL จริงของแอปคุณ

---

## CardPay — สิ่งที่ implement แล้วใน repo นี้

| รายการ | ตำแหน่ง |
|--------|---------|
| หน้า LIFF แชร์ | `app/share/page.tsx` — query `campaignId`, `id` (index Flex ใน `tectony1`, default 1) |
| LIFF config API | `GET /api/liff/config` → `{ liffId }` |
| ดึง Flex JSON | `GET /api/campaigns/[campaignId]/flex-json` — อ่านจาก Drive ตาม `Campaign.flexMessageJsonDriveFileId` |
| สร้างลิงก์แชร์ (ฝั่ง server/CMS) | `lib/liffShare.ts` — `buildCampaignShareLiffUrl(liffId, campaignId, templateIndex)` |
| แปลง JSON | `lib/flexMessage.ts` — `normalizeFlexForShare` รองรับ `tectony1` และ Flex มาตรฐาน |
| ดึงไฟล์จาก Drive | `downloadDriveFileAsUtf8` ใน `lib/googleDrive.ts` |

**ลิงก์แชร์:** `https://liff.line.me/<LIFF_ID>?campaignId=<MongoId>&id=1`  
ตั้ง `NEXT_PUBLIC_LIFF_ID` หรือ `LIFF_ID` ใน env และ **Endpoint URL** ของ LIFF = `https://<โดเมนของคุณ>/share`
