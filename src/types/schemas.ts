import { z } from 'zod';

// 1. Data Analytics -> Hypothesis Strategy로 넘어가는 데이터 규격
export const AnalysisReportSchema = z.object({
    targetFunnel: z.string().describe("이탈이 발생하는 식별 가능한 퍼널 구조 (예: checkout_step_2)"),
    issueDescription: z.string().describe("분석된 병목 원인 및 텍스트 요약"),
    dropOffRate: z.number().describe("이탈률 (%)"),
    affectedSelectors: z.array(z.string()).optional().describe("개선이 필요한 것으로 추정되는 화면 요소 CSS Selector 목록")
});

export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

// 2. Hypothesis Strategy -> Frontend Dev로 넘어가는 가설 규격
export const HypothesisSchema = z.object({
    hypothesisId: z.string().uuid().describe("가설 식별자"),
    targetRoute: z.string().describe("수정 대상이 위치한 Next.js 라우트나 컴포넌트 경로 (예: /src/components/CheckoutButton.tsx)"),
    uxRationale: z.string().describe("CRO 최적화 변경 이유"),
    uiDirectives: z.array(z.object({
        selector: z.string().describe("DOM 식별자 (ID 또는 클래스)"),
        action: z.enum(['MODIFY_STYLE', 'REPLACE_ELEMENT', 'ADD_ELEMENT', 'REMOVE_ELEMENT']),
        description: z.string().describe("세부 행위 (예: 배경색을 녹색으로 변경하고 여백을 늘림)")
    })).describe("구체적 프론트엔드 작업 지시 묶음")
});

export type Hypothesis = z.infer<typeof HypothesisSchema>;

// 3. Frontend Dev -> Deployment QA로 넘어가는 강력한 정밀 트리 변이(AST Operation) 규격
export const CodePatchSchema = z.object({
    hypothesisId: z.string().describe("적용된 가설 ID"),
    componentPaths: z.array(z.string()).describe("수정된 파일명 목록 (절대 또는 상대경로)"),
    patchSummary: z.string().describe("Tailwind 및 로직 변경 요약"),
    operations: z.array(z.object({
        action: z.enum(['merge_tailwind_classes']).describe("수행할 동작의 종류"),
        targetComponent: z.string().describe("대상 React 컴포넌트 이름 (예: 'Button.Checkout')"),
        propName: z.string().describe("대상 JSX 속성 (예: 'className')"),
        classesToAdd: z.array(z.string()).describe("추가/병합할 유틸리티 클래스 목록"),
        classesToRemove: z.array(z.string()).optional().describe("제거할 유틸리티 클래스 목록")
    })).describe("AST 파서를 제어할 외과 수술적 변경(Surgical Diffing) 지시 배열")
});

export type CodePatch = z.infer<typeof CodePatchSchema>;
