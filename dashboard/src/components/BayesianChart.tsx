'use client';
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

// -----------------------------------------------------------------
// [Phase 13] Bayesian Posterior Vector Visualization
// -----------------------------------------------------------------
// 백엔드(Bayesian Engine) 코어에서 계산된 전환 확률 밀도 함수(PDF)를
// 프론트엔드 Recharts 면적 곡선으로 렌더링하는 시각화 코어입니다.
// 현재는 수학적 추정을 위한 더미 데이터(Beta Distribution Mock)가 쓰입니다.
// -----------------------------------------------------------------

const MOCK_BAYESIAN_DATA = Array.from({ length: 50 }, (_, i) => {
    const x = i / 50;
    // Beta distribution rough approximation
    // 대조군(Control)은 10% 부근, 실험군(Variant)은 12% 부근에서 Peak 형성
    const control = Math.max(0, 100 * Math.exp(-Math.pow(x - 0.1, 2) / 0.005));
    const variant = Math.max(0, 80 * Math.exp(-Math.pow(x - 0.12, 2) / 0.005));

    return {
        conversionRate: (x * 100).toFixed(1) + '%',
        control: Number(control.toFixed(2)),
        variant: Number(variant.toFixed(2)),
    };
});

export default function BayesianChart() {
    return (
        <div className="flex flex-col p-6 bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl h-[450px]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                        <TrendingUp className="w-5 h-5 text-indigo-400" />
                    </div>
                    <h3 className="font-semibold text-white tracking-wide">
                        베이지안 사후 분포 (Posterior Distribution)
                    </h3>
                </div>
                <div className="flex gap-5 text-xs font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-400 opacity-50 shadow-[0_0_8px_rgba(148,163,184,0.5)]"></div>
                        <span className="text-slate-300">Control (A)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-slate-300">Variant (B)</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={MOCK_BAYESIAN_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorControl" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVariant" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.7} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} vertical={false} />
                        <XAxis
                            dataKey="conversionRate"
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={10}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={() => ''} /* 확률 밀도 절대값 표시는 베이지안 UI 관례상 생략 */
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                            itemStyle={{ color: '#e2e8f0', fontSize: '13px' }}
                            labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="control"
                            name="대조군 (Control)"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorControl)"
                            animationDuration={1500}
                        />
                        <Area
                            type="monotone"
                            dataKey="variant"
                            name="대안군 (Variant)"
                            stroke="#818cf8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorVariant)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center">
                <p className="text-[11px] text-slate-500 tracking-wider">
                    X-AXIS: Conversion Rate (%) &nbsp;|&nbsp; Y-AXIS: Probability Density
                </p>
            </div>
        </div>
    );
}
