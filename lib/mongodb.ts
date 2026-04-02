import dns from "node:dns";

import mongoose from "mongoose";

/** บางเครื่อง Windows: Node resolve SRV ของ mongodb+srv ได้ ECONNREFUSED — ใช้ DNS สาธารณะชั่วคราว หรือตั้ง MONGODB_DNS_SERVERS / MONGODB_DISABLE_DNS_FIX=1 */
function applyMongoSrvDnsWorkaround(uri: string) {
  if (!uri.startsWith("mongodb+srv://")) return;
  if (process.env.MONGODB_DISABLE_DNS_FIX === "1") return;
  const custom = process.env.MONGODB_DNS_SERVERS?.trim();
  if (custom) {
    dns.setServers(custom.split(/[\s,]+/).filter(Boolean));
    return;
  }
  if (process.platform === "win32") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
}

async function buildStandardMongoUriFromSrv(uri: string): Promise<string | null> {
  if (!uri.startsWith("mongodb+srv://")) return null;
  const parsed = new URL(uri);
  const srvHost = parsed.hostname;
  if (!srvHost) return null;

  const srvRecords = await dns.promises.resolveSrv(`_mongodb._tcp.${srvHost}`);
  if (srvRecords.length === 0) return null;

  const hostList = srvRecords
    .map((r) => `${r.name.replace(/\.$/, "")}:${r.port}`)
    .join(",");

  const txtRecords = await dns.promises.resolveTxt(srvHost).catch(() => []);
  const txtQuery = txtRecords
    .flat()
    .map((x) => x.trim())
    .filter(Boolean)
    .join("&");

  const merged = new URLSearchParams(txtQuery);
  parsed.searchParams.forEach((value, key) => merged.set(key, value));
  if (!merged.has("tls") && !merged.has("ssl")) {
    merged.set("tls", "true");
  }

  const username = parsed.username ? encodeURIComponent(parsed.username) : "";
  const password = parsed.password ? encodeURIComponent(parsed.password) : "";
  const auth = username ? `${username}${password ? `:${password}` : ""}@` : "";
  const dbPath = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.slice(1) : "";

  const query = merged.toString();
  return `mongodb://${auth}${hostList}/${dbPath}${query ? `?${query}` : ""}`;
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }
  const directUri = process.env.MONGODB_URI_DIRECT?.trim();

  applyMongoSrvDnsWorkaround(uri);

  if (cached.conn) {
    return cached.conn;
  }

  const dbName =
    process.env.MONGODB_DB_NAME?.trim() || "flexshare";

  if (!cached.promise) {
    const connectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      /** ถ้า URI เป็น ...mongodb.net/?... โดยไม่มี /ชื่อdb ไดรเวอร์จะใช้ฐาน `test` — บังคับชื่อฐานจริงที่นี่ */
      dbName,
    };
    cached.promise = mongoose
      .connect(uri, connectOptions)
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const code =
          typeof error === "object" && error != null && "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : "";
        const isSrvDnsFailure =
          uri.startsWith("mongodb+srv://") &&
          (code === "ECONNREFUSED" || code === "EBADNAME" || message.includes("querySrv"));
        if (!isSrvDnsFailure) throw error;

        if (directUri) {
          console.warn("[mongodb] Falling back to MONGODB_URI_DIRECT after SRV DNS failure");
          return mongoose.connect(directUri, connectOptions);
        }

        const fallbackUri = await buildStandardMongoUriFromSrv(uri);
        if (!fallbackUri) throw error;
        console.warn("[mongodb] Falling back to standard URI after SRV DNS failure");
        return mongoose.connect(fallbackUri, connectOptions);
      })
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
