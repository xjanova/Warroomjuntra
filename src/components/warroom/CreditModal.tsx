'use client';

// 💳 (2026-06-11) In-app credit adjustment — replaces the old "+ เครดิต" admin-web
// detour. Resolves user → wallet via GET /finance/wallets?user_id= then POSTs
// /finance/wallets/{id}/adjust (backend validates amount ≠ 0, reason ≤ 500).
// FB-only customers have no web account → no wallet → honest empty state.

import { useEffect, useState } from 'react';
import { fetchWallets, adjustWalletBalance, describeError, type AdminWallet } from '@/lib/api';
import { useWarroom } from '@/lib/stores/warroom';
import { cn } from '@/lib/utils';

const QUICK_AMOUNTS = [39, 99, 100, 500];

export function CreditModal({
  userId,
  customerName,
  onClose,
  onDone,
}: {
  userId: number;
  customerName: string;
  onClose: () => void;
  /** Called after a successful adjust so the caller can refetch its feed. */
  onDone?: () => void;
}) {
  const pushToast = useWarroom((s) => s.pushToast);
  const [wallet, setWallet] = useState<AdminWallet | null>(null);
  const [walletState, setWalletState] = useState<'loading' | 'ready' | 'none' | 'error'>('loading');
  const [walletError, setWalletError] = useState('');
  const [mode, setMode] = useState<'add' | 'deduct'>('add');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchWallets({ user_id: userId, per_page: 5 })
      .then((res) => {
        if (cancelled) return;
        const w = (res.data ?? [])[0] ?? null;
        setWallet(w);
        setWalletState(w ? 'ready' : 'none');
      })
      .catch((e) => {
        if (cancelled) return;
        setWalletState('error');
        setWalletError(describeError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const amount = Number(amountStr);
  const amountOk = Number.isFinite(amount) && amount > 0;
  const signed = mode === 'add' ? amount : -amount;
  // Deducting more than the balance is almost always a mistake — block client-side.
  const overdraw = mode === 'deduct' && wallet != null && amountOk && amount > wallet.balance;
  const canSubmit = walletState === 'ready' && amountOk && reason.trim().length > 0 && !busy && !overdraw;

  const submit = async () => {
    if (!canSubmit || !wallet) return;
    setBusy(true);
    try {
      await adjustWalletBalance(wallet.id, { amount: signed, reason: reason.trim() });
      pushToast({
        kind: 'ok',
        title: `💳 ${mode === 'add' ? 'เติม' : 'หัก'} ฿${amount.toLocaleString()} → ${customerName}`,
        body: reason.trim().slice(0, 60),
      });
      onDone?.();
      onClose();
    } catch (e) {
      pushToast({ kind: 'crit', title: 'ปรับเครดิตไม่สำเร็จ', body: describeError(e) });
      setBusy(false); // keep the modal open so the operator can retry/fix
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-[440px] max-w-[92vw] p-4 border border-info/40"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 0 32px rgba(34,211,238,0.15)' }}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="text-2xl">💳</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-fg">ปรับเครดิต {customerName}</div>
            <div className="text-2xs text-mute mono mt-0.5">user #{userId}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost text-mute" title="ปิด">
            ✕
          </button>
        </div>

        {walletState === 'loading' && (
          <div className="text-center text-2xs text-mute py-6">กำลังหากระเป๋าเงิน…</div>
        )}
        {walletState === 'none' && (
          <div className="text-center text-xs text-mute py-6">
            ลูกค้านี้ยังไม่มีกระเป๋าเงิน (ไม่มีบัญชีเว็บ) — ปรับเครดิตไม่ได้ค่ะ
          </div>
        )}
        {walletState === 'error' && (
          <div className="text-center text-xs text-crit py-6">
            หากระเป๋าเงินไม่สำเร็จ — <span className="text-2xs mono">{walletError}</span>
          </div>
        )}

        {walletState === 'ready' && wallet && (
          <>
            <div className="bg-panel border border-line rounded p-3 mb-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-mute text-2xs">ยอดคงเหลือ</div>
                <div className="mono text-ok text-lg font-semibold">
                  ฿{wallet.balance.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-mute text-2xs">สถานะกระเป๋า</div>
                <div className={cn('font-semibold', wallet.is_locked ? 'text-crit' : 'text-fg')}>
                  {wallet.is_locked ? '🔒 ถูกล็อก' : wallet.status}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button
                onClick={() => setMode('add')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded border transition-colors',
                  mode === 'add' ? 'bg-ok/15 border-ok/70 text-ok font-semibold' : 'border-line text-dim',
                )}
              >
                + เติมเครดิต
              </button>
              <button
                onClick={() => setMode('deduct')}
                className={cn(
                  'px-3 py-1.5 text-xs rounded border transition-colors',
                  mode === 'deduct' ? 'bg-crit/15 border-crit/70 text-crit font-semibold' : 'border-line text-dim',
                )}
              >
                − หักเครดิต
              </button>
            </div>

            <div className="text-2xs text-mute mb-1.5">จำนวน (บาท)</div>
            <div className="flex gap-1.5 mb-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAmountStr(String(a))}
                  className={cn('pill', amountStr === String(a) ? 'pill-info' : 'pill-dim')}
                >
                  ฿{a}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="ระบุจำนวน เช่น 99"
              className="w-full px-2 py-1.5 text-sm mono mb-1"
            />
            {overdraw && (
              <div className="text-2xs text-crit mb-2">
                หักเกินยอดคงเหลือ (฿{wallet.balance.toLocaleString()}) ไม่ได้
              </div>
            )}

            <div className="text-2xs text-mute mb-1.5 mt-2">เหตุผล (บังคับ — ลง audit log)</div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น ชดเชยระบบล่ม / โปรโมชั่น / แก้ยอดผิด"
              className="w-full px-2 py-1.5 text-xs mb-3"
              maxLength={500}
            />

            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn btn-ghost flex-1 justify-center">
                ยกเลิก
              </button>
              <button
                onClick={() => void submit()}
                disabled={!canSubmit}
                className={cn(
                  'btn flex-1 justify-center disabled:opacity-40',
                  mode === 'add' ? 'btn-ok' : 'btn-crit',
                )}
              >
                {busy
                  ? 'กำลังบันทึก...'
                  : `${mode === 'add' ? '+ เติม' : '− หัก'}${amountOk ? ` ฿${amount.toLocaleString()}` : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
