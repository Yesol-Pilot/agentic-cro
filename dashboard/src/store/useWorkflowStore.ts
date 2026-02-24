import { create } from 'zustand';

interface WorkflowEvent {
    id: string;
    type: string;
    data: any;
    timestamp: number;
}

interface WorkflowState {
    isActive: boolean;
    events: WorkflowEvent[];
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    connectStream: () => void;
    disconnectStream: () => void;
    clearEvents: () => void;
}

// -------------------------------------------------------------
// [Phase 13] Zustand 기반 SSE(Server-Sent Events) 상태 구독소
// -------------------------------------------------------------
// 메모리 릭(Memory Leak) 방지를 위해 컴포넌트 마운트/언마운트 시
// EventSource의 완벽한 닫힘(close)을 보장하는 싱글턴 커넥션 컨트롤러
// -------------------------------------------------------------

let eventSource: EventSource | null = null;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    isActive: false,
    events: [],
    connectionStatus: 'disconnected',

    connectStream: () => {
        // 1. 역방향 좀비 커넥션 차단 (이미 연결 중이라면 무시)
        if (eventSource || get().connectionStatus === 'connected') return;

        set({ connectionStatus: 'connecting' });
        console.log('[SSE Client] 🌐 웹 스트림 연결 시도: /api/stream');
        eventSource = new EventSource('/api/stream');

        eventSource.onopen = () => {
            console.log('[SSE Client] ✅ 스트림 연결 성공');
            set({ connectionStatus: 'connected', isActive: true });
        };

        // 2. 외부 이벤트 버스 (workflow_update) 리스닝
        eventSource.addEventListener('workflow_update', (e) => {
            try {
                const payload = JSON.parse(e.data);
                set((state) => ({
                    // 최신순 유지하며 배열 길이 컨트롤 (메모리 초과 방지: 최대 100건)
                    events: [{ id: crypto.randomUUID(), type: 'update', data: payload, timestamp: Date.now() }, ...state.events].slice(0, 100)
                }));
            } catch (err) {
                console.error('[SSE Client] ❌ JSON Parse Error:', err);
            }
        });

        // 3. Heartbeat (Ping) 감시 처리
        eventSource.addEventListener('ping', (e) => {
            // 필요 시 마지막 핑 타임스탬프 기록 후 타임아웃 헬스체크 가능
        });

        eventSource.onerror = (err) => {
            console.error('[SSE Client] 🚨 EventSource 강제 종료 또는 네트워크 에러 발생', err);
            get().disconnectStream();
        };
    },

    disconnectStream: () => {
        // 4. [엔터프라이즈 철칙] 즉각적인 소켓 통신 해제 및 가비지 컬렉터 회수
        if (eventSource) {
            console.log('[SSE Client] 🛑 스트림 연결 해제 및 리소스 반환');
            eventSource.close();
            eventSource = null;
        }
        set({ connectionStatus: 'disconnected', isActive: false });
    },

    clearEvents: () => set({ events: [] })
}));
