import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

// Keep the destination fixed so browser credentials can never be redirected to
// an arbitrary server. Configure PAWSYNC_SESSION_SECRET in Vercel's environment.
const THINGSBOARD = "https://thingsboard.cloud";
const COOKIE = "pawsync_session";
const SHARED_KEYS = ["capacityG", ...[1, 2, 3].flatMap((i) => [`s${i}_enabled`, `s${i}_time`, `s${i}_grams`, `s${i}_dayMask`])].join(",");
type Session = { token: string; deviceId: string; deviceName: string; expiresAt: number };

function json(statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  return { statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }, body: JSON.stringify(body) };
}
function signingKey() {
  const value = process.env.PAWSYNC_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("Configure PAWSYNC_SESSION_SECRET in Vercel environment variables (32+ random characters).");
  return value;
}
function signature(payload: string) { return createHmac("sha256", signingKey()).update(payload).digest("base64url"); }
function setCookie(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${COOKIE}=${payload}.${signature(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`;
}
function getSession(event: any): Session | null {
  const cookie = String(event.headers?.cookie ?? "").split(";").map((part: string) => part.trim()).find((part: string) => part.startsWith(`${COOKIE}=`));
  if (!cookie) return null;
  const value = cookie.slice(COOKIE.length + 1);
  const split = value.lastIndexOf(".");
  if (split < 1) return null;
  const payload = value.slice(0, split);
  const got = Buffer.from(value.slice(split + 1));
  const expected = Buffer.from(signature(payload));
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch { return null; }
}
async function tb(session: Session, path: string, init?: RequestInit) {
  const response = await fetch(`${THINGSBOARD}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Authorization": `Bearer ${session.token}`, ...init?.headers },
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* report an HTTP error below */ }
  if (!response.ok) throw Object.assign(new Error(data.message || `ThingsBoard returned HTTP ${response.status}.`), { status: response.status });
  return data;
}
async function login(body: any) {
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const deviceName = String(body.deviceName ?? "").trim();
  if (!username || !password || !deviceName) return json(400, { message: "Email, password, and device name are required." });
  const authResponse = await fetch(`${THINGSBOARD}/api/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
  });
  const auth: any = await authResponse.json().catch(() => ({}));
  if (!authResponse.ok || !auth.token) return json(401, { message: "ThingsBoard sign in failed. Check the account." });
  // Query only devices visible to the signed-in user so customer users can log
  // in without receiving tenant-administrator access.
  const lookup = await fetch(`${THINGSBOARD}/api/user/devices?pageSize=100&page=0&textSearch=${encodeURIComponent(deviceName)}`, { headers: { "X-Authorization": `Bearer ${auth.token}` } });
  const devicePage: any = await lookup.json().catch(() => ({}));
  const device = Array.isArray(devicePage?.data)
    ? devicePage.data.find((entry: any) => entry.name === deviceName)
    : Array.isArray(devicePage) ? devicePage.find((entry: any) => entry.name === deviceName) : null;
  if (!lookup.ok || !device?.id?.id) return json(404, { message: "Device not found in the signed-in user's ThingsBoard access. Assign it to that user's Customer and check the device name." });
  const session: Session = { token: auth.token, deviceId: device.id.id, deviceName, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
  return json(200, { ok: true, deviceName }, { "Set-Cookie": setCookie(session) });
}
function latest(data: Record<string, any[]>, key: string) { return data[key]?.[0] ?? null; }
function tsPath(session: Session, keys: string, suffix = "") {
  return `/api/plugins/telemetry/DEVICE/${session.deviceId}/values/timeseries?keys=${keys}${suffix}`;
}
async function makeStatus(session: Session) {
  const now = Date.now();
  const [timeseries, capacityRows, feedData, enabledRows] = await Promise.all([
    tb(session, tsPath(session, "weight,foodRemainingPct,motorOn,deviceTime")),
    tb(session, `/api/plugins/telemetry/DEVICE/${session.deviceId}/values/attributes/SHARED_SCOPE?keys=capacityG`),
    tb(session, tsPath(session, "feedTime,feedSource,feedActualG,feedResult", `&startTs=${now - 30 * 864e5}&endTs=${now}&limit=100&orderBy=DESC`)),
    tb(session, `/api/plugins/telemetry/DEVICE/${session.deviceId}/values/attributes/SHARED_SCOPE?keys=s1_enabled,s2_enabled,s3_enabled`),
  ]);
  const point = latest(timeseries, "weight");
  const weight = Number(point?.value ?? 0);
  const capacity = Number(capacityRows.find((row: any) => row.key === "capacityG")?.value ?? 5000);
  const online = Boolean(point && now - Number(point.ts) < 60_000);
  const grouped = new Map<number, Record<string, unknown>>();
  for (const [key, entries] of Object.entries(feedData as Record<string, any[]>)) for (const entry of entries) {
    const row = grouped.get(Number(entry.ts)) ?? {};
    row[key] = entry.value;
    grouped.set(Number(entry.ts), row);
  }
  const recentFeedings = [...grouped.entries()]
    .filter(([, row]) => ["DONE", "STOPPED"].includes(String(row.feedResult)) && Number(row.feedActualG) > 0)
    .sort(([a], [b]) => b - a)
    .map(([ts, row]) => ({
      id: ts, grams: Number(row.feedActualG),
      timestamp: Number.isFinite(Date.parse(String(row.feedTime))) ? Math.floor(Date.parse(String(row.feedTime)) / 1000) : Math.floor(ts / 1000),
      source: String(row.feedSource) === "schedule" ? "schedule" : "manual",
    }));
  const schedulesEnabled = [1, 2, 3].filter((i) => {
    const row = enabledRows.find((item: any) => item.key === `s${i}_enabled`);
    return row?.value === true || row?.value === "true";
  }).length;
  return {
    deviceId: session.deviceId, deviceName: session.deviceName, online, wifiConnected: online, jammed: false,
    mode: String(latest(timeseries, "motorOn")?.value) === "true" ? "feeding" : online ? "ready" : "offline",
    foodRemainingGrams: weight, foodCapacityGrams: capacity,
    foodLevelPercent: capacity > 0 ? Math.max(0, Math.min(100, weight / capacity * 100)) : 0,
    schedulesEnabled, lastFeeding: recentFeedings[0] ?? null, recentFeedings, simulation: false,
  };
}
async function getSchedules(session: Session) {
  const rows = await tb(session, `/api/plugins/telemetry/DEVICE/${session.deviceId}/values/attributes/SHARED_SCOPE?keys=${SHARED_KEYS}`);
  const attrs = Object.fromEntries(rows.map((row: any) => [row.key, row.value]));
  return { schedules: [1, 2, 3].map((i) => ({
    id: `slot${i}`, name: ["Breakfast", "Lunch", "Dinner"][i - 1],
    time: String(attrs[`s${i}_time`] ?? ["08:00", "12:00", "18:00"][i - 1]).slice(0, 5),
    grams: Number(attrs[`s${i}_grams`] ?? 50),
    enabled: attrs[`s${i}_enabled`] === true || attrs[`s${i}_enabled`] === "true",
    dayMask: Number(attrs[`s${i}_dayMask`] ?? 127),
  })) };
}

export const handler = async (event: any) => {
  try {
    const action = String(event.queryStringParameters?.action ?? "");
    const body = event.body ? JSON.parse(event.body) : {};
    if (action === "login" && event.httpMethod === "POST") return await login(body);
    if (action === "logout" && event.httpMethod === "POST") return json(200, { ok: true }, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    const session = getSession(event);
    if (!session) return json(401, { message: "Please sign in to ThingsBoard." });
    if (action === "session" && event.httpMethod === "GET") return json(200, { ok: true, deviceName: session.deviceName });
    if (action === "status" && event.httpMethod === "GET") return json(200, await makeStatus(session));
    if (action === "feed" && event.httpMethod === "POST") {
      const grams = Number(body.grams);
      if (!Number.isInteger(grams) || grams < 10 || grams > 250) return json(400, { result: "portion must be 10–250 grams" });
      const result = await tb(session, `/api/rpc/twoway/${session.deviceId}`, { method: "POST", body: JSON.stringify({ method: "feedNow", params: { grams }, timeout: 8000 }) });
      if (result.ok === false) return json(409, { result: "feeder busy or out of food" });
      return json(202, { ok: true, result: "accepted", requestId: randomUUID(), grams, foodRemainingGrams: Number(result.foodRemainingGrams ?? 0) });
    }
    if (action === "stop" && event.httpMethod === "POST") {
      await tb(session, `/api/rpc/twoway/${session.deviceId}`, { method: "POST", body: JSON.stringify({ method: "stopFeed", params: {}, timeout: 8000 }) });
      return json(200, { ok: true });
    }
    if (action === "schedules" && event.httpMethod === "GET") return json(200, await getSchedules(session));
    if (action === "schedules" && event.httpMethod === "PUT") {
      const list = body.schedules;
      if (!Array.isArray(list) || list.length > 3) return json(400, { result: "maximum three schedules" });
      const attrs: Record<string, unknown> = {};
      for (let i = 1; i <= 3; i++) {
        const row = list[i - 1];
        if (row && (typeof row.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time) || !Number.isInteger(row.grams) || row.grams < 1 || row.grams > 500)) return json(400, { result: "invalid schedule" });
        attrs[`s${i}_enabled`] = Boolean(row?.enabled);
        attrs[`s${i}_time`] = row?.time ?? ["08:00", "12:00", "18:00"][i - 1];
        attrs[`s${i}_grams`] = Number(row?.grams ?? 50);
        attrs[`s${i}_dayMask`] = Number(row?.dayMask ?? 127);
      }
      await tb(session, `/api/plugins/telemetry/DEVICE/${session.deviceId}/SHARED_SCOPE`, { method: "POST", body: JSON.stringify(attrs) });
      return json(200, { ok: true });
    }
    return json(404, { result: "not found" });
  } catch (error) {
    return json(Number((error as any)?.status ?? 500), { message: error instanceof Error ? error.message : "Request failed." });
  }
};
