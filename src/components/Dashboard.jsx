import React, { useState, useRef } from 'react';
import { formatKRW } from '../utils/format';
import Card from './Card';
import ProgressBar from './ProgressBar';
import ExpenseChart from './ExpenseChart';
import { useSerialNumbers } from '../hooks/useSerialNumbers';

const Dashboard = ({ totalSpent, categorySummary, onNavigate, budget, expenses, onViewReceipt }) => {
  const totalBudget = budget.total;
  const remain = totalBudget - totalSpent;

  const [selectedCategory, setSelectedCategory] = useState("");
  const chartRef = useRef(null);
  const expenseListRef = useRef(null);
  const serialMap = useSerialNumbers();

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleTitleClick = () => {
    setSelectedCategory("");
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleChartClick = (data) => {
    if (!data || !data.name) return;
    if (data.name === '잔액') return;

    if (selectedCategory) {
      // If already filtered, navigate to details (Expense Tab)
      onNavigate(selectedCategory);
    } else {
      // If overall, filter Dashboard
      handleCategoryClick(data.name);
    }
  };

  // Filter for Chart
  const chartExpenses = selectedCategory ? expenses.filter(e => e.category === selectedCategory) : expenses;
  const chartBudget = selectedCategory ? (categorySummary.find(c => c.category === selectedCategory)?.budget || 0) : totalBudget;
  const chartTitle = selectedCategory ? `${selectedCategory} 예산 분석` : "전체 예산 분석";
  const startNavigate = () => {
    if (selectedCategory) onNavigate(selectedCategory);
  };

  return (
    <div className="space-y-6">
      {/* Top Cards: Global Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="총 예산">
          <p className="text-3xl font-bold text-gray-900">{formatKRW(totalBudget)}</p>
        </Card>
        <Card title="현재 지출">
          <p className="text-3xl font-bold text-red-600">{formatKRW(totalSpent)}</p>
        </Card>
        <Card title="잔액">
          <p className={`text-3xl font-bold ${remain < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatKRW(remain)}</p>
        </Card>
      </div>

      {/* Chart Section */}
      <div ref={chartRef}>
        <Card>
          <div onClick={startNavigate} className={selectedCategory ? "cursor-pointer" : ""}>
            <ExpenseChart
              expenses={chartExpenses}
              totalBudget={chartBudget}
              title={chartTitle}
              onClick={handleChartClick}
              groupBy={selectedCategory ? 'keyword' : 'category'}
            />
          </div>
        </Card>
      </div>

      {/* Filtered Expense List */}
      {selectedCategory && (
        <div ref={expenseListRef}>
          <Card title={`${selectedCategory} 지출 내역 (${chartExpenses.length}건)`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm leading-none whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 text-sm">
                    <th className="py-2 px-2 text-center w-12">연번</th>
                    <th className="py-2 px-2 text-left">적요</th>
                    <th className="py-2 px-2 text-left w-24">날짜</th>
                    <th className="py-2 px-2 text-right w-24">금액</th>
                    <th className="py-2 px-2 text-center w-20">구매자</th>
                    <th className="py-2 px-2 text-center w-16">영수증</th>
                    <th className="py-2 px-2 text-center w-16">입금여부</th>
                  </tr>
                </thead>
                <tbody>
                  {chartExpenses.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-gray-400">내역이 없습니다.</td></tr>
                  ) : (
                    chartExpenses.map((e) => (
                      <tr key={e.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-0.5 px-2 text-center font-mono text-gray-500 text-base leading-none">{serialMap[e.id] || "-"}</td>
                        <td className="py-0.5 px-2 text-base leading-none">{e.description}</td>
                        <td className="py-0.5 px-2 text-gray-500 text-base leading-none">{e.date ? e.date.substring(0, 10) : ""}</td>
                        <td className="py-0.5 px-2 text-right font-bold text-gray-800 text-base leading-none">{formatKRW(e.amount)}</td>
                        <td className="py-0.5 px-2 text-center text-gray-600 text-base leading-none">{e.purchaser}</td>
                        <td className="py-0.5 px-2 text-center">
                          {e.receiptUrl && e.receiptUrl.length > 5 ? (
                            <button onClick={() => onViewReceipt && onViewReceipt(e.id)} className="text-blue-500 underline text-sm hover:text-blue-700">보기</button>
                          ) : (
                            <span className="text-gray-300 text-sm">-</span>
                          )}
                        </td>
                        <td className="py-0.5 px-2 text-center">
                          {e.reimbursed ? <span className="text-blue-600 font-bold text-base">O</span> : <span className="text-gray-300 font-bold text-base">X</span>}
                        </td>
                      </tr>
                    ))
                  )}
                  {chartExpenses.length > 0 && (
                    <tr className="border-t-2 border-gray-200 bg-blue-50">
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2 text-blue-600 font-bold text-base text-center">합계</td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2 text-right font-bold text-blue-600 text-base">
                        {formatKRW(chartExpenses.reduce((sum, e) => sum + e.amount, 0))}
                      </td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2"></td>
                      <td className="py-2 px-2"></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2
              className="text-lg font-bold text-blue-600 underline cursor-pointer hover:text-blue-800 transition-colors"
              onClick={handleTitleClick}
            >
              세세목별 집행 현황(전체)
            </h2>

          </div>

        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorySummary.map((row) => {
            const percent = Math.round((row.spent / row.budget) * 100) || 0;
            const isDanger = percent >= 90;
            const isOver = percent > 100;
            return (
              <div
                key={row.category}
                onClick={() => handleCategoryClick(row.category)}
                className={`border bg-white rounded-xl p-3 flex flex-col gap-2 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${selectedCategory === row.category ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-gray-800 text-base">{row.category}</h3>
                  <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isOver ? 'bg-red-600 text-white' : (isDanger ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600')}`}>
                    {percent}%
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${isOver ? 'bg-red-600' : (isDanger ? 'bg-red-500' : 'bg-blue-500')}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                </div>

                <div className="flex justify-between items-end text-sm">
                  <div className="text-gray-500">
                    <div className="text-base">지출: <span className="text-gray-900 font-medium">{formatKRW(row.spent)}</span></div>
                    <div className="text-sm mt-0.5">예산: {formatKRW(row.budget)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">잔액</div>
                    <div className={`font-bold text-base ${row.remaining < 0 ? 'text-red-600' : 'text-blue-600'}`}>{formatKRW(row.remaining)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
