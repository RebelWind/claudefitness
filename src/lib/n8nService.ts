const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL;
const N8N_WEBHOOK_TOKEN = import.meta.env.VITE_N8N_WEBHOOK_TOKEN;

export interface N8nSuccessResponse {
  kind: string;
  id: string;
  name: string;
  mimeType: string;
}

export interface N8nAlreadyExistsResponse {
  result: 'already-exists';
}

export type N8nResponse = N8nSuccessResponse[] | N8nAlreadyExistsResponse;

function isAlreadyExists(data: N8nResponse): data is N8nAlreadyExistsResponse {
  return !Array.isArray(data) && (data as N8nAlreadyExistsResponse).result === 'already-exists';
}

export async function createNewProgram(programKey: string): Promise<{
  success: boolean;
  googleFileId?: string;
  googleFileName?: string;
  alreadyExists?: boolean;
}> {
  const name = `${programKey}-SuperHeroDongu`;

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'newprogram',
      programKey,
      name,
    }),
  });

  if (!response.ok) {
    throw new Error(`Webhook hatası: ${response.status}`);
  }

  const data: N8nResponse = await response.json();

  if (isAlreadyExists(data)) {
    return { success: true, alreadyExists: true };
  }

  const file = data[0];
  return {
    success: true,
    googleFileId: file.id,
    googleFileName: file.name,
  };
}

export function generateProgramKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (let i = 0; i < 8; i++) {
    key += chars[array[i] % chars.length];
  }
  return key;
}

export interface BaslangicInput {
  search_key: string;
  girilen_agirlik: number;
  girilen_tekrar: number;
  excel_satir_no: number;
}

export interface BaslangicDetailRow {
  search_key: string;
  agirlik: number;
  tekrar: number;
}

export async function getBaslangicDetails(
  googleFileId: string,
): Promise<BaslangicDetailRow[]> {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'getBaslangicDetails',
      google_file_id: googleFileId,
    }),
  });

  if (!response.ok) {
    throw new Error(`getBaslangicDetails webhook hatası: ${response.status}`);
  }

  return response.json();
}

export async function insertBaslangic(
  googleFileId: string,
  kilo: number,
  inputs: BaslangicInput[],
): Promise<void> {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${N8N_WEBHOOK_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'insertBaslangic',
      kilo,
      google_file_id: googleFileId,
      inputs,
    }),
  });

  if (!response.ok) {
    throw new Error(`insertBaslangic webhook hatası: ${response.status}`);
  }
}
