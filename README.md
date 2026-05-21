# Warroom Juntra · Fortune War Room

> ศูนย์ควบคุมภารกิจระบบดูดวงออนไลน์ (Mission Control)
> Sister project to [juntraweb](https://github.com/xjanova/juntraweb) (Laravel fortune-telling site) and [Thaiprompt-Affiliate](https://github.com/xjanova/Thaiprompt-Affiliate) (Messenger fortune bot).

---

## Overview

Real-time ops console สำหรับ admin/owner ใช้ดูแลภารกิจตลอดทั้งกะ:

- รับคิวเคสด่วน (ยอดโอนไม่ตรง, คำทำนายค้าง, ลูกค้าโกรธ ฯลฯ)
- ดูสถานะระบบเรียลไทม์ (AI providers, webhook, SMS parser, queue)
- กระทบยอดการเงิน, อนุมัติคืนเงิน/คอมมิชชั่น
- ดูแลบอทอัตโนมัติ (โพสต์ดวงรายวัน, ติดตามลูกค้า)
- **Eve** — AI assistant ผู้ช่วยลอยที่มุมจอ

อารมณ์ดีไซน์: **NASA / Bloomberg Terminal × Mystical** — พื้นมืด ตัวเลขเป็นพระเอก ภาษาไทย 100%

## Stack

- **Next.js 14** (App Router, static export)
- **TypeScript** strict
- **Tailwind CSS 3**
- **Zustand** for state
- **Lucide React** for icons (paired with inline SVG for prototype-specific marks)
- Fonts: Noto Sans Thai · JetBrains Mono · Cinzel (via `next/font`)

## Pages

| Route | Screen |
|---|---|
| `/` | War Room — mission control (KPIs + triage + chats + system + approvals + bots + events) |
| `/chat` | Live Chat / Takeover |
| `/predict` | AI Workbench |
| `/bills` | จัดการบิล |
| `/payment` | Payment Reconciliation (SMS ↔ bill matching) |
| `/approvals` | รออนุมัติ (คอมมิชชั่น / refunds / credits) |
| `/moderation` | เฝ้าระวัง (sensitive cases / saved questions / banned) |
| `/bots` | จัดการบอท |
| `/customers` | Customer 360 (RPG persona + radar) |
| `/events` | Event stream (เต็มจอ + filter) |

Plus: floating Eve assistant, Cmd+K command palette, Case Detail / Customer 360 / Settings drawers.

## Local dev

```bash
npm install
npm run dev
# http://localhost:3000
```

## Build (static export → DirectAdmin)

```bash
npm run build
# output: ./out
```

The repo is configured for **`output: 'export'`** so it produces a fully static bundle in `./out` that can ship to any web host. The DirectAdmin deploy script syncs `out/` to the server (mirrors the juntraweb deploy.sh pattern).

## Data

Phase 1: all data is mocked in `src/lib/mock/`. Phase 2 will swap in calls to the juntraweb API (`/api/v1/*` Sanctum-authenticated) and a WebSocket/SSE channel for realtime updates.

## License

Private — © 2026 xjanova
