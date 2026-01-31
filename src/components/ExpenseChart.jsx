import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { groupExpensesByKeyword, groupExpensesByCategory, CHART_COLORS, REMAINING_COLOR } from '../utils/chartHelpers';
import { formatKRW } from '../utils/format';
import { CATEGORY_ORDER } from '../constants';

const ExpenseChart = ({ expenses, totalBudget, title, onClick, groupBy = 'keyword' }) => {
    const groupedData = groupBy === 'category'
        ? groupExpensesByCategory(expenses)
        : groupExpensesByKeyword(expenses);

    const totalSpent = groupedData.reduce((acc, cur) => acc + cur.value, 0);
    const remaining = Math.max(0, totalBudget - totalSpent);

    // Prepare final data including "Remaining"
    const data = [
        ...groupedData,
        { name: '잔액', value: remaining, isRemaining: true }
    ];

    // Colors mapping
    const finalColors = [
        ...groupedData.map((item, i) => {
            if (groupBy === 'category') {
                // Map based on predefined Category Order to keep colors consistent
                const idx = CATEGORY_ORDER.indexOf(item.name);
                return idx >= 0 ? CHART_COLORS[idx % CHART_COLORS.length] : CHART_COLORS[i % CHART_COLORS.length];
            } else {
                return CHART_COLORS[i % CHART_COLORS.length];
            }
        }),
        REMAINING_COLOR
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { name, value } = payload[0].payload;
            const percent = totalBudget > 0 ? ((value / totalBudget) * 100).toFixed(1) : 0;
            return (
                <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-sm">
                    <p className="font-bold text-slate-700">{name}</p>
                    <p className="text-slate-600">{formatKRW(value)}</p>
                    <p className="text-blue-500 font-medium">{percent}%</p>
                </div>
            );
        }
        return null;
    };

    if (!totalBudget) {
        return (
            <div className="w-full h-[300px] flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl">
                예산 데이터가 없습니다.
            </div>
        );
    }

    return (
        <div className="w-full h-[300px] flex flex-col items-center justify-center" style={{ minHeight: '300px' }}>
            <h3 className="text-lg font-bold text-gray-700 mb-2">{title || "예산 활용 현황"}</h3>
            <div className="text-sm text-gray-500 mb-4">
                총 예산: <span className="font-bold text-gray-800">{formatKRW(totalBudget)}</span> 중
                <span className="text-blue-600 font-bold ml-1">{((totalSpent / totalBudget) * 100).toFixed(1)}%</span> 사용
            </div>
            <div className="w-full flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            onClick={onClick}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={finalColors[index]} stroke="none" cursor="pointer" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value, entry) => {
                                // simple styles for legend text
                                return <span className="text-slate-600 text-xs font-medium ml-1">{value}</span>
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ExpenseChart;
