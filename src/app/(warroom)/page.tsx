import { CriticalBanner } from '@/components/warroom/CriticalBanner';
import { PulseStrip } from '@/components/warroom/PulseStrip';
import { TriageQueue } from '@/components/warroom/TriageQueue';
import { LiveChats } from '@/components/warroom/LiveChats';
import { SystemStatus } from '@/components/warroom/SystemStatus';
import { Approvals } from '@/components/warroom/Approvals';
import { Automation } from '@/components/warroom/Automation';
import { EventStream } from '@/components/warroom/EventStream';

export default function WarRoomPage() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <CriticalBanner />
      <PulseStrip />
      <main
        className="flex-1 p-3 grid gap-2 overflow-hidden min-h-0"
        style={{
          gridTemplateColumns: '1.65fr 1fr .85fr',
          gridTemplateRows: 'minmax(0,1fr) minmax(0,1fr) 200px',
        }}
      >
        <TriageQueue />
        <LiveChats />
        <SystemStatus />
        <Approvals />
        <Automation />
        <EventStream />
      </main>
    </div>
  );
}
