export type ApiErrorKind =
  | 'network'        // fetch threw — DNS, offline, CORS, etc.
  | 'timeout'        // AbortController fired
  | 'unauthorized'   // 401
  | 'forbidden'      // 403
  | 'not_found'      // 404
  | 'rate_limited'   // 429
  | 'server'         // 5xx
  | 'client'         // 4xx (other)
  | 'parse'          // body wasn't valid JSON when expected
  | 'config';        // missing baseUrl/token before call

export class ApiError extends Error {
  kind: ApiErrorKind;
  status: number;
  body: unknown;
  url?: string;

  constructor(kind: ApiErrorKind, message: string, opts: { status?: number; body?: unknown; url?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status ?? 0;
    this.body = opts.body;
    this.url = opts.url;
  }
}

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.kind) {
      case 'network':
        return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (network / CORS / DNS)';
      case 'timeout':
        return 'เซิร์ฟเวอร์ตอบกลับช้าเกินไป';
      case 'unauthorized':
        return 'Token ไม่ถูกต้องหรือหมดอายุ (401)';
      case 'forbidden':
        return 'Token ไม่มีสิทธิ์เข้า endpoint นี้ (403)';
      case 'not_found':
        return 'ไม่พบ endpoint (404) — ตรวจ Base URL';
      case 'rate_limited':
        return 'เรียกถี่เกินไป (429) — ลองใหม่อีกครั้ง';
      case 'server':
        return `เซิร์ฟเวอร์ผิดพลาด (${e.status})`;
      case 'client':
        return `คำขอผิด (${e.status}) ${e.message}`;
      case 'parse':
        return 'ผลตอบกลับไม่ใช่ JSON ที่อ่านได้';
      case 'config':
        return e.message;
      default:
        return e.message;
    }
  }
  if (e instanceof Error) return e.message;
  return String(e);
}
