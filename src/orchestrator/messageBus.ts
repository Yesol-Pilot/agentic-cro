import { A2AMessage, A2AResponse, AgentRole } from '../types/a2a';
import { randomUUID } from 'crypto';

export type MessageHandler = (message: A2AMessage) => Promise<A2AResponse | void>;

export class MessageBus {
    private handlers: Map<AgentRole, MessageHandler> = new Map();

    /**
     * 특정 에이전트가 버스에 자신을 등록합니다.
     */
    public subscribe(role: AgentRole, handler: MessageHandler): void {
        this.handlers.set(role, handler);
        console.log(`[MessageBus] ✅ ${role} 핸들러가 등록되었습니다.`);
    }

    /**
     * 특정 타겟 에이전트에게 메시지를 비동기로 전송합니다.
     */
    public async publish(message: Omit<A2AMessage, 'jsonrpc' | 'id' | 'timestamp'>): Promise<A2AResponse | null> {
        const fullMessage: A2AMessage = {
            ...message,
            jsonrpc: '2.0',
            id: randomUUID(),
            timestamp: Date.now()
        };

        const handler = this.handlers.get(message.target);

        if (!handler) {
            console.error(`[MessageBus] ❌ 대상 에이전트(${message.target})를 찾을 수 없습니다.`);
            return {
                jsonrpc: '2.0',
                id: fullMessage.id,
                error: { code: -32601, message: 'Method not found or Agent unavailable' }
            };
        }

        console.log(`[MessageBus] 📤 [${fullMessage.sender}] -> [${fullMessage.target}] : ${fullMessage.method}`);

        try {
            const response = await handler(fullMessage);
            return response || null;
        } catch (error) {
            console.error(`[MessageBus] ❌ 메시지 처리 오류:`, error);
            return {
                jsonrpc: '2.0',
                id: fullMessage.id,
                error: { code: -32603, message: 'Internal error' }
            };
        }
    }
}
