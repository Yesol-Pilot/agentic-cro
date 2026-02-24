import TechDebtWidget from '@/components/TechDebtWidget';
import LiveEventFeed from '@/components/LiveEventFeed';
import BayesianChart from '@/components/BayesianChart';
import ControlPanel from '@/components/ControlPanel';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <header className="mb-8 border-b border-slate-800 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            HIVE MIND Command Center
            <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/20">
              Agentic CRO SaaS
            </span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Next.js App Router & SSE Telemetry Multi-Agent Streaming Pipeline
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-semibold text-emerald-400 tracking-wider">SYSTEM ONLINE</span>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* 중앙 관제 차트 영역 (Bayesian Analytics & Live Terminal) */}
        <div className="lg:col-span-2 xl:col-span-3 flex flex-col gap-6">
          <BayesianChart />
          <LiveEventFeed />
        </div>

        {/* 우측 사이드바: 가시화된 기술 부채 청산 및 워크플로우 컨트롤 */}
        <div className="flex flex-col gap-6 w-full items-center lg:items-end">
          <TechDebtWidget />
          <ControlPanel />
        </div>
      </main>
    </div>
  );
}
