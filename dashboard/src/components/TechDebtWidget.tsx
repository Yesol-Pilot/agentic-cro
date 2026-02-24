import React from 'react';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CoverageData {
    module: string;
    coverage: number;
}

// TODO: 실제 백엔드 커버리지(jest coverage report json)와 연동할 대상 (현재는 더미 상태)
const MOCK_DEBT_DATA: CoverageData[] = [
    { module: 'schemas.ts', coverage: 100 },
    { module: 'supervisor.ts', coverage: 0 },
    { module: 'bayesian.ts', coverage: 0 },
    { module: 'modifier.ts', coverage: 0 },
];

export default function TechDebtWidget() {
    const getCoverageColor = (cov: number) => {
        if (cov === 100) return 'text-green-500';
        if (cov > 50) return 'text-yellow-500';
        return 'text-red-500';
    };

    const getCoverageBarColor = (cov: number) => {
        if (cov === 100) return 'bg-green-500';
        if (cov > 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    return (
        <div className="p-6 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-white tracking-wide">
                    Core Modules Tech Debt
                </h3>
            </div>

            <p className="text-xs text-slate-400 mb-6">
                * "Visibility-driven Testing": UI 개발 전 반드시 단위 테스트를 통과시킬 것!
            </p>

            <div className="space-y-5">
                {MOCK_DEBT_DATA.map((item) => (
                    <div key={item.module} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-slate-300 flex items-center gap-2">
                                {item.coverage === 100 ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                )}
                                {item.module}
                            </span>
                            <span className={`font-bold ${getCoverageColor(item.coverage)}`}>
                                {item.coverage}%
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ${getCoverageBarColor(item.coverage)}`}
                                style={{ width: `${item.coverage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
