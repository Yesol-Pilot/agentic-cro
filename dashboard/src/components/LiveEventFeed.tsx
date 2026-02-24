'use client';
import React, { useEffect } from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { useShallow } from 'zustand/react/shallow';
import { Terminal, Activity, Zap } from 'lucide-react';

const LiveEventFeed = React.memo(function LiveEventFeed() {
    const { events, connectionStatus, connectStream, disconnectStream } = useWorkflowStore(
        useShallow((state) => ({
            events: state.events,
            connectionStatus: state.connectionStatus,
            connectStream: state.connectStream,
            disconnectStream: state.disconnectStream,
        }))
    );

    // 컴포넌트 마운트 시 연결, 언마운트 시 자동 회수 (메모리 릭 방탄망)
    useEffect(() => {
        connectStream();
        return () => disconnectStream();
    }, [connectStream, disconnectStream]);

    return (
        <div className="flex flex-col h-96 bg-black border border-slate-800 rounded-xl overflow-hidden shadow-2xl font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-slate-300 tracking-wide">Live Telemetry Feed</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className={`flex h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className="text-slate-400 uppercase font-medium">{connectionStatus}</span>
                </div>
            </div>

            {/* Feed List (자동으로 최신 항목이 위로 오도록 Zustand state에서 역순으로 제공 중) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                        <Activity className="w-8 h-8 animate-pulse text-indigo-500/50" />
                        <span className="text-sm">Listening for Temporal workflows...</span>
                    </div>
                ) : (
                    events.map((ev, idx) => (
                        <div key={ev.id} className={`flex items-start gap-3 text-xs tracking-tight ${idx === 0 ? 'text-emerald-300 font-medium' : 'text-slate-400'}`}>
                            <div className="mt-0.5"><Zap className={`w-3 h-3 ${idx === 0 ? 'text-emerald-500' : 'text-emerald-500/30'}`} /></div>
                            <div className="flex flex-col">
                                <span className="opacity-50">[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                                <span className="break-all mt-0.5">{typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

export default LiveEventFeed;
