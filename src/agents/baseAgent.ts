import { AgentRole, A2AMessage, A2AResponse } from '../types/a2a';
import { MessageBus } from '../orchestrator/messageBus';

export abstract class BaseAgent {
    constructor(
        protected readonly role: AgentRole,
        protected readonly messageBus: MessageBus
    ) {
        // 인스턴스화 시 자동으로 메시지 버스에 리스너 등록
        this.messageBus.subscribe(this.role, this.handleMessage.bind(this));
    }

    /**
     * 중앙 Supervisor 또는 다른 Agent로부터 메시지를 수신했을 때 실행되는 핸들러
     */
    protected abstract handleMessage(message: A2AMessage): Promise<A2AResponse | void>;

    /**
     * 다른 에이전트(주로 Supervisor)에게 메시지를 발송
     */
    protected async sendMessage(target: AgentRole, method: string, params?: any): Promise<A2AResponse | null> {
        return this.messageBus.publish({
            sender: this.role,
            target,
            method,
            params
        });
    }
}
