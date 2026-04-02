/**
 * สร้างค่า ADMIN_JWT_SECRET / USER_JWT_SECRET / SPONSOR_JWT_SECRET แบบสุ่ม (วางใน .env.local)
 *
 * รัน: npm run generate:jwt-secrets
 */
import { randomBytes } from "node:crypto";

const a = randomBytes(32).toString("hex");
const u = randomBytes(32).toString("hex");
const s = randomBytes(32).toString("hex");

console.log("# คัดลอกไปใส่ .env.local (อย่า commit ค่าจริงขึ้น git)\n");
console.log(`ADMIN_JWT_SECRET=${a}`);
console.log(`USER_JWT_SECRET=${u}`);
console.log(`SPONSOR_JWT_SECRET=${s}`);
