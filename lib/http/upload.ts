import { api, send } from "@/components/shared";
export async function uploadDirect(file: File, purpose: "photo" | "import") {
  const upload = await api<{ url: string; ticket: string }>(
    "uploads",
    send({
      name: file.name,
      type: file.type,
      size: file.size,
      purpose,
    }),
  );
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const response = await fetch(upload.url, {
    method: "PUT",
    body,
    headers: { "x-upsert": "false" },
  });
  if (!response.ok)
    throw new Error(
      `Não foi possível enviar o arquivo (HTTP ${response.status}).`,
    );
  return upload.ticket;
}
