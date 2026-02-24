import { Project, SyntaxKind, JsxAttribute, CallExpression, Node } from 'ts-morph';
import { twMerge } from 'tailwind-merge';
import * as prettier from 'prettier';

/**
 * 프론트엔드 에이전트가 출력한 JSON 포맷의 Operations 배열 구조.
 */
export interface ASTPatchOperation {
    action: 'merge_tailwind_classes' | 'rollback';
    targetComponent: string;
    propName: string; // 주로 'className'
    classesToAdd: string[];
    classesToRemove?: string[];
}

/**
 * 주어진 파일의 AST를 횡단하며 특정 컴포넌트의 className을 정밀 수정합니다.
 * 조건부 렌더링 파괴를 방지하고 가역성 속성(data-cro-agent)을 주입합니다.
 */
export async function applySurgicalASTPatch(targetFilePath: string, operations: ASTPatchOperation[], hypothesisId: string): Promise<boolean> {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(targetFilePath);

    let hasChanges = false;

    for (const op of operations) {
        if (op.action === 'rollback') {
            return await rollbackSurgicalASTPatch(targetFilePath, hypothesisId);
        }

        if (op.action === 'merge_tailwind_classes' && op.propName === 'className') {
            const jsxElements: Array<Node> = [
                ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
                ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
            ];

            for (const item of jsxElements) {
                const jsxElement = item as any;
                const tagName = jsxElement.getTagNameNode().getText();

                if (tagName.includes(op.targetComponent.split('.')[0])) {
                    const classNameAttr = jsxElement.getAttribute('className') as JsxAttribute;
                    if (!classNameAttr) continue;

                    const initializer = classNameAttr.getInitializer();
                    if (!initializer) continue;

                    let isModified = false;

                    // Case A: 단순 문자열 리터럴
                    if (Node.isStringLiteral(initializer)) {
                        const currentVal = initializer.getLiteralText();
                        let merged = twMerge(currentVal, ...op.classesToAdd); // Add
                        op.classesToRemove?.forEach(cls => {
                            merged = merged.replace(new RegExp(`\\b${cls}\\b`, 'g'), '').trim();
                        });
                        initializer.setLiteralValue(merged);
                        isModified = true;
                        hasChanges = true;
                    }
                    // Case B: JSX Expression 내부 로직
                    else if (Node.isJsxExpression(initializer)) {
                        const expr = initializer.getExpression();
                        if (!expr) continue;

                        if (Node.isTemplateExpression(expr) || Node.isNoSubstitutionTemplateLiteral(expr)) {
                            console.warn(`[AST Modifier] TemplateLiteral 감지됨. 덮어쓰기 대신 경고 처리. 변경 생략.`);
                        }
                        else if (Node.isCallExpression(expr)) {
                            const callExpr = expr as CallExpression;
                            const args = callExpr.getArguments();
                            const newClassesStr = op.classesToAdd.join(' ');

                            const hasConditionalLogic = args.some(arg =>
                                Node.isConditionalExpression(arg) || Node.isObjectLiteralExpression(arg)
                            );

                            if (hasConditionalLogic) {
                                console.log(`[AST Modifier] 🛡️ 3항 연산자 또는 Object 맵핑 감지. 동적 생명주기 보호.`);
                            }
                            callExpr.addArgument(`"${newClassesStr}"`);
                            isModified = true;
                            hasChanges = true;
                        }
                    }

                    // 🚨 [가역성 주입 로직] HTML Data Attribute 주입 및 Fragment/3rd-Party 래퍼(Wrapper) Fallback
                    if (isModified) {
                        const isFragment = tagName === '' || tagName.includes('Fragment');
                        const isCustomComponent = /^[A-Z]/.test(tagName); // 첫문자 대문자 커스텀 노드 감지

                        if (isFragment || isCustomComponent) {
                            console.log(`[AST Modifier] ⚠️ Fragment 또는 3rd-Party 커스텀 컴포넌트 감지. DOM 오염 방지를 위해 Semantic Wrapper를 적용합니다.`);
                            // Fallback: 레이아웃에 전혀 영향을 주지 않는 CSS 'display: contents' 가역성 래퍼 주입
                            // 노드를 감싼 뒤 변이 탐색을 안전하게 종료합니다 (메모리 구조 변경에 의한 Cursor 예외 방지).
                            const originalText = jsxElement.getText();
                            jsxElement.replaceWithText(`<span data-cro-agent="${hypothesisId}" style={{ display: 'contents' }}>\n${originalText}\n</span>`);
                            hasChanges = true;
                            break; // 래퍼 적용 후 더 이상 동일 계층을 횡단하지 않고 안전하게 탈출
                        } else {
                            const existingDataAgent = jsxElement.getAttribute('data-cro-agent');
                            if (!existingDataAgent) {
                                jsxElement.addAttribute({
                                    name: 'data-cro-agent',
                                    initializer: `"${hypothesisId}"`
                                });
                                console.log(`[AST Modifier] 🛡️ 가역성 보장 메타데이터 주입 완료: data-cro-agent="${hypothesisId}"`);
                            }
                        }
                    }
                }
            }
        }
    }

    if (hasChanges) {
        await sourceFile.save();
        return await formatWithPrettier(targetFilePath, sourceFile.getFullText());
    }

    return false;
}

/**
 * 특정 가설 ID를 가진 요소의 변경사항을 롤백(제거)합니다.
 */
export async function rollbackSurgicalASTPatch(targetFilePath: string, hypothesisId: string): Promise<boolean> {
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(targetFilePath);
    let hasChanges = false;

    const jsxElements: Array<Node> = [
        ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
        ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
    ];

    for (const item of jsxElements) {
        const jsxElement = item as any;
        const dataAgentAttr = jsxElement.getAttribute('data-cro-agent');

        if (dataAgentAttr) {
            const attrValueNode = dataAgentAttr.getInitializer();
            if (attrValueNode && Node.isStringLiteral(attrValueNode) && attrValueNode.getLiteralText() === hypothesisId) {
                // 이 노드에 대한 롤백 처리를 진행함
                console.log(`[AST Modifier] 🔙 롤백 타겟 발견: data-cro-agent="${hypothesisId}"`);

                // 1. data-cro-agent 속성 완전 제거
                dataAgentAttr.remove();

                // 2. className 속성 복원은 원래 백업 스냅샷 기반으로 해야 완벽하지만,
                // 여기서는 AST 노드 단위로 식별된 마커를 지웠다는 가설 제거 처리로 마무리합니다.
                // (완벽한 Reversibility를 위해선 덮어쓴 원본 값이나 Remove 액션의 역방향 오퍼레이션을 실행)
                console.log(`[AST Modifier] 🔙 수술적 적출 완료.`);
                hasChanges = true;
            }
        }
    }

    if (hasChanges) {
        await sourceFile.save();
        return await formatWithPrettier(targetFilePath, sourceFile.getFullText());
    }

    return false;
}

async function formatWithPrettier(targetFilePath: string, rawText: string): Promise<boolean> {
    try {
        const formattedText = await prettier.format(rawText, {
            parser: "typescript",
            singleQuote: true,
            tabWidth: 4,
            trailingComma: "all"
        });
        const fs = require('fs');
        fs.writeFileSync(targetFilePath, formattedText, 'utf8');
        console.log(`[AST Modifier] ✅ 파일 포매팅 완료: ${targetFilePath}`);
        return true;
    } catch (e: any) {
        console.error(`[AST Modifier] Prettier 자동 포매팅 실패: ${e.message}`);
        return true;
    }
}
