// @ts-ignore Deno Edge Runtime URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno:
  | {
      env?: { get?(key: string): string | undefined };
      serve?(handler: (request: Request) => Promise<Response> | Response): void;
    }
  | undefined;

type SupportedLanguage = 'ar' | 'fr' | 'en' | 'es' | 'de' | 'pt';

export interface OutboxRecipient {
  userId: string;
  role: string;
  language: string;
  telegramUserId: number;
}

export interface ClaimedOutboxItem {
  id: string;
  eventType: string;
  sourceId: string | null;
  attemptCount: number;
  createdAt: string;
  studentLabel: string | null;
  classLabel: string | null;
  decision?: string | null;
  recipients: OutboxRecipient[];
}

export interface WorkerDependencies {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  jwtSecret?: string;
  createRpcClient?: typeof createClient;
  botToken?: string;
  fetcher?: typeof fetch;
  claimBatch?: (limit: number) => Promise<ClaimedOutboxItem[]>;
  acknowledgeDelivery?: (input: {
    outboxId: string;
    succeeded: boolean;
    providerMessageId?: string | null;
    error?: string | null;
  }) => Promise<unknown>;
}

function getEnv(key: string): string | undefined {
  if (typeof Deno !== 'undefined' && Deno?.env && typeof Deno.env.get === 'function') {
    return Deno.env.get(key);
  }
  return undefined;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function parseBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

// This is only an early rejection filter. PostgREST must still authenticate the
// incoming credential and enforce the service_role-only RPC EXECUTE grants.
async function serviceCredentialCandidate(token: string, configuredKey: string, jwtSecret: string): Promise<boolean> {
  if (configuredKey && timingSafeEqualString(token, configuredKey)) return true;
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(token)) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const decode = (part: string) => atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const header = JSON.parse(decode(parts[0]));
    const claims = JSON.parse(decode(parts[1]));
    const now = Date.now() / 1000;
    if (claims.role !== 'service_role' || !Number.isFinite(claims.exp) || claims.exp <= now ||
        (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now))) return false;
    if (jwtSecret) {
      if (header.alg !== 'HS256') return false;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      return await crypto.subtle.verify('HMAC', key, Uint8Array.from(decode(parts[2]), c => c.charCodeAt(0)), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    }
    // Without a signing secret, decoding is NOT authentication. The RPC request
    // below verifies the signature/project/key validity before any claim occurs.
    return header.alg === 'HS256' || header.alg === 'ES256' || header.alg === 'RS256';
  } catch { return false; }
}

class WorkerRpcError extends Error {
  constructor(public status: number) { super('worker_rpc_failed'); }
}

function normalizeLanguage(lang: string | undefined): SupportedLanguage {
  if (lang === 'ar' || lang === 'fr' || lang === 'en' || lang === 'es' || lang === 'de' || lang === 'pt') {
    return lang;
  }
  return 'en';
}

