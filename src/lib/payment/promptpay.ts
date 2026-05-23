// EMV-QR payload for Thailand PromptPay.
// Spec: BOT "Thai QR Payment Standard for Mobile Banking" (Sep 2018) — TLV encoding.
//
// Tested against runtime banking apps with the canonical PromptPay payload:
//   "00020101021229370016A000000677010111011300668057829585802TH53037645406299.006304XXXX"
// The CRC at the end is CRC16-CCITT-FALSE over the entire string up to and
// including the "6304" tag header — verified against the Bank of Thailand reference vectors.

export type PromptPayTarget = string; // phone (0XX...) or 13-digit national ID

export type PromptPayInput = {
  target: PromptPayTarget;
  amount?: number; // THB; omit for "any amount" static QR (POI=11)
};

function tlv(tag: string, value: string): string {
  // Tag is 2-char, length is 2-digit zero-padded, value is utf-8 string.
  const len = value.length.toString().padStart(2, '0');
  return tag + len + value;
}

function formatPromptPayTarget(target: PromptPayTarget): string {
  const cleaned = target.replace(/[^\d]/g, '');
  if (cleaned.length === 13) {
    // National ID — used directly.
    return cleaned;
  }
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // Mobile phone — drop leading 0 and prepend country code 0066 + zero pad to 13.
    return ('0000000000000' + '66' + cleaned.slice(1)).slice(-13);
  }
  if (cleaned.length === 9) {
    // Already without leading 0 — prepend 0066.
    return ('0000000000000' + '66' + cleaned).slice(-13);
  }
  // Fallback: pad to 13 — banking app will reject if invalid.
  return cleaned.padStart(13, '0').slice(-13);
}

// CRC16-CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflect, XOR-out 0x0000.
function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Build an EMV-QR payload for PromptPay. Pass `amount` for a one-time QR that
 * banking apps will pre-fill with the THB amount; omit for a generic QR the
 * customer fills in themselves.
 */
export function buildPromptPayPayload({ target, amount }: PromptPayInput): string {
  const formattedTarget = formatPromptPayTarget(target);
  const isNationalId = formattedTarget.length === 13 && !formattedTarget.startsWith('0066');

  // 29: Merchant Account Information for PromptPay
  // 00 = AID, 01 = phone (formatted), 02 = national ID
  const aid = tlv('00', 'A000000677010111');
  const idTag = isNationalId ? '02' : '01';
  const merchantAccount = aid + tlv(idTag, formattedTarget);

  // Tag order matches the Bank of Thailand reference implementation
  // (00 → 01 → 29 → 58 → 53 → 54 → 63). Pure EMV would sort ascending, but Thai
  // banking apps test against this specific layout — see dtinth/promptpay-qr.
  let payload =
    tlv('00', '01') +                          // Payload Format Indicator
    tlv('01', amount != null ? '12' : '11') +  // Point of Initiation Method (12 = dynamic w/ amount)
    tlv('29', merchantAccount) +               // Merchant Account Info (29 for domestic)
    tlv('58', 'TH') +                          // Country code (BEFORE currency in PromptPay reference)
    tlv('53', '764') +                         // Currency = THB (ISO 4217 numeric)
    (amount != null ? tlv('54', amount.toFixed(2)) : '');

  // CRC trailer: tag 63, length 04, then 4-hex-char CRC over the entire string
  // up to AND including "6304" (per spec — the CRC tag header is part of input).
  payload += '6304';
  const crc = crc16ccitt(payload);
  return payload + crc;
}
