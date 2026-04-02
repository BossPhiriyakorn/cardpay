"use client";

import {
  DEFAULT_PRIVACY_POLICY_TEXT,
  DEFAULT_TERMS_OF_SERVICE_TEXT,
} from "@/lib/register-legal-defaults";
import { sanitizeThaiPhoneInput, isValidThaiPhoneDigits } from "@/lib/thai-phone";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  Mail,
  Phone,
  User,
  AtSign,
  Ticket,
  FileText,
  X,
  Check,
} from "lucide-react";

export default function RegisterPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [lineDisplayId, setLineDisplayId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [privacyText, setPrivacyText] = useState(DEFAULT_PRIVACY_POLICY_TEXT);
  const [termsText, setTermsText] = useState(DEFAULT_TERMS_OF_SERVICE_TEXT);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/register-legal", { cache: "no-store" })
      .then((r) => r.json())
      .then(
        (d: {
          ok?: boolean;
          privacyPolicyText?: string;
          termsOfServiceText?: string;
        }) => {
          if (cancelled || !d.ok) return;
          if (typeof d.privacyPolicyText === "string" && d.privacyPolicyText.trim()) {
            setPrivacyText(d.privacyPolicyText);
          }
          if (typeof d.termsOfServiceText === "string" && d.termsOfServiceText.trim()) {
            setTermsText(d.termsOfServiceText);
          }
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAuthProfile() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "include" });
        const data = (await res.json()) as {
          ok?: boolean;
          user?: { name?: string; image?: string; firstName?: string; lastName?: string };
        };
        if (!res.ok || !data.ok || !data.user) {
          window.location.assign(
            `/api/auth/line?callbackUrl=${encodeURIComponent(`${window.location.origin}/register`)}`
          );
          return;
        }
        if (cancelled) return;
        const full = String(data.user.name ?? "").trim();
        setAvatarUrl(String(data.user.image ?? ""));
        if (!firstName && !lastName) {
          if (String(data.user.firstName ?? "").trim() || String(data.user.lastName ?? "").trim()) {
            setFirstName(String(data.user.firstName ?? ""));
            setLastName(String(data.user.lastName ?? ""));
          } else if (full) {
            const parts = full.split(/\s+/);
            if (parts.length >= 2) {
              setFirstName(parts[0] ?? "");
              setLastName(parts.slice(1).join(" "));
            } else {
              setFirstName(full);
            }
          }
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }
    void loadAuthProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!termsAccepted) {
      setMessage("กรุณาอ่านและยืนยันนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้บริการ");
      return;
    }
    const phoneDigits = sanitizeThaiPhoneInput(phone);
    if (!isValidThaiPhoneDigits(phoneDigits)) {
      setMessage("กรุณากรอกเบอร์โทร 10 หลัก (ตัวเลข 0–9 เท่านั้น)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phoneDigits,
          lineDisplayId,
          referralCode,
          termsAccepted: true,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "invalid_email") {
          setMessage("รูปแบบอีเมลไม่ถูกต้อง");
        } else if (data.error === "invalid_phone") {
          setMessage("กรุณากรอกเบอร์โทร 10 หลัก (ตัวเลข 0–9 เท่านั้น)");
        } else if (data.error === "missing_name") {
          setMessage("กรุณากรอกชื่อและนามสกุล");
        } else if (data.error === "missing_line_id") {
          setMessage("กรุณากรอกไอดี LINE");
        } else if (data.error === "terms_required") {
          setMessage("กรุณายืนยันนโยบายและข้อกำหนด");
        } else if (data.error === "invalid_referral_code") {
          setMessage("รหัสแนะนำเพื่อนไม่ถูกต้อง");
        } else {
          setMessage("ไม่สามารถบันทึกได้ ลองใหม่อีกครั้ง");
        }
        setLoading(false);
        return;
      }
      window.location.assign("/user");
    } catch {
      setMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setLoading(false);
    }
  }

  function openTermsModal() {
    setModalOpen(true);
  }

  function confirmTermsInModal() {
    setTermsAccepted(true);
    setModalOpen(false);
    setMessage(null);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f3e5f5] via-white to-[#e1bee7]/40">
        <Loader2 className="animate-spin text-[#8e24aa]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f3e5f5] via-white to-[#e1bee7]/40 p-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-lg rounded-3xl border border-[#e1bee7] bg-white/95 shadow-[0_24px_60px_rgba(74,20,140,0.12)] p-8 md:p-10"
      >
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[#8e24aa] rounded-xl rotate-45 flex items-center justify-center shadow-[0_0_20px_rgba(142,36,170,0.35)]">
            <div className="w-5 h-5 bg-white rounded-sm -rotate-45" />
          </div>
          <h1 className="text-2xl font-black text-[#4a148c] tracking-tight">
            สมัครสมาชิก CardPay
          </h1>
          <p className="text-sm text-[#6a1b9a]/75 text-center">
            กรอกข้อมูลให้ครบเพื่อเริ่มใช้งานแอป
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-[#ce93d8] bg-[#f3e5f5] shadow-inner">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt="รูปจาก LINE"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8e24aa]/40 text-xs text-center px-2">
                รูปโปรไฟล์จาก LINE
              </div>
            )}
          </div>
          <p className="text-xs text-[#6a1b9a]/70 text-center max-w-xs">
            รูปโปรไฟล์ดึงจากบัญชี LINE ของคุณโดยอัตโนมัติ (ไม่ต้องอัปโหลด)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
                ชื่อ
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
                <input
                  type="text"
                  required
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                  placeholder="ชื่อ"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
                นามสกุล
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
                <input
                  type="text"
                  required
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                  placeholder="นามสกุล"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              อีเมล
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              เบอร์โทรศัพท์
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="tel"
                required
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(sanitizeThaiPhoneInput(e.target.value))}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="0812345678"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#6a1b9a]/55">กรอกตัวเลข 10 หลักเท่านั้น (เช่น 0812345678)</p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              ไอดี LINE
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="text"
                required
                value={lineDisplayId}
                onChange={(e) => setLineDisplayId(e.target.value)}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="@yourlineid หรือ ID ที่แสดงใน LINE"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#6a1b9a]/55">
              ไม่เกี่ยวกับรหัสยืนยันตัวตนภายใน (UID) — ใช้สำหรับติดต่อและแสดงในโปรไฟล์
            </p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              รหัสแนะนำเพื่อน
            </label>
            <div className="relative">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/50" size={18} />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-[#e1bee7] bg-[#faf5fc] py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="ถ้ามี สามารถกรอกได้"
              />
            </div>
            <p className="mt-1 text-[11px] text-[#6a1b9a]/55">
              เว้นว่างได้ หากไม่มีผู้แนะนำ
            </p>
          </div>

          <div className="rounded-xl border border-[#e1bee7] bg-[#faf5fc]/80 p-4">
            <button
              type="button"
              onClick={() => {
                if (!termsAccepted) openTermsModal();
                else setTermsAccepted(false);
              }}
              className="flex items-start gap-3 w-full text-left"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  termsAccepted
                    ? "border-[#8e24aa] bg-[#8e24aa] text-white"
                    : "border-[#ce93d8] bg-white"
                }`}
              >
                {termsAccepted ? <Check size={14} strokeWidth={3} /> : null}
              </span>
              <span className="text-sm text-[#4a148c] leading-snug">
                <span className="font-bold">นโยบายความเป็นส่วนตัว</span>
                {" และ "}
                <span className="font-bold">ข้อกำหนดการใช้บริการ</span>
                <br />
                <span className="text-[#6a1b9a]/80 text-xs">
                  {termsAccepted
                    ? "กดอีกครั้งเพื่อยกเลิกการยอมรับ (ต้องยอมรับก่อนส่งแบบฟอร์ม)"
                    : "กดที่นี่เพื่ออ่านเอกสารและกดยืนยันในกล่องข้อความ"}
                </span>
              </span>
            </button>
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
            {loading ? "กำลังบันทึก…" : "สมัครสมาชิก"}
          </button>
        </form>
      </motion.div>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-lg max-h-[85vh] rounded-2xl border border-[#e1bee7] bg-white shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#e1bee7] bg-[#faf5fc]">
                <div className="flex items-center gap-2 text-[#4a148c]">
                  <FileText size={22} className="text-[#8e24aa]" />
                  <h2 id="terms-modal-title" className="font-black text-lg">
                    นโยบายและข้อกำหนด
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#f3e5f5] text-[#6a1b9a]"
                  aria-label="ปิด"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-sm text-[#4a148c] leading-relaxed">
                <section>
                  <h3 className="font-black text-[#8e24aa] mb-2">นโยบายความเป็นส่วนตัว</h3>
                  <pre className="whitespace-pre-wrap font-sans text-[13px] text-[#4a148c]/90">
                    {privacyText}
                  </pre>
                </section>
                <section>
                  <h3 className="font-black text-[#8e24aa] mb-2">ข้อกำหนดการใช้บริการ</h3>
                  <pre className="whitespace-pre-wrap font-sans text-[13px] text-[#4a148c]/90">
                    {termsText}
                  </pre>
                </section>
              </div>
              <div className="p-4 border-t border-[#e1bee7] bg-white flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-3 rounded-xl border border-[#e1bee7] text-[#6a1b9a] font-bold text-sm hover:bg-[#faf5fc]"
                >
                  ปิดโดยไม่ยอมรับ
                </button>
                <button
                  type="button"
                  onClick={confirmTermsInModal}
                  className="px-4 py-3 rounded-xl bg-[#8e24aa] text-white font-black text-sm hover:brightness-110"
                >
                  อ่านแล้ว — ยืนยันการยอมรับ
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
