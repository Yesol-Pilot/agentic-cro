import { z } from 'zod';

// 에이전트 식별자 타입
export type AgentRole = 'Supervisor' | 'DataAnalytics' | 'HypothesisStrategy' | 'FrontendDev' | 'DeploymentQA';

// JSON-RPC 2.0 스타일 메시지 스키마
export const A2AMessageSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.string().uuid(),
    sender: z.custom<AgentRole>(),
    target: z.custom<AgentRole>(),
    method: z.string(),
    params: z.any().optional(),
    timestamp: z.number()
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// 메시지 응답 스키마
export const A2AResponseSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.string().uuid(),
    result: z.any().optional(),
    error: z.object({
        code: z.number(),
        message: z.string()
    }).optional()
});

export type A2AResponse = z.infer<typeof A2AResponseSchema>;
