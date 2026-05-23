import type {
  ModerationSuspect as ServerSuspect,
  ModerationBan as ServerBan,
} from '@/lib/api/endpoints';
import type { Suspect, BannedUser } from '@/lib/mock/moderation';
import type { Channel, Tone } from '@/lib/mock/types';

/**
 * Map a server-side ModerationSuspect (heuristic hit on a fortune_reading)
 * into the UI's Suspect shape. The score → "level" mapping is a simple
 * threshold ramp: 1 hit = level 1, 2 = level 2, 3 = level 3, 4+ = level 4
 * (capped). UI uses level for color/severity, not exact score.
 */
export function suspectFromServer(s: ServerSuspect): Suspect {
  const level = Math.min(4, s.score);
  const channel: Channel = 'FB'; // platform field is FB-only on our schema today
  const signals = s.matched_keywords.map((kw) => ({
    k: 'keyword',
    label: `คำเข้าข่าย "${kw}"`,
    tone: 'crit' as Tone,
    value: '1 ครั้ง',
  }));
  if (s.rating !== null && s.rating <= 2) {
    signals.push({
      k: 'rating',
      label: `ให้ดาว ${s.rating}/5`,
      tone: 'warn' as Tone,
      value: '1 ครั้ง',
    });
  }

  const lastActive = relativeTime(s.created_at);

  // Build human-readable "reasons" from flags + matched keywords. Always
  // an array — the UI calls `.reasons.map()` and would crash on a string.
  const reasonsArr = [
    ...(Array.isArray(s.flags) ? s.flags : []),
    ...(Array.isArray(s.matched_keywords) ? s.matched_keywords.map((k) => `kw:${k}`) : []),
  ];

  return {
    id: `r-${s.reading_id}`,
    name: s.display_name ?? `User #${s.user_id ?? s.platform_user_id ?? s.reading_id}`,
    psid: s.platform_user_id ?? String(s.user_id ?? s.reading_id),
    channel,
    level,
    score: s.score * 20,
    aliases: 0,
    reasons: reasonsArr.length > 0 ? reasonsArr : ['suspect'],
    lastActive,
    signals,
    evidence: [
      {
        ts: lastActive,
        tag: (Array.isArray(s.matched_keywords) && s.matched_keywords[0]) || 'flag',
        severity: 'crit' as const,
        text: s.preview ?? '',
      },
    ],
    audit: [],
    aliasList: [],
  };
}

/**
 * Map a FortuneUserBan row into the UI BannedUser shape.
 */
export function bannedFromServer(b: ServerBan): BannedUser {
  return {
    id: String(b.id),
    name: b.display_name ?? b.platform_user_id,
    psid: b.platform_user_id,
    channel: b.platform === 'facebook' ? 'FB' : 'LINE',
    reason: b.reason ?? 'banned_by_admin',
    by: b.banned_by?.name ?? 'system',
    bannedAt: b.created_at ?? '',
    endsAt: b.banned_until ?? 'ถาวร',
    permanent: b.is_permanent,
  };
}

/**
 * Top-of-page stats tiles, derived from the server suspect feed.
 */
export function moderationStatsFromServer(opts: {
  suspectsTotal: number;
  suspects: ServerSuspect[];
  bannedTotal: number;
}) {
  const levelCount = opts.suspects.reduce(
    (acc, s) => {
      const level = Math.min(4, s.score);
      if (level >= 3) acc.nearBan += 1;
      else if (level >= 1) acc.warning += 1;
      return acc;
    },
    { warning: 0, nearBan: 0 },
  );

  return [
    {
      label: 'เฝ้าระวังทั้งหมด',
      value: opts.suspectsTotal.toLocaleString(),
      sub: 'ในช่วง 24 ชม.',
      color: '#e5e7eb',
      subColor: '#f59e0b',
    },
    {
      label: 'ระดับสงสัย',
      value: levelCount.warning.toLocaleString(),
      sub: 'รอแอดมินรีวิว',
      color: '#f59e0b',
      subColor: '#6b7280',
    },
    {
      label: 'ใกล้แบน',
      value: levelCount.nearBan.toLocaleString(),
      sub: 'ต้องตัดสินใจ',
      color: '#f43f5e',
      subColor: '#f43f5e',
    },
    {
      label: 'แบนแล้ว',
      value: opts.bannedTotal.toLocaleString(),
      sub: 'รวมทั้งหมด',
      color: '#ef4444',
      subColor: '#6b7280',
      glow: opts.bannedTotal > 0,
    },
    {
      label: 'บัญชีลึกลับ (multi)',
      value: '0',
      sub: 'รอ endpoint',
      color: '#8b5cf6',
      subColor: '#8b5cf6',
    },
  ];
}

function relativeTime(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec} วินาที`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาที`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชั่วโมง`;
  return `${Math.floor(diffSec / 86400)} วัน`;
}
