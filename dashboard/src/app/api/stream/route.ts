import { NextRequest } from 'next/server';

// -------------------------------------------------------------
// [Phase 13] Enterprise-grade Server-Sent Events (SSE) Endpoint
// -------------------------------------------------------------
// Vercel Serverless 및 Edge 환경에서의 메모리 릭(Memory Leak)을 방어하고,
// 클라이언트의 강제 종료(Abortion) 시 연결 리소스를 완벽히 회수(Cleanup)합니다.
// -------------------------------------------------------------

export const dynamic = 'force-dynamic'; // 완전한 동적 스트리밍 모드

// 임시 In-Memory 이벤트 에미터 대체(추후 Redis Pub/Sub 등과 교체 가능)
import { EventEmitter } from 'events';
export const workflowEmitter = new EventEmitter();
workflowEmitter.setMaxListeners(100); // SSE 연결 증가 대비

export async function GET(req: NextRequest) {
    // Web Streams API 기반의 TransformStream 스트림 파이프 구현
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // SSE 표준응답 규격 준수를 위한 텍스트 포맷팅 유틸리티
    const encoder = new TextEncoder();
    const sendEvent = async (data: any, eventType: string = 'message') => {
        try {
            if (writer.desiredSize === null) return; // 닫힌 스트림 조기 차단
            const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
            await writer.write(encoder.encode(payload));
        } catch (err) {
            console.error('[SSE] 🚨 Write error:', err);
        }
    };

    // 1. 커넥션 확립 확인용 Handshake Ping
    await sendEvent({ status: 'connected', time: Date.now() }, 'system');

    // 2. MessageBus(또는 외부 상태)에서 발송되는 이벤트 리스닝
    const handleWorkflowEvent = async (payload: any) => {
        await sendEvent(payload, 'workflow_update');
    };
    workflowEmitter.on('workflow_event', handleWorkflowEvent);

    // 3. 연결 지속성 유지용 Heartbeat (공유 리소스 방어)
    const heartbeatId = setInterval(() => {
        sendEvent({ ping: Date.now() }, 'ping');
    }, 15000);

    // 4. [엔터프라이즈급 아키텍처 핵심] 클린업(Cleanup) 훅
    // 클라이언트 측 브라우저 탭 닫기, 네트워크 단절 시 발동
    req.signal.onabort = () => {
        console.log('[SSE] ⚠️ Client connection aborted. Performing cleanup...');
        clearInterval(heartbeatId);
        workflowEmitter.off('workflow_event', handleWorkflowEvent);
        writer.close().catch(() => { });
    };

    // SSE 필수 HTTP 헤더 응답 (Next.js 13+ App Router 규격)
    return new Response(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            // Vercel 특화 스트림 버퍼링 방지 헤더
            'X-Accel-Buffering': 'no',
        },
    });
}

// 5. [브릿지 통합] 백엔드(Temporal 워커 등) 프로세스나 로컬 이벤트 버스에서
// 이벤트를 쏴주면 받아서 연결된 SSE 클라이언트들에게 전파하는 Webhook 리스너
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        workflowEmitter.emit('workflow_event', body);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ success: false, error: 'Bad Payload' }), { status: 400 });
    }
}

