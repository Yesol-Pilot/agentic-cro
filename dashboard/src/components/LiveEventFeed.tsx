'use client';
import React, { useEffect } from 'react';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import { useShallow } from 'zustand/react/shallow';
import { Terminal, Activity, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// [CTO 지적사항 반영 2] EventItem 하위 컴포넌트화 및 개별 상태 구독 최적화
// 부모는 최상위 껍데기로서 배열의 불변성 ID 맵(Primitive)만 구독하고,
// 개별 자식이 자신의 상태만 렌더링하도록 분리하여 중앙 집중식 리렌더링 폭발(Re-rendering explosion)을 차단.
// ---------------------------------------------------------------------------
const EventItem = React.memo(function EventItem({ eventId, isLatest }: { eventId: string, isLatest: boolean }) {
    // 컴포넌트는 오직 자신의 ID에 해당하는 객체 프록시만 구독 (가상화 렌더링 최적화 효과)
    const ev = useWorkflowStore((state) => state.events.find((e) => e.id === eventId));

    if (!ev) return null;

    return (
        <div className={`flex items-start gap-3 text-xs tracking-tight ${isLatest ? 'text-emerald-300 font-medium' : 'text-slate-400'}`}>
            <div className="mt-0.5"><Zap className={`w-3 h-3 ${isLatest ? 'text-emerald-500' : 'text-emerald-500/30'}`} /></div>
            <div className="flex flex-col">
                <span className="opacity-50">[{new Date(ev.timestamp).toLocaleTimeString()}]</span>
                <span className="break-all mt-0.5">{typeof ev.data === 'object' ? JSON.stringify(ev.data) : String(ev.data)}</span>
            </div>
        </div>
    );
});

export default function LiveEventFeed() {
    // 무의미한 React.memo 삭제.
    // 배열 참조(events 객체) 통째 구독 대신, 원시 타입인 ID 배열만 추출해 얕은 비교
    // 텔레메트리가 추가되어 불변성 배열 Length/ID가 변경될 때만 Feed 껍데기가 리렌더링됨
    const eventIds = useWorkflowStore(
        useShallow((state) => state.events.map((e) => e.id))
    );

    const { connectionStatus, connectStream, disconnectStream } = useWorkflowStore(
        useShallow((state) => ({
            connectionStatus: state.connectionStatus,
            connectStream: state.connectStream,
            disconnectStream: state.disconnectStream,
        }))
    );

    // 컴포넌트 마운트 시 연결, 언마운트 시 자동 회수
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

            {/* Feed List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                {eventIds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                        <Activity className="w-8 h-8 animate-pulse text-indigo-500/50" />
                        <span className="text-sm">Listening for Temporal workflows...</span>
                    </div>
                ) : (
                    eventIds.map((id, idx) => (
                        <EventItem key={id} eventId={id} isLatest={idx === 0} />
                    ))
                )}
            </div>
        </div>
    );
}
