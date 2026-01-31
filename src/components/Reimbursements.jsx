import React, { useState, useEffect, useRef } from 'react';
import { formatKRW, parseAmount } from '../utils/format';
import Card from './Card';
import { csvToRows } from '../utils/csv';
import { useSerialNumbers } from '../hooks/useSerialNumbers';

const Reimbursements = ({ expenses, setExpenses }) => {
  const filtered = expenses;
  const [bankMap, setBankMap] = useState({});
  const serialMap = useSerialNumbers();

  const formRef = useRef(null);


  useEffect(() => {
    // 1. Fetch Bank Info (Sheet 2)
    const BANK_CSV_URL = "https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/export?format=csv&gid=300969573";
    fetch(BANK_CSV_URL)
      .then(res => res.text())
      .then(text => {
        const rows = csvToRows(text);
        const map = {};
        rows.forEach(r => {
          const name = r['이름'] || r['성명'] || r['구매자'] || "";
          const bank = r['은행'] || r['은행명'] || "";
          const account = r['계좌번호'] || r['계좌'] || r['송금계좌번호'] || "";
          if (name) map[name.trim()] = { bank, account };
        });
        setBankMap(map);
      })
      .catch(err => console.warn("Failed to fetch bank info", err));
  }, []);

  function togglePaid(id, value) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, webChurchConfirmed: value, webChurchConfirmedAt: value ? (e.webChurchConfirmedAt || new Date().toISOString().slice(0, 10)) : "" } : e));
  }



  // Web Church automation logic removed




  function handleWebChurchLogin() {
    // Open in a separate popup window to allow side-by-side view
    const targetUrl = "https://ch2ch.or.kr/mobile/default_main.asp#Gift_Committee/gift_Ask_input.asp?mode=input&kind=new&ask_type=decision&money_account=2302&money_years=12129";
    const width = 800;
    const height = 900;
    const left = window.screen.width - width;
    const top = 0;
    window.open(targetUrl, "WebChurchPopup", `width=${width},height=${height},left=${left},top=${top},popup=yes,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes`);
  }

  function copyToClipboard(text) {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text).then(() => {
      alert(`복사되었습니다: ${text}`);
    }).catch(err => {
      console.error("Copy failed", err);
    });
  }


  return (
    <div className="space-y-6">


      <Card
        title={<span className="text-lg">웹교회 입력 (회계용)</span>}
        right={
          <button
            onClick={handleWebChurchLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-0.5 px-3 rounded shadow transition"
          >
            웹교회 이동
          </button>
        }
      >

        <div className="overflow-x-auto">
          <table className="w-full text-base whitespace-nowrap">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 px-2">입력</th>

                <th className="py-2 px-2">연번</th>
                <th className="py-2 px-2 text-blue-600">내역(복사)</th>
                <th className="py-2 px-2">지출 날짜</th>
                <th className="py-2 px-2">세세목</th>
                <th className="py-2 px-2">금액</th>
                <th className="py-2 px-2">구매자</th>
                <th className="py-2 px-2">은행명</th>
                <th className="py-2 px-2 text-blue-600">계좌번호(복사)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const updatedBankInfo = bankMap[e.purchaser] || {};
                return (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-1 px-2"><input type="checkbox" className="w-5 h-5" checked={!!e.webChurchConfirmed} onChange={(ev) => togglePaid(e.id, ev.target.checked)} aria-label="입력 여부" /></td>

                    <td className="py-1 px-2 text-gray-500 font-mono">{serialMap[e.id] || "-"}</td>
                    <td
                      className="py-1 px-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors rounded"
                      onClick={() => copyToClipboard(e.description)}
                      title="클릭하여 복사"
                    >
                      {e.description}
                    </td>
                    <td className="py-1 px-2">{e.date}</td>
                    <td className="py-1 px-2">{e.category}</td>
                    <td className="py-1 px-2">{formatKRW(parseAmount(e.amount))}</td>
                    <td className="py-1 px-2 font-bold">{e.purchaser}</td>
                    <td className="py-1 px-2 text-gray-600">{updatedBankInfo.bank || "-"}</td>
                    <td
                      className="py-1 px-2 text-gray-600 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors rounded"
                      onClick={() => copyToClipboard(updatedBankInfo.account)}
                      title="클릭하여 복사"
                    >
                      {updatedBankInfo.account || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default Reimbursements;
