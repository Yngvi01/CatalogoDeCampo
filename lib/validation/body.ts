export async function limitedBody(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("O envio excede o limite de tamanho.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("O envio excede o limite de tamanho.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function limitedForm(request: Request, maxBytes: number) {
  return new Response(await limitedBody(request, maxBytes), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
export async function limitedJson(request: Request, maxBytes = 1024 * 1024) {
  return JSON.parse(
    new TextDecoder().decode(await limitedBody(request, maxBytes)),
  );
}
