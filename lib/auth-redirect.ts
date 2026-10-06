const APP_ORIGIN = "https://campo.invalid";

export function safeReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return "/";

  try {
    const target = new URL(value, APP_ORIGIN);
    if (target.origin !== APP_ORIGIN) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
