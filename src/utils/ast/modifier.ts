import { Project, SyntaxKind, JsxAttribute, CallExpression, Node } from 'ts-morph';
import { twMerge } from 'tailwind-merge';
// Prettier는 ESM 전용이므로 동적 로딩 (Jest CommonJS 환경 호환)

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
                            // Fallback: 부모 JsxElement 전체를 교체 (Opening 태그만 교체하면 JSX 트리 파괴)
                            const parentJsx = Node.isJsxOpeningElement(jsxElement) ? jsxElement.getParent() : jsxElement;
                            if (parentJsx && !parentJsx.wasForgotten()) {
                                const originalText = parentJsx.getText();
                                parentJsx.replaceWithText(`<span data-cro-agent="${hypothesisId}" style={{ display: 'contents' }}>\n${originalText}\n</span>`);
                            }
                            hasChanges = true;
                            break;
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

    // 계속해서 노드 구조가 변형될 수 있으므로 매번 노드 리스트를 재조회하면서 처리
    let shouldContinue = true;
    while (shouldContinue) {
        shouldContinue = false;
        const jsxElements: Array<Node> = [
            ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
            ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
        ];

        for (const item of jsxElements) {
            const jsxElement = item as any;

            // 삭제된(파괴된) 노드인지 확인하여 에러 방어
            if (jsxElement.wasForgotten()) continue;

            const proxyNode = Node.isJsxSelfClosingElement(jsxElement) ? jsxElement : jsxElement.getParent();
            if (!proxyNode || proxyNode.wasForgotten()) continue;

            const dataAgentAttr = jsxElement.getAttribute('data-cro-agent');
            if (dataAgentAttr) {
                const attrValueNode = dataAgentAttr.getInitializer();
                if (attrValueNode && Node.isStringLiteral(attrValueNode) && attrValueNode.getLiteralText() === hypothesisId) {
                    hasChanges = true;
                    console.log(`[AST Modifier] 🔙 롤백 타겟 발견: data-cro-agent="${hypothesisId}"`);

                    const tagName = jsxElement.getTagNameNode().getText();
                    const styleAttr = jsxElement.getAttribute('style');

                    // 1. Semantic Wrapper (Fragment/Custom 등) Unwrapping 해체
                    if (tagName === 'span' && styleAttr && styleAttr.getText().includes('display: \'contents\'')) {
                        console.log(`[AST Modifier] ♻️ Semantic Wrapper 해체(Unwrapping) 처리 중...`);
                        // 부모 노드(JsxElement)의 자식들을 가져와서 텍스트 결합 후 부모 자체를 텍스트 교체
                        if (Node.isJsxElement(proxyNode)) {
                            const childrenText = proxyNode.getJsxChildren().map(c => c.getText()).join('\n').trim();
                            proxyNode.replaceWithText(childrenText);
                            shouldContinue = true; // 트리가 변경되었으므로 다시 탐색
                            break;
                        }
                    } else {
                        // 2. 일반 노드: 속성(data-cro-agent) 제거
                        dataAgentAttr.remove();
                        // (완벽한 Reversibility를 위한 className Restore는 별도 Snapshot 시스템 필요. 
                        // 본 버전에선 마커 제거로 GC(Garbage Collection) 가시성 선행 확보)
                        console.log(`[AST Modifier] 🔙 수술적 마커 적출 완료.`);
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

async function formatWithPrettier(targetFilePath: string, rawText: string): Promise<boolean> {
    try {
        const prettier = await import('prettier');
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
        console.warn(`[AST Modifier] ⚠️ Prettier 포매팅 스킵 (비치명적): ${e.message}`);
        return true;
    }
}
