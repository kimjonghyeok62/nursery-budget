import React, { useState, useRef } from 'react';
import { formatKRW } from '../utils/format';
import Card from './Card';
import ProgressBar from './ProgressBar';
import ExpenseChart from './ExpenseChart';

const Dashboard = ({ totalSpent, categorySummary, onNavigate, budget, expenses }) => {
  const totalBudget = budget.total;
  const remain = totalBudget - totalSpent;

  const [selectedCategory, setSelectedCategory] = useState("");
  const chartRef = useRef(null);

  const handleCategoryClick = (cat) => {
    setSelectedCategory(cat);
    // Scroll to chart
    setTimeout(() => {
      chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
