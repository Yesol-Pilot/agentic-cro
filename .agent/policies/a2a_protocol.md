---
description: 다중 에이전트 간 통신(A2A) 및 동적 라우팅 프로토콜
---

# Policy: A2A (Agent-to-Agent) Messaging Protocol

4개의 특화 에이전트(Data, Strategy, Dev, QA)가 시스템 중단 없이 유기적으로 소통하기 위한 규약.

## 1. 메시지 버스 설계 (Message Bus)

- 에이전트 간 직접 호출(Point-to-Point)을 지양한다(하드코딩 방지).
- 대신, 최상위 오케스트레이터(Supervisor)가 중앙 메시지 큐 또는 상태 머신(State Machine)을 관리하며, 각 에이전트는 주어진 Task가 할당될 때만 깨어난다.

## 2. 동적 컨텍스트 전달 (Dynamic Context Passing)

- 선행 에이전트(Data Analytics)가 생성한 인사이트는 일정한 규격의 JSON 객체로 파싱되어야 한다.

```json
{
  "taskId": "UUID-동적-생성",
  "funnelStep": "payment_submit",
  "dropoffRate": "config.env.TRIGGER_RATE 동적 참고",
  "evidence": ["SessionReplay_URL_1", "DOM_Snapshot_Ref"]
}
```

- 후행 에이전트(Strategy)는 이 JSON을 파싱하여, 자신의 외부 툴(Web Scraper MCP)에 하드코딩 없이 동적 변수(`funnelStep`)로 대상 페이지를 라우팅한다.

## 3. 실패 및 재시도(Resilience) 정책

- 후행 에이전트가 이전 컨텍스트를 이해하지 못해 렌더링에 실패하면, 하드코딩된 에러를 무조건 던지는 대신 **반송(Return to Sender)** 프로토콜을 활성화한다.
- "DOM 구조가 변경되어 파싱 불가. 시각적 바운딩 박스를 재생성 바람" 형태의 피드백 루프를 통해 에이전트가 동적으로 재시도한다.
