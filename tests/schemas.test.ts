import { CodePatchSchema } from '../src/types/schemas';

describe('CodePatchSchema', () => {
    it('유효한 CodePatch 페이로드 파싱 성공', () => {
        const payload = {
            hypothesisId: 'ab-test-101',
            componentPaths: ['src/App.tsx'],
            patchSummary: 'UI 업데이트 반영',
            operations: [
                {
                    action: 'merge_tailwind_classes',
                    targetComponent: 'PrimaryButton',
                    propName: 'className',
                    classesToAdd: ['text-red-500']
                }
            ]
        };

        const result = CodePatchSchema.safeParse(payload);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.hypothesisId).toBe('ab-test-101');
            expect(result.data.operations[0].action).toBe('merge_tailwind_classes');
        }
    });

    it('필수 필드(hypothesisId) 누락 시 파싱 에러 반환', () => {
        const payload = {
            componentPaths: ['src/App.tsx'],
            patchSummary: 'UI 업데이트 반영',
            operations: []
        };

        const result = CodePatchSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].path).toContain('hypothesisId');
        }
    });

    it('잘못된 type의 operations 배열 검증 감지', () => {
        const payload = {
            hypothesisId: 'ab-test-101',
            componentPaths: ['src/App.tsx'],
            patchSummary: 'UI 업데이트 반영',
            operations: 'this string should be an array'
        };

        const result = CodePatchSchema.safeParse(payload);
        expect(result.success).toBe(false);
    });
});
