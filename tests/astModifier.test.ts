/**
 * Phase Ground Zero: AST Modifier 단위 테스트
 * 
 * ts-morph 기반의 진정한 AST 수술 모듈 검증:
 * 1. 단순 className 문자열 → Tailwind 클래스 병합
 * 2. data-cro-agent 가역성 마커 주입
 * 3. Fragment/Custom Component → display:contents 래퍼
 * 4. 롤백: 마커 제거 + 래퍼 해체
 * 5. 엣지 케이스: className 없는 요소, 이미 마커 있는 요소
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { applySurgicalASTPatch, rollbackSurgicalASTPatch, ASTPatchOperation } from '../src/utils/ast/modifier';

// ─── 테스트 유틸 ──────────────────────────────────

function createTempFile(content: string, filename: string = 'TestComponent.tsx'): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-test-'));
    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
}

function readAndCleanup(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    return content;
}

// ─── 테스트 픽스처 ─────────────────────────────────

const SIMPLE_BUTTON = `
export function CallToAction() {
    return (
        <a href="/visit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Visit Website
        </a>
    );
}
`;

const BUTTON_WITH_CN_CALL = `
import { cn } from '@/lib/utils';

export function CallToAction({ active }: { active: boolean }) {
    return (
        <a href="/visit" className={cn("bg-blue-500 text-white", active && "ring-2")}>
            Visit Website
        </a>
    );
}
`;

const FRAGMENT_COMPONENT = `
export function CardWrapper({ children }: { children: React.ReactNode }) {
    return (
        <React.Fragment>
            <Button className="bg-red-500 text-sm">Click</Button>
        </React.Fragment>
    );
}
`;

const NO_CLASSNAME = `
export function SimpleLink() {
    return (
        <a href="/about">
            About Us
        </a>
    );
}
`;

const HYPOTHESIS_ID = 'test-hypothesis-00000001';

// ─── 테스트 케이스 ─────────────────────────────────

describe('applySurgicalASTPatch', () => {

    test('Case A: 단순 className 문자열 → Tailwind 클래스 병합', async () => {
        const filePath = createTempFile(SIMPLE_BUTTON);

        const ops: ASTPatchOperation[] = [{
            action: 'merge_tailwind_classes',
            targetComponent: 'a',
            propName: 'className',
            classesToAdd: ['bg-green-500', 'text-lg', 'shadow-lg'],
            classesToRemove: ['bg-blue-500'],
        }];

        const result = await applySurgicalASTPatch(filePath, ops, HYPOTHESIS_ID);
        const output = readAndCleanup(filePath);

        // 기본 검증: 패치 성공
        expect(result).toBe(true);

        // bg-blue-500이 bg-green-500으로 교체됨 (tailwind-merge)
        expect(output).not.toContain('bg-blue-500');
        expect(output).toContain('bg-green-500');

        // 새 클래스 추가
        expect(output).toContain('text-lg');
        expect(output).toContain('shadow-lg');

        // 가역성 마커 주입
        expect(output).toContain(`data-cro-agent="${HYPOTHESIS_ID}"`);

        // 기존 구조 보존
        expect(output).toContain('Visit Website');
        expect(output).toContain('href="/visit"');
    });

    test('Case B: cn() 호출 내부에 클래스 추가', async () => {
        const filePath = createTempFile(BUTTON_WITH_CN_CALL);

        const ops: ASTPatchOperation[] = [{
            action: 'merge_tailwind_classes',
            targetComponent: 'a',
            propName: 'className',
            classesToAdd: ['font-bold', 'hover:scale-105'],
        }];

        const result = await applySurgicalASTPatch(filePath, ops, HYPOTHESIS_ID);
        const output = readAndCleanup(filePath);

        expect(result).toBe(true);

        // cn() 호출에 새 인자 추가됨
        expect(output).toContain('font-bold hover:scale-105');

        // 가역성 마커
        expect(output).toContain(`data-cro-agent="${HYPOTHESIS_ID}"`);

        // 기존 3항 로직 보존
        expect(output).toContain('active && "ring-2"');
    });

    test('className 없는 요소 → 변경 없음', async () => {
        const filePath = createTempFile(NO_CLASSNAME);

        const ops: ASTPatchOperation[] = [{
            action: 'merge_tailwind_classes',
            targetComponent: 'a',
            propName: 'className',
            classesToAdd: ['bg-green-500'],
        }];

        const result = await applySurgicalASTPatch(filePath, ops, HYPOTHESIS_ID);
        const output = readAndCleanup(filePath);

        // className이 없으므로 변경 없음
        expect(result).toBe(false);

        // 원본 보존
        expect(output).toContain('About Us');
        expect(output).not.toContain('data-cro-agent');
    });

    test('Custom Component → display:contents 래퍼', async () => {
        const filePath = createTempFile(FRAGMENT_COMPONENT);

        const ops: ASTPatchOperation[] = [{
            action: 'merge_tailwind_classes',
            targetComponent: 'Button',
            propName: 'className',
            classesToAdd: ['bg-green-500'],
            classesToRemove: ['bg-red-500'],
        }];

        const result = await applySurgicalASTPatch(filePath, ops, HYPOTHESIS_ID);
        const output = readAndCleanup(filePath);

        expect(result).toBe(true);

        // Custom Component → span 래퍼 주입
        expect(output).toContain(`data-cro-agent="${HYPOTHESIS_ID}"`);
        expect(output).toContain("display: 'contents'");
    });
});

describe('rollbackSurgicalASTPatch', () => {

    test('마커 제거 롤백', async () => {
        // 먼저 패치 적용
        const filePath = createTempFile(SIMPLE_BUTTON);
        const ops: ASTPatchOperation[] = [{
            action: 'merge_tailwind_classes',
            targetComponent: 'a',
            propName: 'className',
            classesToAdd: ['bg-green-500'],
            classesToRemove: ['bg-blue-500'],
        }];
        await applySurgicalASTPatch(filePath, ops, HYPOTHESIS_ID);

        // 패치 적용 후 마커 확인
        let content = fs.readFileSync(filePath, 'utf-8');
        expect(content).toContain(`data-cro-agent="${HYPOTHESIS_ID}"`);

        // 롤백 실행
        const rollbackResult = await rollbackSurgicalASTPatch(filePath, HYPOTHESIS_ID);
        const output = readAndCleanup(filePath);

        expect(rollbackResult).toBe(true);

        // 마커 제거 확인
        expect(output).not.toContain(`data-cro-agent="${HYPOTHESIS_ID}"`);

        // 구조 보존
        expect(output).toContain('Visit Website');
    });
});
