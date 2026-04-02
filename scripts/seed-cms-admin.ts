/**
 * สร้าง/อัปเดตแอดมิน CMS ใน MongoDB (รหัสผ่านไม่เก็บใน .env — ใช้แค่ตอนรันคำสั่งนี้ครั้งเดียวหรือเมื่อต้องการรีเซ็ต)
 *
 * ค่าเริ่มต้น (ถ้าไม่ได้ตั้ง SEED_ADMIN_*): ชื่อผู้ใช้ `admin1234` / รหัสผ่าน `admin1234`
 * โปรดเปลี่ยนในฐานข้อมูลหรือรันใหม่ด้วย env ถ้าใช้ production
 *
 * รัน (PowerShell / bash):
 *   npm run seed:cms-admin
 *   หรือ npx tsx scripts/seed-cms-admin.ts
 *
 * ทับค่าด้วย env ชั่วคราว:
 *   $env:SEED_ADMIN_USERNAME="myuser"; $env:SEED_ADMIN_PASSWORD="YourStrongPassword"; npx tsx scripts/seed-cms-admin.ts
 *
 * Linux/macOS:
 *   SEED_ADMIN_USERNAME=myuser SEED_ADMIN_PASSWORD='YourStrongPassword' npx tsx scripts/seed-cms-admin.ts
 *
 * หมายเหตุ: ถ้าเคยใช้ฟิลด์ `email` ใน MongoDB แล้วเปลี่ยนมาใช้ `username` ให้ลบเอกสารเก่าหรือ migrate ฟิลด์ก่อน seed ใหม่
 */

import { config } from "dotenv";
import { resolve } from "path";
import bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase } from "../lib/mongodb";
import CmsAdmin from "../models/CmsAdmin";

const DEFAULT_SEED_USERNAME = "admin1234";
const DEFAULT_SEED_PASSWORD = "admin1234";
const DEFAULT_SEED_ROLE = "admin";

async function main() {
  const username = (
    process.env.SEED_ADMIN_USERNAME ?? DEFAULT_SEED_USERNAME
  ).trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD;
  const role = process.env.SEED_ADMIN_ROLE === "reviewer" ? "reviewer" : DEFAULT_SEED_ROLE;

  if (!username || !password) {
    console.error("ชื่อผู้ใช้และรหัสผ่านต้องไม่ว่าง (หรือลบ env ที่ส่งมาเป็นค่าว่าง)");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("รหัสผ่านควรยาวอย่างน้อย 8 ตัวอักษร");
    process.exit(1);
  }

  await connectToDatabase();

  const passwordHash = await bcrypt.hash(password, 12);

  const doc = await CmsAdmin.findOneAndUpdate(
    { username },
    {
      $set: {
        passwordHash,
        role,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("สร้าง/อัปเดตแอดมินแล้ว:", doc.username);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
