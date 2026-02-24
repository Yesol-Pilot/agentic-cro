'use client';
import React, { useTransition, useState } from 'react';
import { Play, Square, Loader2, Workflow } from 'lucide-react';
import { startOptimizationWorkflow } from '@/app/actions/temporal';

export default function ControlPanel() {
    const [isPending, startTransition] = useTransition();
    const [targetUrl, setTargetUrl] = useState('https://vercel.com/checkout');
    const [statusMsg, setStatusMsg] = useState('');

    const handleStart = () => {
        startTransition(async () => {
            setStatusMsg('Temporal Engine 가동 중...');
            const res = await startOptimizationWorkflow(targetUrl);
            if (res.success) {
                setStatusMsg(`✅ 성공: ${res.workflowId}`);
            } else {
                setStatusMsg(`❌ 실패: ${res.error}`);
            }
        });
    };

    return (
        <div className="p-6 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-slate-300 font-semibold tracking-wide flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-indigo-400" />
                    Control Panel
                </h3>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs text-slate-400 font-medium">Target URL (A/B Test)</label>
                <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 font-mono transition-colors"
                />
            </div>

            <div className="flex gap-3 mt-2">
                <button
                    onClick={handleStart}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-lg shadow-lg shadow-indigo-900/20 transition-all"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start Engine
                </button>
                <button
                    disabled={true} // Stop 기능은 아직 미구현(Disabled mock)
                    className="flex items-center justify-center gap-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium py-2 rounded-lg transition-colors"
                    title="Kill-switch (Not implemented yet)"
                >
                    <Square className="w-4 h-4 text-red-500/80" />
                </button>
            </div>

            {statusMsg && (
                <div className="text-[11px] mt-1 p-2.5 bg-slate-950 rounded-lg border border-slate-800 break-all text-slate-400 font-mono">
                    {statusMsg}
                </div>
            )}
        </div>
    );
}
