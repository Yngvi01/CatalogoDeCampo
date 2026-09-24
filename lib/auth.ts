import { createHmac, timingSafeEqual } from "node:crypto";
export function token() {
  const expiry = String(Date.now() + 7 * 86400000);
  return `${expiry}.${createHmac("sha256", process.env.CAMPO_PASSWORD || "")
    .update(expiry)
    .digest("hex")}`;
}
export function validToken(value: string | undefined) {
  if (!process.env.CAMPO_PASSWORD) return true;
  if (!value) return false;
  const [expiry, signature] = value.split(".");
  if (
    !expiry ||
    !signature ||
    Number(expiry) < Date.now() ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac("sha256", process.env.CAMPO_PASSWORD)
    .update(expiry)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
