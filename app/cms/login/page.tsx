"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Lock, User, Loader2 } from "lucide-react";

export default function CmsLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "config") {
      setMessage("ระบบยังไม่ตั้งค่า ADMIN_JWT_SECRET หรือสั้นเกินไป");
    }
    fetch("/api/auth/admin/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; authenticated?: boolean }) => {
        if (d.ok && d.authenticated) {
          window.location.replace("/cms/dashboard");
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        if (data.error === "database_unavailable") {
          setMessage("เชื่อมต่อฐานข้อมูลไม่ได้ — ตรวจสอบ MONGODB_URI (Atlas SRV) หรือกำหนด MONGODB_URI_DIRECT");
        } else if (data.error === "token_config") {
          setMessage("ตั้งค่า ADMIN_JWT_SECRET อย่างน้อย 32 ตัวอักษร (รัน npm run generate:jwt-secrets)");
        } else {
          setMessage("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือยังไม่มีแอดมินในระบบ (รัน npm run seed:cms-admin)");
        }
        setLoading(false);
        return;
      }

      // Force full navigation so cookie-protected CMS route is evaluated immediately.
      window.location.assign("/cms/dashboard");
    } catch {
      setMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f3e5f5] via-white to-[#e1bee7]/40 p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md rounded-3xl border border-[#e1bee7] bg-white/95 shadow-[0_24px_60px_rgba(74,20,140,0.12)] p-8 md:p-10"
      >
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 bg-[#8e24aa] rounded-xl rotate-45 flex items-center justify-center shadow-[0_0_20px_rgba(142,36,170,0.35)]">
            <div className="w-5 h-5 bg-white rounded-sm -rotate-45" />
          </div>
          <h1 className="text-2xl font-black text-[#4a148c] tracking-tight">CMS Admin</h1>
          <p className="text-sm text-[#6a1b9a]/75 text-center">เข้าสู่ระบบจัดการแคมเปญและสมาชิก</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              ชื่อผู้ใช้
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="admin1234"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {message ? (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8e24aa] text-white font-black py-3.5 text-sm hover:brightness-110 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : null}
            {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-[#6a1b9a]/55 leading-relaxed">
          โทเคนแอดมินเก็บใน HttpOnly cookie แยกจากผู้ใช้ที่ล็อกอินผ่าน LINE (NextAuth)
        </p>
      </motion.div>
    </div>
  );
}
