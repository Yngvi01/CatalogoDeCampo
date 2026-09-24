/** APIs can return empty bodies or HTML when the hosting platform fails. */
export async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      `O servidor retornou uma resposta ${body.trim() ? "inválida" : "vazia"} (HTTP ${response.status}). Verifique os logs da hospedagem e a configuração do armazenamento.`,
    );
  }
  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string" &&
      data.error.trim()
        ? data.error
        : `Não foi possível concluir a operação (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return data as T;
}
