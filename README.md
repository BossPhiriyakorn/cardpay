# CardPay (Flexshare Premium)

แพลตฟอร์มสำหรับแชร์ LINE Flex Message และจัดการแคมเปญ / สมาชิก

## รันบนเครื่อง

**สิ่งที่ต้องมี:** Node.js `24`

โปรเจกต์นี้และ dependency บางตัวรองรับ Node `20`, `22`, `24` เท่านั้น
ถ้าใช้ Node `25` จะติด `npm warn EBADENGINE` ตอน `npm install`

1. ติดตั้ง dependencies: `npm install`
2. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้งค่า (MongoDB, JWT, Google Drive ฯลฯ)
3. รัน dev: `npm run dev`

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

## สคริปต์ที่ใช้บ่อย

| คำสั่ง | คำอธิบาย |
|--------|----------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run seed:cms-admin` | สร้างแอดมิน CMS ใน MongoDB |
| `npm run generate:jwt-secrets` | สร้างค่า `ADMIN_JWT_SECRET` / `USER_JWT_SECRET` |
