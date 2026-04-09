/**
 * ตรวจว่าโครง Flex เป็น JSON object ที่ parse ได้
 */
export function validateFlexSkeletonJson(skeletonStr: string): string | null {
  try {
    const flex = JSON.parse(skeletonStr) as unknown;
    if (flex === null || typeof flex !== "object" || Array.isArray(flex)) {
      return "invalid_flex_skeleton";
    }
  } catch {
    return "invalid_flex_skeleton";
  }
  return null;
}

function inferFieldType(key: string): "text" | "textarea" | "image" {
  const k = key.toLowerCase();
  if (
    /(^|_)(image|img|photo|picture|hero|banner|r2)($|_)/.test(k) ||
    (/(url|uri)$/.test(k) && /(image|img|photo|hero|banner)/.test(k))
  ) {
    return "image";
  }
  if (/(body|desc|detail|content|message|textarea|long)/.test(k)) {
    return "textarea";
  }
  return "text";
}

/**
 * สแกนจากข้อความ JSON ของเทมเพลต หา placeholder แล้วสร้าง fieldsSpecJson อัตโนมัติ
 * รองรับ: {{ชื่อฟิลด์}} ทุกที่ และค่าสตริงแบบ "{image}" / "{{title}}" ใน JSON
 */
export function deriveFieldsSpecFromSkeleton(skeletonStr: string): string {
  const keysOrdered: string[] = [];
  const seen = new Set<string>();
  const add = (k: string) => {
    const t = k.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    keysOrdered.push(t);
  };

  const reDouble = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = reDouble.exec(skeletonStr)) !== null) {
    add(m[1]);
  }

  const reQuoted =
    /"(\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}|\{[a-zA-Z_][a-zA-Z0-9_]*\})"/g;
  while ((m = reQuoted.exec(skeletonStr)) !== null) {
    const inner = m[1];
    const dm = /^\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}$/.exec(inner);
    if (dm) {
      add(dm[1]);
      continue;
    }
    const sm = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/.exec(inner);
    if (sm) add(sm[1]);
  }

  const fields = keysOrdered.map((key, order) => ({
    key,
    type: inferFieldType(key),
    labelTh: key,
    required: inferFieldType(key) === "image",
    order,
  }));

  return JSON.stringify(fields);
}