export function formatPickupNotificationMessage(item: ClaimedOutboxItem, rawLanguage: string): string {
  const lang = normalizeLanguage(rawLanguage);
  const student = (item.studentLabel || '').trim() || 'Pupil';
  const cls = (item.classLabel || '').trim();
  const subject = cls ? `${student} (${cls})` : student;
  const decision = item.decision === 'APPROVED' || item.decision === 'REJECTED' ? item.decision : null;

  const messages: Record<SupportedLanguage, Record<string, string>> = {
    ar: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — وصول الولي: تم تسجيل وصول الولي لاستلام التلميذ ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — تأكيد التسليم: تم تسليم التلميذ ${subject} رسمياً.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — طلب خروج مبكر: ورد طلب جديد للتلميذ ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — خروج مبكر: تمت الموافقة على طلب التلميذ ${subject}.`
        : `KRISTOU SCHOOL — خروج مبكر: تم رفض طلب التلميذ ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — خروج مبكر: تم تسليم التلميذ ${subject} رسمياً.`,
      default: `KRISTOU SCHOOL — تحديث الاستلام للتلميذ ${subject}.`,
    },
    fr: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — Arrivée signalée pour ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — Remise confirmée pour ${subject}.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — Nouvelle demande de sortie anticipée pour ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — Demande de sortie anticipée approuvée pour ${subject}.`
        : `KRISTOU SCHOOL — Demande de sortie anticipée refusée pour ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — Sortie anticipée effectuée pour ${subject}.`,
      default: `KRISTOU SCHOOL — Mise à jour sortie scolaire pour ${subject}.`,
    },
    en: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — Parent arrival announced for ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — Physical pickup release confirmed for ${subject}.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — New early departure request for ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — Early departure request approved for ${subject}.`
        : `KRISTOU SCHOOL — Early departure request rejected for ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — Early departure release completed for ${subject}.`,
      default: `KRISTOU SCHOOL — Pickup status update for ${subject}.`,
    },
    es: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — Llegada del familiar registrada para ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — Entrega escolar confirmada para ${subject}.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — Nueva solicitud de salida anticipada para ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — Solicitud de salida anticipada aprobada para ${subject}.`
        : `KRISTOU SCHOOL — Solicitud de salida anticipada rechazada para ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — Salida anticipada completada para ${subject}.`,
      default: `KRISTOU SCHOOL — Actualización de recogida para ${subject}.`,
    },
    de: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — Abholankunft gemeldet für ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — Schülerübergabe bestätigt für ${subject}.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — Neuer Antrag auf vorzeitige Abholung für ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — Vorzeitige Abholung genehmigt für ${subject}.`
        : `KRISTOU SCHOOL — Vorzeitige Abholung abgelehnt für ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — Vorzeitige Übergabe abgeschlossen für ${subject}.`,
      default: `KRISTOU SCHOOL — Abholstatus aktualisiert für ${subject}.`,
    },
    pt: {
      'pickup.arrival_announced': `KRISTOU SCHOOL — Chegada do responsável registada para ${subject}.`,
      'pickup.child_released': `KRISTOU SCHOOL — Entrega escolar confirmada para ${subject}.`,
      'pickup.early_departure_requested': `KRISTOU SCHOOL — Novo pedido de saída antecipada para ${subject}.`,
      'pickup.early_departure_reviewed': decision === 'APPROVED'
        ? `KRISTOU SCHOOL — Pedido de saída antecipada aprovado para ${subject}.`
        : `KRISTOU SCHOOL — Pedido de saída antecipada rejeitado para ${subject}.`,
      'pickup.early_departure_completed': `KRISTOU SCHOOL — Saída antecipada concluída para ${subject}.`,
      default: `KRISTOU SCHOOL — Atualização de recolha para ${subject}.`,
    },
  };

  return messages[lang][item.eventType] ?? messages[lang].default;
}

export async function handlePickupNotificationWorker(
  request: Request,
  overrides: WorkerDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const supabaseUrl = overrides.supabaseUrl ?? getEnv('SUPABASE_URL') ?? '';
  const serviceRoleKey = (overrides.serviceRoleKey ?? getEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
  const jwtSecret = overrides.jwtSecret ?? getEnv('SUPABASE_JWT_SECRET') ?? '';
  const botToken = (overrides.botToken ?? getEnv('TELEGRAM_BOT_TOKEN') ?? '').trim();
  const fetcher = overrides.fetcher ?? fetch;

  if (!serviceRoleKey && !supabaseUrl && !jwtSecret) {
    return json({ error: 'worker_unconfigured' }, 503);
  }

  const bearer = parseBearerToken(request);
  if (!bearer || !await serviceCredentialCandidate(bearer, serviceRoleKey, jwtSecret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  let limit = 25;
  const rawBody = await request.text();
  if (rawBody.trim().length > 0) {
    if (rawBody.length > 4096) return json({ error: 'request_too_large' }, 413);
    try {
      const parsed = JSON.parse(rawBody) as { limit?: unknown };
      if (parsed && typeof parsed === 'object' && parsed.limit !== undefined) {
        if (typeof parsed.limit !== 'number' || !Number.isSafeInteger(parsed.limit) || parsed.limit < 1 || parsed.limit > 100) {
          return json({ error: 'invalid_request' }, 400);
        }
        limit = parsed.limit;
      }
    } catch {
      return json({ error: 'invalid_request' }, 400);
    }
  }

  let claimBatch = overrides.claimBatch;
  let acknowledgeDelivery = overrides.acknowledgeDelivery;

  if (!claimBatch || !acknowledgeDelivery) {
    if (!supabaseUrl) {
      return json({ error: 'backend_unavailable' }, 503);
    }
    const db = (overrides.createRpcClient ?? createClient)(supabaseUrl, bearer, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    if (!claimBatch) {
      claimBatch = async (batchLimit: number) => {
        const { data, error, status } = await db.rpc('claim_pickup_outbox_batch', { p_limit: batchLimit });
        if (error) throw new WorkerRpcError(status === 401 || status === 403 ? status : 502);
        const items = (data as { items?: unknown } | null)?.items;
        return Array.isArray(items) ? (items as ClaimedOutboxItem[]) : [];
      };
    }
    if (!acknowledgeDelivery) {
      acknowledgeDelivery = async (input) => {
        const { data, error, status } = await db.rpc('acknowledge_pickup_outbox_delivery', {
          p_outbox_id: input.outboxId,
          p_succeeded: input.succeeded,
          p_provider_message_id: input.providerMessageId ?? null,
          p_error: input.error ?? null,
        });
        if (error) throw new WorkerRpcError(status === 401 || status === 403 ? status : 502);
        return data;
      };
    }
  }

  try {
    const items = await claimBatch(limit);
    let sent = 0;
    let retriedOrFailed = 0;

    for (const item of items) {
      const recipients = Array.isArray(item.recipients) ? item.recipients : [];
      if (recipients.length === 0) {
        await acknowledgeDelivery({
          outboxId: item.id,
          succeeded: true,
          providerMessageId: 'no-telegram-recipients',
        });
        sent += 1;
        continue;
      }

      if (!botToken) {
        await acknowledgeDelivery({
          outboxId: item.id,
          succeeded: false,
          error: 'telegram_bot_token_unconfigured',
        });
        retriedOrFailed += 1;
        continue;
      }

      const deliveredIds: string[] = [];
      let lastError = 'telegram_delivery_failed';

      for (const recipient of recipients) {
        if (!Number.isSafeInteger(recipient.telegramUserId)) continue;
        const text = formatPickupNotificationMessage(item, recipient.language);
        try {
          const response = await fetcher(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipient.telegramUserId,
              text,
              disable_web_page_preview: true,
            }),
          });
          if (response.ok) {
            const payload = await response.json().catch(() => null) as { result?: { message_id?: unknown } } | null;
            const msgId = payload?.result?.message_id;
            if (payload && 'ok' in payload && payload.ok === true && (typeof msgId === 'number' || typeof msgId === 'string')) deliveredIds.push(String(msgId));
            else lastError = 'telegram_invalid_response';
          } else {
            lastError = `telegram_http_${response.status}`;
          }
        } catch {
          // Fetch errors can contain the bot-token-bearing URL; never persist them.
          lastError = 'telegram_fetch_error';
        }
      }

      if (deliveredIds.length > 0) {
        await acknowledgeDelivery({
          outboxId: item.id,
          succeeded: true,
          providerMessageId: deliveredIds.join(',').slice(0, 160),
        });
        sent += 1;
      } else {
        await acknowledgeDelivery({
          outboxId: item.id,
          succeeded: false,
          error: lastError,
        });
        retriedOrFailed += 1;
      }
    }

    return json({
      ok: true,
      claimed: items.length,
      sent,
      retriedOrFailed,
    }, 200);
  } catch (err) {
    if (err instanceof WorkerRpcError && (err.status === 401 || err.status === 403)) {
      return json({ error: 'unauthorized' }, err.status);
    }
    return json({
      error: 'worker_execution_failed',
    }, 500);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno?.serve === 'function') {
  Deno.serve((request) => handlePickupNotificationWorker(request));
}
