import React, { useMemo } from 'react';
import { formatKRW, parseAmount } from '../utils/format';
import { CATEGORY_ORDER as DEFAULT_CATEGORY_ORDER } from '../constants';
import Card from './Card';
import { ExternalLink, Plus, RefreshCcw, Save, Trash2, Upload, Loader2, Link as LinkIcon, FileCheck, Pencil, Cloud, Folder, HeartHandshake } from 'lucide-react';
import { gsFetch } from '../utils/google';
import { compressImage } from '../utils/dataUrl';
import { resolveReceiptUrl } from '../utils/receiptStorage';

const COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
];

const Analysis = ({
  expenses,
  onJumpToExpense,
  categoryOrder = DEFAULT_CATEGORY_ORDER,
  fellowshipData = [],
  setFellowshipData,
  gsCfg,
  highlightId,
  onSaveFellowship
}) => {
  const [editingId, setEditingId] = React.useState(null);
  const fellowshipWithReceipts = useMemo(() =>
    [...fellowshipData]
      .filter((e) => e.receiptUrl)
      .sort((a, b) => b.date.localeCompare(a.date)),
  [fellowshipData]);

  const ReceiptCard = ({ e }) => {
    // Find the index in sorted fellowshipData to match ledger #
    const sorted = [...fellowshipData].sort((a, b) => a.date.localeCompare(b.date));
    const idx = sorted.findIndex(item => item.id === e.id);
    const serialNum = idx !== -1 ? idx + 1 : null;

    return (
      <div key={e.id} id={`receipt-${e.id}`} className="border rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow transition-all duration-500">
        <div
          className="aspect-video bg-gray-100 overflow-hidden relative group cursor-pointer"
          onClick={async () => { const win = window.open('', '_blank'); if (!win) return; win.document.write(`<!DOCTYPE html><html><head><title>증빙</title></head><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><span style="color:#fff">로딩 중...</span></body></html>`); const resolved = await resolveReceiptUrl(e.receiptUrl); if (!resolved) { win.close(); return; } if (resolved.startsWith('data:')) { win.document.body.innerHTML = `<img src="${resolved}" style="max-width:100%;max-height:100vh;object-fit:contain;">`; } else { win.location.href = resolved; } }}
        >
          <img
            src={e.receiptUrl.includes("drive.google.com") && e.receiptUrl.includes("id=")
              ? `https://drive.google.com/thumbnail?id=${new URL(e.receiptUrl).searchParams.get("id")}&sz=w800`
              : e.receiptUrl}
            alt={e.description || "receipt"}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(ev) => { if (!ev.target.src.includes("export=view")) ev.target.src = e.receiptUrl; }}
          />
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="bg-black/50 text-white px-2 py-1 rounded text-sm">원본 보기</span>
          </div>
        </div>

        <div
          className="p-3 text-base cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => {
            const el = document.getElementById(`fellowship-row-${e.id}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          title="해당 내역으로 이동"
        >
          <div className="font-medium flex items-center justify-between">
            <span>
              {serialNum ? <span className="text-gray-500 mr-2 font-mono text-sm">#{serialNum}</span> : null}
              <span className="text-gray-800">{e.description || "영수증"}</span>
            </span>
          </div>
          <div className="text-gray-600 mt-1 text-sm">{e.date}</div>
          <div className="mt-1 font-bold text-gray-900">
            {formatKRW(parseAmount(e.expense))}
            {e.remarks && <span className="font-normal text-gray-500 text-xs ml-2">[{e.remarks}]</span>}
          </div>
        </div>
      </div>
    );
  };

  // Fellowship form state
  const [fellowshipForm, setFellowshipForm] = React.useState({
    type: "지출", // "수입" or "지출"
    date: new Date().toISOString().split('T')[0],
    description: "",
    amount: "",
    remarks: "",
    receiptUrl: ""
  });
  const [isUploading, setIsUploading] = React.useState(false);

  const fellowshipLedger = useMemo(() => {
    // 1. Sort ascending for cumulative balance calculation
    const list = [...fellowshipData].sort((a, b) => a.date.localeCompare(b.date));

    // 2. Add cumulative balance and serial number (oldest=1)
    let balance = 0;
    const withBalance = list.map((item, index) => {
      balance += (item.income || 0) - (item.expense || 0);
      return { ...item, balance, seq: index + 1 };
    });

    // 3. Reverse for display: newest date at top
    return withBalance.reverse();
  }, [fellowshipData]);

  // Effect to scroll to highlighted fellowship row
  React.useEffect(() => {
    if (highlightId) {
      const el = document.getElementById(`fellowship-row-${highlightId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // High-visibility highlight: brighter yellow + pulse + bold border
        el.classList.add('bg-yellow-100', 'ring-4', 'ring-indigo-500', 'animate-pulse', 'z-10', 'relative');
        setTimeout(() => {
          el.classList.remove('animate-pulse');
        }, 1500);
        setTimeout(() => {
          el.classList.remove('bg-yellow-100', 'ring-4', 'ring-indigo-500', 'z-10', 'relative');
        }, 4000);
      }
    }
  }, [highlightId]);

  const handleAddFellowship = async (e) => {
    e.preventDefault();
    if (!fellowshipForm.date || !fellowshipForm.description || !fellowshipForm.amount) {
      alert("날짜, 적요, 금액은 필수입니다.");
      return;
    }

    const amount = parseAmount(fellowshipForm.amount);
    const newItem = {
      id: editingId || crypto.randomUUID(),
      date: fellowshipForm.date,
      description: fellowshipForm.description,
      income: fellowshipForm.type === "수입" ? amount : 0,
      expense: fellowshipForm.type === "지출" ? amount : 0,
      remarks: fellowshipForm.remarks,
      receiptUrl: fellowshipForm.type === "지출" ? fellowshipForm.receiptUrl : ""
    };

    if (editingId) {
      setFellowshipData(prev => prev.map(item => item.id === editingId ? newItem : item));
      setEditingId(null);
    } else {
      setFellowshipData(prev => [newItem, ...prev]);
    }

    setFellowshipForm({
      type: "지출",
      date: new Date().toISOString().split('T')[0],
      description: "",
      amount: "",
      remarks: "",
      receiptUrl: ""
    });
  };

  const onImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressed = await compressImage(file);
      const safeDesc = fellowshipForm.description ? fellowshipForm.description.replace(/[^\w가-힣_.-]/g, "_") : "receipt";
      const formattedAmount = parseAmount(fellowshipForm.amount).toLocaleString('ko-KR');
      const filename = `fellowship_${safeDesc}_${fellowshipForm.date}_${formattedAmount}원.jpg`;

      const res = await gsFetch(gsCfg, "uploadFellowshipReceipt", {
        filename,
        mimeType: "image/jpeg",
        dataUrl: compressed.dataUrl,
      });

      const viewUrl = res.viewUrl || (res.fileId ? `https://drive.google.com/uc?export=view&id=${res.fileId}` : "");
      if (viewUrl) {
        setFellowshipForm(f => ({ ...f, receiptUrl: viewUrl }));
      }
    } catch (err) {
      console.error("Fellowship photo upload failed", err);
      alert("업로드 실패: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFellowship = (id) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setFellowshipData(prev => prev.filter(item => item.id !== id));
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setFellowshipForm({
      type: item.income > 0 ? "수입" : "지출",
      date: item.date,
      description: item.description,
      amount: String(item.income > 0 ? item.income : item.expense),
      remarks: item.remarks || "",
      receiptUrl: item.receiptUrl || ""
    });
    // Scroll to input
    const el = document.getElementById('fellowship-input-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Card>
      <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <HeartHandshake className="text-blue-600" /> 교사 친목회
      </h3>

      {/* 친목회 입력 섹션 */}
      <section id="fellowship-input-section" className="mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
        <h4 className="text-xl font-semibold mb-4">친목회(수입,지출) 입력</h4>
        <form onSubmit={handleAddFellowship} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">구분</label>
              <div className="flex bg-white rounded-xl border border-gray-300 p-1">
                {["수입", "지출"].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFellowshipForm({ ...fellowshipForm, type: t })}
                    className={`flex-1 py-1 text-sm font-bold rounded-lg transition-colors ${fellowshipForm.type === t ? (t === "수입" ? "bg-blue-600 text-white" : "bg-red-600 text-white") : "text-gray-400"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">날짜</label>
              <input type="date" value={fellowshipForm.date} onChange={(e) => setFellowshipForm({ ...fellowshipForm, date: e.target.value })} className="w-full rounded-xl border-gray-300 border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">적요</label>
              <input type="text" value={fellowshipForm.description} onChange={(e) => setFellowshipForm({ ...fellowshipForm, description: e.target.value })} placeholder="적요 입력" className="w-full rounded-xl border-gray-300 border px-3 py-2 text-sm" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">금액</label>
              <input type="text" inputMode="numeric" value={fellowshipForm.amount} onChange={(e) => setFellowshipForm({ ...fellowshipForm, amount: e.target.value })} placeholder="0" className="w-full rounded-xl border-gray-300 border px-3 py-2 text-sm text-right font-bold" />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium text-gray-500 mb-1 block">비고</label>
              <input type="text" value={fellowshipForm.remarks} onChange={(e) => setFellowshipForm({ ...fellowshipForm, remarks: e.target.value })} placeholder="비고" className="w-full rounded-xl border-gray-300 border px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {fellowshipForm.type === "지출" && (
              <div className="flex-1 flex items-center gap-2">
                <label className={`shrink-0 px-3 py-2 rounded-xl border border-gray-300 text-sm cursor-pointer flex items-center gap-2 transition-colors ${isUploading ? 'bg-gray-100 text-gray-400' : 'bg-white hover:bg-gray-50 text-gray-600'}`}>
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  <span>{isUploading ? "업로드 중..." : "증빙 업로드"}</span>
                  <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" disabled={isUploading} />
                </label>
                <input type="text" value={fellowshipForm.receiptUrl} onChange={(e) => setFellowshipForm({ ...fellowshipForm, receiptUrl: e.target.value })} placeholder="증빙 URL" className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm bg-gray-50" />
              </div>
            )}
            <div className={`flex items-center gap-2 ${fellowshipForm.type === "수입" ? "w-full justify-end" : "shrink-0"}`}>
              <button type="button" onClick={() => {
                setFellowshipForm({ type: "지출", date: new Date().toISOString().split('T')[0], description: "", amount: "", remarks: "", receiptUrl: "" });
                setEditingId(null);
              }} className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 flex items-center gap-1 text-sm">
                <RefreshCcw size={16} /> 초기화
              </button>
              <button type="submit" disabled={isUploading} className={`px-4 py-2 rounded-xl text-white font-bold flex items-center gap-1 text-sm ${editingId ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"}`}>
                {editingId ? <Save size={18} /> : <Plus size={18} />} {editingId ? "수정" : "추가"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* 친목회 장부 섹션 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xl font-semibold">친목회(수입,지출) 장부정리</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={onSaveFellowship}
              className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1 font-medium shadow-sm active:scale-95"
              title="Google Sheet로 즉시 동기화"
            >
              <Cloud size={14} /> 시트 동기화
            </button>
            <a
              href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=1416333507#gid=1416333507"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              <ExternalLink size={12} /> 구글 시트 보기
            </a>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-base border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-gray-500 font-medium">
                <th className="px-3 py-2 text-center w-12">#</th>
                <th className="px-3 py-2 text-center w-24">날짜</th>
                <th className="px-3 py-2 text-left">적요</th>
                <th className="px-3 py-2 text-right w-24">수입금액</th>
                <th className="px-3 py-2 text-right w-24">지출금액</th>
                <th className="px-3 py-2 text-right w-28 bg-slate-100/50">잔액</th>
                <th className="px-3 py-2 text-center w-16">증빙</th>
                <th className="px-3 py-2 text-left w-24">비고</th>
                <th className="px-3 py-2 text-center w-20">관리</th>
              </tr>
            </thead>
            <tbody>
              {fellowshipLedger.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-gray-400">데이터가 없습니다.</td>
                </tr>
              ) : (
                fellowshipLedger.map((item) => (
                  <tr
                    key={item.id}
                    id={`fellowship-row-${item.id}`}
                    className="border-b border-gray-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-center text-gray-400 font-mono text-sm">{item.seq}</td>
                    <td
                      className={`px-3 py-2 text-center text-gray-500 whitespace-nowrap ${item.receiptUrl ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                      onClick={() => {
                        if (item.receiptUrl) {
                          const el = document.getElementById(`receipt-${item.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      {String(item.date || "").substring(5)}
                    </td>
                    <td
                      className={`px-3 py-2 font-medium ${item.receiptUrl ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                      onClick={() => {
                        if (item.receiptUrl) {
                          const el = document.getElementById(`receipt-${item.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      {item.description}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600 font-semibold">{item.income > 0 ? item.income.toLocaleString() : ""}</td>
                    <td
                      className={`px-3 py-2 text-right text-red-600 font-semibold ${item.receiptUrl ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                      onClick={() => { if (item.receiptUrl) onJumpToFellowshipReceipt(item.id); }}
                    >
                      {item.expense > 0 ? item.expense.toLocaleString() : ""}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-bold bg-slate-50/30 ${item.receiptUrl ? 'cursor-pointer hover:text-indigo-600 hover:underline' : ''}`}
                      onClick={() => {
                        if (item.receiptUrl) {
                          const el = document.getElementById(`receipt-${item.id}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      {item.balance ? item.balance.toLocaleString() : "0"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {item.receiptUrl ? (
                        <button
                          onClick={() => {
                            const el = document.getElementById(`receipt-${item.id}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors"
                          title="증빙 보기"
                        >
                          <LinkIcon size={16} className="mx-auto" />
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-sm truncate max-w-[100px]" title={item.remarks}>{item.remarks}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="수정">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteFellowship(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" title="삭제">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 친목회 영수증 갤러리 섹션 */}
      <section className="mt-12 bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xl font-semibold flex items-center gap-2">
            📸 친목회 영수증 갤러리
            <span className="text-xs font-normal text-gray-400">({fellowshipWithReceipts.length}건)</span>
          </h4>
          <a
            href="https://drive.google.com/drive/folders/1ZkYWUsDxJGn-JK1sxyN7OZqipGdGNBl4"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors flex items-center gap-1 font-medium shadow-sm active:scale-95"
          >
            <Folder size={14} /> 드라이브
          </a>
        </div>

        {fellowshipWithReceipts.length === 0 ? (
          <p className="text-base text-gray-500 py-8 text-center bg-white rounded-xl border border-dashed">등록된 친목회 영수증이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {fellowshipWithReceipts.map((e) => (
              <ReceiptCard key={e.id} e={e} />
            ))}
          </div>
        )}
      </section>
    </Card>
  );
};

export default Analysis;
