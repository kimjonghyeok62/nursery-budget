import React, { useEffect, useState, useMemo } from 'react';
import { formatKRW, parseAmount } from '../utils/format';
import Card from './Card';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { useSerialNumbers } from '../hooks/useSerialNumbers';
import { useExpenses2025 } from '../hooks/useExpenses2025';
function openReceiptUrl(url) {
  if (url.startsWith('data:')) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>증빙</title></head><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain;"></body></html>`);
      win.document.close();
    }
  } else {
    window.open(url, '_blank');
  }
}

const COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

const ExpenseItem = ({ item }) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <li
      className="text-base cursor-pointer hover:bg-yellow-50 active:bg-yellow-100 p-0.5 rounded transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex justify-between items-start leading-tight">
        <span
          className={`text-gray-600 flex-1 pr-2 ${expanded ? '' : 'line-clamp-1'}`}
          title={item.description}
        >
          {item.description}
        </span>
        <span className="font-medium whitespace-nowrap">{parseAmount(item.amount).toLocaleString()}</span>
      </div>
      <div className="text-sm text-gray-400 mt-0">{item.date.substring(5)}</div>
    </li>
  );
};


const ByCategory = ({ categorySummary, expenses, onDelete, onEdit, filterCat, setFilterCat, highlightId, onToggleReimbursed, onViewReceipt, budget, categoryOrder = [] }) => {
  const filtered = filterCat ? expenses.filter((e) => e.category === filterCat) : expenses;
  const serialMap = useSerialNumbers();
  const expenses2025 = useExpenses2025();
  const [expandedDescId, setExpandedDescId] = useState(null);

  const historyData = useMemo(() => {
    const now = new Date();
    const targets = [0, 1, 2].map(offset => {
      const targetDisplayDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const lastYearDate = new Date(targetDisplayDate.getFullYear() - 1, targetDisplayDate.getMonth(), 1);
      const y = lastYearDate.getFullYear();
      const m = lastYearDate.getMonth() + 1;
      return { year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}` };
    });

    return targets.map(({ year, month, key }) => {
      const monthlyExpenses = expenses2025.filter(e => e.date && e.date.startsWith(key));
      const grouped = {};
      monthlyExpenses.forEach(e => {
        if (!e.category) return;
        if (!grouped[e.category]) grouped[e.category] = [];
        grouped[e.category].push(e);
      });
      Object.keys(grouped).forEach(k => {
        grouped[k].sort((a, b) => a.date.localeCompare(b.date));
      });
      return { year, month, items: grouped };
    });
  }, [expenses2025]);

  const recentData = useMemo(() => {
    const now = new Date();
    const targets = [-2, -1, 0].map(offset => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return { year: y, month: m, key: `${y}-${String(m).padStart(2, '0')}` };
    });

    return targets.map(({ year, month, key }) => {
      const monthlyExpenses = expenses.filter(e => e.date && e.date.startsWith(key));
      const grouped = {};
      monthlyExpenses.forEach(e => {
        if (!e.category) return;
        if (!grouped[e.category]) grouped[e.category] = [];
        grouped[e.category].push(e);
      });
      Object.keys(grouped).forEach(k => {
        grouped[k].sort((a, b) => a.date.localeCompare(b.date));
      });
      return { year, month, items: grouped };
    });
  }, [expenses]);

  const recentTitle = useMemo(() => {
    if (recentData.length === 0) return "최근 3개월 지출 내역";
    const start = recentData[0];
    const end = recentData[recentData.length - 1];
    return `📅 최근 3개월 지출 내역 (${start.year}년 ${start.month}월 ~ ${end.month}월)`;
  }, [recentData]);

  const historyTitle = useMemo(() => {
    if (historyData.length === 0) return "작년 이맘때 3개월 지출 내역";
    const start = historyData[0];
    const end = historyData[historyData.length - 1];
    return `📅 작년 이맘때 3개월 지출 내역 (${start.year}년 ${start.month}월 ~ ${end.year}년 ${end.month}월)`;
  }, [historyData]);

  useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`row - ${highlightId} `);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('bg-yellow-100');
        setTimeout(() => el.classList.remove('bg-yellow-100'), 2000);
      }
    }
  }, [highlightId, filtered]);

  const detailsRef = React.useRef(null);

  useEffect(() => {
    if (filterCat && detailsRef.current) {
      setTimeout(() => {
        detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [filterCat]);

  return (
    <div className="space-y-6">
      <Card title="세세목별 집행 현황">
        <div className="overflow-x-auto">
          <table className="w-full text-base whitespace-nowrap">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="py-2 px-2 text-left cursor-pointer text-blue-600 underline hover:text-blue-800 transition-colors" onClick={() => setFilterCat("")}>세세목(전체)</th>
                <th className="py-2 px-2 text-right">예산액</th>
                <th className="py-2 px-2 text-right">집행액</th>
                <th className="py-2 px-2 text-right">잔액</th>
                <th className="py-2 px-2 text-right">집행률</th>
              </tr>
            </thead>
            <tbody>
              {categorySummary.map((row) => (
                <tr key={row.category} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setFilterCat(row.category)}>
                  <td className="py-1 px-2 font-medium text-blue-600 underline hover:text-blue-800 transition-colors">{row.category}</td>
                  <td className="py-1 px-2 text-right text-gray-500">{formatKRW(row.budget)}</td>
                  <td className="py-1 px-2 text-right text-blue-600 font-bold">{formatKRW(row.spent)}</td>
                  <td className={`py-1 px-2 text-right ${row.remaining < 0 ? 'text-red-600 font-bold' : ''}`}>{formatKRW(row.remaining)}</td>
                  <td className="py-1 px-2 text-right text-gray-400">{row.ratio.toFixed(1)}%</td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="border-b hover:bg-gray-50 cursor-pointer bg-blue-50">
                <td
                  className="py-1 px-2 font-bold text-blue-600 underline hover:text-blue-800 transition-colors"
                  onClick={() => setFilterCat("")}
                >
                  합계
                </td>
                <td className="py-1 px-2 text-right text-gray-600 font-bold">
                  {formatKRW(categorySummary.reduce((acc, curr) => acc + curr.budget, 0))}
                </td>
                <td className="py-1 px-2 text-right text-blue-600 font-bold">
                  {formatKRW(categorySummary.reduce((acc, curr) => acc + curr.spent, 0))}
                </td>
                <td className={`py-1 px-2 text-right font-bold ${(categorySummary.reduce((acc, curr) => acc + curr.budget, 0) - categorySummary.reduce((acc, curr) => acc + curr.spent, 0)) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                  {formatKRW(categorySummary.reduce((acc, curr) => acc + curr.budget, 0) - categorySummary.reduce((acc, curr) => acc + curr.spent, 0))}
                </td>
                <td className="py-1 px-2 text-right text-gray-600 font-bold">
                  {(categorySummary.reduce((acc, curr) => acc + curr.budget, 0) > 0
                    ? (categorySummary.reduce((acc, curr) => acc + curr.spent, 0) / categorySummary.reduce((acc, curr) => acc + curr.budget, 0) * 100)
                    : 0).toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>


      <div ref={detailsRef}>
        <Card
          title={`${filterCat ? filterCat + ' 지출' : '전체 지출'} (${filtered.length}건)`}
          right={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterCat("")}
                className="text-sm text-blue-500 font-bold underline hover:text-blue-700 transition-colors"
              >
                전체
              </button>
              <a
                href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=0#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
              >
                📊 시트
              </a>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-sm leading-none">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-sm">
                  {/* 연번: sticky left-0 */}
                  <th className="py-2 px-2 text-center w-10 sticky left-0 z-20 bg-gray-50 whitespace-nowrap">연번</th>
                  {/* 날짜: 스크롤 시 연번 뒤로 지나감 */}
                  <th className="py-2 px-2 text-left w-24 whitespace-nowrap">날짜</th>
                  {/* 적요: sticky left-10(40px), 날짜가 지나간 뒤 고정 */}
                  <th className="py-2 px-2 text-left sticky left-10 z-20 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">적요</th>
                  {!filterCat && <th className="py-2 px-2 text-left w-20 whitespace-nowrap">세세목</th>}
                  <th className="py-2 px-2 text-right w-28 whitespace-nowrap">금액</th>
                  <th className="py-2 px-2 text-center w-16 whitespace-nowrap">구매자</th>
                  <th className="py-2 px-2 text-center w-14 whitespace-nowrap">영수증</th>
                  <th className="py-2 px-2 text-center w-10 whitespace-nowrap">입금</th>
                  <th className="py-2 px-2 text-center w-14 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="py-8 text-center text-gray-400">내역이 없습니다.</td></tr>
                ) : (
                  filtered.map((e) => {
                    const isExpanded = expandedDescId === e.id;
                    return (
                    <tr key={e.id} id={`row - ${e.id} `} className="border-b hover:bg-gray-50 group transition-colors duration-500">
                      {/* 연번 sticky */}
                      <td className="py-0.5 px-2 text-center font-mono text-gray-500 text-base leading-tight sticky left-0 z-10 bg-white group-hover:bg-gray-50 whitespace-nowrap align-top pt-1.5">
                        <div>{serialMap[e.id] || "-"}</div>
                        <div className="text-xs text-gray-400 font-normal mt-0.5">{e.date ? e.date.substring(5) : ""}</div>
                      </td>
                      {/* 날짜: 스크롤 시 연번 뒤로 지나감 */}
                      <td className="py-0.5 px-2 text-gray-500 text-base leading-none whitespace-nowrap">{e.date ? e.date.substring(0, 10) : ""}</td>
                      {/* 적요: sticky, 클릭 시 전체 표시 토글 */}
                      <td
                        className="py-0.5 px-2 text-base leading-snug cursor-pointer hover:text-blue-600 sticky left-10 z-10 bg-white group-hover:bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] max-w-[45vw] md:max-w-xs lg:max-w-sm"
                        onClick={() => setExpandedDescId(isExpanded ? null : e.id)}
                        title={isExpanded ? "접기" : "전체 보기"}
                      >
                        {isExpanded
                          ? <span className="whitespace-normal break-words text-blue-700">{e.description}</span>
                          : <div className="truncate">{e.description}</div>
                        }
                      </td>
                      {!filterCat && <td className="py-0.5 px-2 text-gray-700 text-base leading-none whitespace-nowrap">{e.category}</td>}
                      <td className={`py-0.5 px-2 text-right font-bold text-gray-800 text-base leading-none whitespace-nowrap ${e.receiptUrl ? 'cursor-pointer hover:text-blue-600' : ''}`} onClick={() => e.receiptUrl && onViewReceipt && onViewReceipt(e.id)}>{formatKRW(e.amount)}</td>
                      <td className={`py-0.5 px-2 text-center text-gray-600 text-base leading-none whitespace-nowrap ${e.receiptUrl ? 'cursor-pointer hover:text-blue-600' : ''}`} onClick={() => e.receiptUrl && onViewReceipt && onViewReceipt(e.id)}>{e.purchaser}</td>
                      <td className="py-0.5 px-2 text-center whitespace-nowrap">
                        {e.receiptUrl && e.receiptUrl.length > 5 ? (
                          <button onClick={(ent) => {
                            ent.stopPropagation();
                            const urls = e.receiptUrl.split('|').filter(Boolean);
                            if (urls.some(u => u.startsWith('data:'))) {
                              urls.forEach(u => openReceiptUrl(u));
                            } else {
                              onViewReceipt && onViewReceipt(e.id);
                            }
                          }} className="text-blue-500 underline text-sm hover:text-blue-700">{e.receiptUrl.split('|').filter(Boolean).length > 1 ? `보기(${e.receiptUrl.split('|').filter(Boolean).length})` : '보기'}</button>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-0.5 px-2 text-center cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={(ent) => { ent.stopPropagation(); onToggleReimbursed && onToggleReimbursed(e.id); }}>
                        {e.reimbursed ? <span className="text-blue-600 font-bold text-base">O</span> : <span className="text-gray-300 font-bold text-base">X</span>}
                      </td>
                      <td className="py-0.5 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={(ent) => { ent.stopPropagation(); onEdit(e); }} className="p-0.5 rounded bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors" title="수정">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(ent) => { ent.stopPropagation(); onDelete(e.id); }} className="p-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="삭제">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )}
                {/* 합계 행 */}
                {filtered.length > 0 && (
                  <tr className="border-t-2 border-gray-200 bg-blue-50">
                    <td className="py-2 px-2 sticky left-0 z-10 bg-blue-50"></td>
                    <td className="py-2 px-2"></td>
                    <td className="py-2 px-2 text-blue-600 font-bold text-base text-center sticky left-10 z-10 bg-blue-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">합계</td>
                    {!filterCat && <td className="py-2 px-2"></td>}
                    <td className="py-2 px-2 text-right font-bold text-blue-600 text-base whitespace-nowrap">
                      {formatKRW(filtered.reduce((sum, item) => sum + item.amount, 0))}
                    </td>
                    <td className="py-2 px-2"></td>
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

      <div className="mt-12 pt-8 border-t-2 border-slate-200">
        <div className="mb-8 flex items-center justify-center text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <a
            href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline font-medium"
          >
            💡[참고] 전년도 예산집행현황 시트 보기 <ExternalLink size={14} />
          </a>
        </div>

        <div className="mb-10">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{recentTitle}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentData.map(({ year, month, items }) => (
              <div key={`${year}-${month}`} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-lg text-slate-700">{year}년 {month}월</h4>
                  <span className="text-sm font-medium px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-500">
                    {Object.values(items).flat().length}건
                  </span>
                </div>

                {Object.keys(items).length === 0 || Object.values(items).flat().length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    기록된 지출 내역이<br />없습니다.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categoryOrder.filter(cat => items[cat] && items[cat].length > 0).map(cat => (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[categoryOrder.indexOf(cat) % COLORS.length] }}></span>
                          <span className="text-base font-semibold text-gray-700">{cat}</span>
                        </div>
                        <ul className="space-y-1 pl-4 border-l-2 border-slate-200">
                          {items[cat].map((item) => (
                            <ExpenseItem key={item.id} item={item} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{historyTitle}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {historyData.map(({ year, month, items }) => (
              <div key={`${year}-${month}`} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
                  <h4 className="font-bold text-lg text-slate-700">{year}년 {month}월</h4>
                  <span className="text-sm font-medium px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-500">
                    {Object.values(items).flat().length}건
                  </span>
                </div>

                {Object.keys(items).length === 0 || Object.values(items).flat().length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    기록된 지출 내역이<br />없습니다.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {categoryOrder.filter(cat => items[cat] && items[cat].length > 0).map(cat => (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[categoryOrder.indexOf(cat) % COLORS.length] }}></span>
                          <span className="text-base font-semibold text-gray-700">{cat}</span>
                        </div>
                        <ul className="space-y-1 pl-4 border-l-2 border-slate-200">
                          {items[cat].map((item) => (
                            <ExpenseItem key={item.id} item={item} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ByCategory;