/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, LineChart, Table2, CheckSquare, GalleryHorizontalEnd, Trash2, Plus, Save, RefreshCcw, Bug, CloudUpload, CloudDownload, Link as LinkIcon, KeyRound, Upload, Settings, Loader2, Pencil, X, Folder, Users, FileText, ChevronDown, ChevronUp, HeartHandshake } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DEFAULT_BUDGET, CATEGORY_ORDER, CLOUD_META, GS_META, LOCAL_KEY, IMGBB_META, DEFAULT_IMGBB_KEY } from "./constants";
import TabButton from "./components/TabButton";
import ProgressBar from "./components/ProgressBar";
import Card from "./components/Card";
import Dashboard from './components/Dashboard';
import ByCategory from './components/ByCategory';
import Analysis from './components/Analysis';
import Attendance from './components/Attendance';

import Toast from './components/Toast';
import Reimbursements from './components/Reimbursements';
import ReceiptsGallery from './components/ReceiptsGallery';
import Login from './components/Login';

import { useLocalStorageState } from './hooks/useLocalStorageState';
import { useGScriptConfig } from './hooks/useGScriptConfig';
import { useSerialNumbers } from './hooks/useSerialNumbers';
import { useRecommendations } from './hooks/useRecommendations';
import { groupBy } from './utils/collections';
import { loadFirebaseCompat, uploadToFirebaseStorage } from './utils/firebase';
import { gsFetch } from './utils/google';
import { fileToDataUrl, urlToDataUrl, compressImage } from './utils/dataUrl';
import { csvToRows, rowsToCsv } from './utils/csv';
import { setupPWA } from './utils/pwa';
import { formatKRW, monthKey, parseAmount } from "./utils/format";

/**
 * 유치부 예산관리 대시보드
 * - 탭: 대시보드, 세세목별, 월별, 영수증, 입금확인, 자가 테스트
 * - 기능: 지출 입력 / CSV 가져오기·내보내기 / 로컬스토리지 저장 / 차트·갤러리
 * - 모바일: 카메라 바로 열기(capture), 터치 타깃 확대
 * - PWA: 홈 화면 설치 & (가능한 환경에서만) 오프라인 캐시
 * - 클라우드 동기화(선택): Firebase 또는 Google Apps Script(Drive/Sheets)
 * - 데이터 스키마: { id, date(YYYY-MM-DD), category, description, amount(number), purchaser, receiptUrl, reimbursed(boolean), reimbursedAt(YYYY-MM-DD) }
 */

// ---- Google Apps Script 연동 헬퍼 ----
const initialExpenses = [];

const AMOUNT_RE = /(\d[\d,]*(?:\.\d+)?(?:만|억)?원)/g;
const AMOUNT_TEST = /^\d[\d,]*(?:\.\d+)?(?:만|억)?원$/;
function boldAmounts(text) {
  if (!text) return text;
  const parts = text.split(AMOUNT_RE);
  return parts.map((part, i) =>
    AMOUNT_TEST.test(part) ? <strong key={i}>{part}</strong> : part
  );
}

export default function NurseryBudgetApp() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRole, setAuthRole] = useState("full"); // 'full' or 'partial'
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Session Check on Mount
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('nursery_auth_Session');
    const sessionRole = sessionStorage.getItem('nursery_auth_Role');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
      if (sessionRole) setAuthRole(sessionRole);
    }
  }, []);

  const handleLogin = async (password, callback) => {
    try {
      setIsAuthLoading(true);
      // If GAS is not configured yet (first run), we might need a bypass or standard check.
      // But assuming user has set up GAS.
      if (!gsCfg.url) {
        alert("Google Apps Script URL이 설정되지 않았습니다. 설정(톱니바퀴)을 확인해주세요.");
        callback(false);
        return;
      }

      const res = await gsFetch(gsCfg, 'verifyAppPassword', { password });

      if (res.valid) {
        sessionStorage.setItem('nursery_auth_Session', 'true');
        sessionStorage.setItem('nursery_auth_Role', res.role || 'full');
        setAuthRole(res.role || 'full');
        setIsAuthenticated(true);
        callback(true);
      } else {
        callback(false);
      }
    } catch (e) {
      console.error("Login verification failed", e);
      alert("로그인 확인 중 오류가 발생했습니다: " + e.message);
      callback(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const [tab, setTab] = useState("dashboard");
  const [filterCat, setFilterCat] = useState("");
  const [expenses, setExpenses] = useLocalStorageState(LOCAL_KEY, initialExpenses);

  function handleNavigate(cat) {
    if (authRole !== "full") return;
    setTab("bycat");
    setFilterCat(cat || "");
  }

  const [form, setForm] = useState({
    date: "",
    category: CATEGORY_ORDER[0],
    description: "",
    amount: "",
    purchaser: "",
    receiptUrl: "",
  });

  // objectURL 해제용 (메모리 누수 방지)
  const receiptObjUrlRef = useRef("");
  useEffect(() => {
    return () => {
      if (receiptObjUrlRef.current) {
        try { URL.revokeObjectURL(receiptObjUrlRef.current); } catch { }
      }
    };
  }, []);

  // Firebase Cloud state
  const [cloudOn, setCloudOn] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudInfo, setCloudInfo] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CLOUD_META) || "null") || { projectId: "", apiKey: "", appId: "", authDomain: "", userId: "" }; } catch { return { projectId: "", apiKey: "", appId: "", authDomain: "", userId: "" }; }
  });
  const cloudRef = useRef({ unsub: null, updating: false });

  // imgbb API key
  const [imgbbKey, setImgbbKey] = useState(() => {
    try { return localStorage.getItem(IMGBB_META) || DEFAULT_IMGBB_KEY; } catch { return DEFAULT_IMGBB_KEY; }
  });

  // Google Apps Script config
  const [gsCfg, setGsCfg] = useGScriptConfig();
  const [gsOn, setGsOn] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [toast, setToast] = useState(null);
  const [recommendedList, setRecommendedList] = useState([]);
  const [stopRecommending, setStopRecommending] = useState(false);

  function showToast(message, type = 'success') {
    setToast({ message, type });
  }
  const gsSyncRef = useRef(false); // GS 동기화 루프 방지
  const [isLoaded, setIsLoaded] = useState(false); // 로드 완료 여부
  const [isUploading, setIsUploading] = useState(false); // 업로드 진행 상태



  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [categoryOrder, setCategoryOrder] = useState(CATEGORY_ORDER);
  const [purchaserOptions, setPurchaserOptions] = useState([]);
  const [showPurchaserSuggestions, setShowPurchaserSuggestions] = useState(false);
  const [showBudgetGuide, setShowBudgetGuide] = useState(false);
  const [budgetGuide, setBudgetGuide] = useState({});

  // Unauthorized Tab Redirect
  useEffect(() => {
    if (authRole === "partial") {
      const allowed = ["dashboard", "attendance"];
      if (!allowed.includes(tab)) {
        setTab("dashboard");
      }
    }
  }, [tab, authRole]);

  // Attendance State (Lifted)
  const [attendanceState, setAttendanceState] = useLocalStorageState("nursery-attendance-v3", {
    members: [],
    attendanceData: { headers: [], records: [] },
    isLoaded: false
  });

  // Fellowship State (Lifted)
  const [fellowshipData, setFellowshipData] = useLocalStorageState("nursery-fellowship-v1", []);
  const [isFellowshipLoaded, setIsFellowshipLoaded] = useState(false);
  const fellowshipSyncRef = useRef(false);

  // Fetch Purchaser Options
  useEffect(() => {
    if (!isAuthenticated || !gsOn || !gsCfg.url) return;
    const fetchPurchasers = async () => {
      try {
        const res = await gsFetch(gsCfg, "getPurchasers", {});
        if (res && Array.isArray(res.purchasers)) {
          setPurchaserOptions(res.purchasers);
        }
      } catch (e) {
        console.warn("Purchaser fetch skipped/failed", e);
      }
    };
    fetchPurchasers();
  }, [isAuthenticated, gsOn, gsCfg]);

  // Fetch Budget from Sheet (5th Sheet)
  useEffect(() => {
    if (!isAuthenticated || !gsOn || !gsCfg.url) return;
    (async () => {
      try {
        const res = await gsFetch(gsCfg, "getBudget", {});
        if (res.budgetRows && Array.isArray(res.budgetRows)) {
          const rows = res.budgetRows;
          const budgetMap = new Map();

          rows.forEach(row => {
            const strRow = row.map(c => String(c));
            DEFAULT_BUDGET.items.forEach(defItem => {
              if (strRow.includes(defItem.key)) {
                const val = row.find(c => typeof c === 'number' || (typeof c === 'string' && !isNaN(parseInt(c.replace(/,/g, ''), 10))));
                if (val !== undefined) {
                  const num = typeof val === 'number' ? val : parseInt(val.replace(/,/g, ''), 10);
                  budgetMap.set(defItem.key, num);
                }
              }
            });
          });

          if (budgetMap.size > 0) {
            const updatedItems = DEFAULT_BUDGET.items.map(item => ({
              ...item,
              budget: budgetMap.has(item.key) ? budgetMap.get(item.key) : item.budget
            }));
            const newTotal = updatedItems.reduce((acc, curr) => acc + curr.budget, 0);
            setBudget({ ...DEFAULT_BUDGET, total: newTotal, items: updatedItems });
          }
        }
      } catch (err) {
        console.warn("Budget fetch failed", err);
      }
    })();
  }, [isAuthenticated, gsOn, gsCfg]);

  // Fetch Budget Guide from Sheet
  useEffect(() => {
    if (!isAuthenticated || !gsOn || !gsCfg.url) return;
    (async () => {
      try {
        const res = await gsFetch(gsCfg, "getBudgetGuide", {});
        if (res.guide) {
          setBudgetGuide(res.guide);
        }
      } catch (err) {
        console.warn("Budget guide fetch failed", err);
      }
    })();
  }, [isAuthenticated, gsOn, gsCfg]);

  const serialMap = useSerialNumbers(); // 연번 정보 가져오기
  const recommendations = useRecommendations(); // 추천 정보 가져오기

  const inputFileRef = useRef(null);

  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + parseAmount(e.amount), 0), [expenses]);
  const byCategory = useMemo(() => groupBy(expenses, (e) => e.category || "미분류"), [expenses]);
  const categorySummary = useMemo(() => {
    return categoryOrder.map((cat) => {
      const budgetVal = budget.items.find((i) => i.key === cat)?.budget || 0;
      const spent = (byCategory[cat] || []).reduce((s, e) => s + parseAmount(e.amount), 0);
      const ratio = budgetVal > 0 ? (spent / budgetVal) * 100 : 0;
      return { category: cat, budget: budgetVal, spent, remaining: budgetVal - spent, ratio };
    });
  }, [byCategory, budget, categoryOrder]);


  // 입금(환급) 집계
  const reimbursedSum = useMemo(() => expenses.filter((e) => e.reimbursed).reduce((s, e) => s + parseAmount(e.amount), 0), [expenses]);
  const pendingSum = useMemo(() => expenses.filter((e) => !e.reimbursed).reduce((s, e) => s + parseAmount(e.amount), 0), [expenses]);

  // PWA 설정 (1회)
  useEffect(() => { setupPWA(); }, []);

  // Firebase: 로컬 변경 → 업로드 (옵션)
  useEffect(() => {
    if (!cloudOn || !cloudInfo.userId) return;
    if (cloudRef.current.updating) return;
    (async () => {
      try {
        setCloudBusy(true);
        const firebase = await loadFirebaseCompat();
        // eslint-disable-next-line no-unused-vars
        const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp({
          apiKey: cloudInfo.apiKey,
          authDomain: cloudInfo.authDomain,
          projectId: cloudInfo.projectId,
          appId: cloudInfo.appId,
        });
        const fs = firebase.firestore();
        const docRef = fs.collection("nursery-budget").doc(LOCAL_KEY);
        await docRef.set({ expenses }, { merge: true });
      } catch (e) {
        console.warn("Cloud push error", e);
      } finally {
        setCloudBusy(false);
      }
    })();
  }, [expenses, cloudOn, cloudInfo]);

  // Google Apps Script: 로컬 변경 → 자동 저장 (이미지 업로드 포함)
  useEffect(() => {
    if (!gsOn || !gsCfg.url) return;
    if (!isLoaded) return; // 로드가 완료되지 않았으면 저장하지 않음 (데이터 유실 방지)
    if (gsSyncRef.current) { gsSyncRef.current = false; return; }

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        let finalExpenses = expenses;
        const next = [];
        let hasUpdates = false;

        // Optimistic Serial Calculation
        const currentSerials = Object.values(serialMap).map(v => parseInt(v, 10)).filter(n => !isNaN(n));
        let nextSerialBase = currentSerials.length > 0 ? Math.max(...currentSerials) + 1 : 1;
        let serialOffset = 0;

        // 1) 이미지 업로드 체크 (파이프 구분 다중 URL 지원)
        for (const e of expenses) {
          const rawUrl = typeof e.receiptUrl === 'string' ? e.receiptUrl : '';
          const parts = rawUrl ? rawUrl.split('|').filter(Boolean) : [];
          const hasPending = parts.some(p => p.startsWith("blob:") || p.startsWith("data:"));

          if (hasPending) {
            try {
              const safeDesc = e.description ? e.description.replace(/[^\w가-힣_.-]/g, "_") : "receipt";
              const formattedAmount = parseAmount(e.amount).toLocaleString('ko-KR');
              let serialPrefix = "";
              if (serialMap[e.id]) {
                serialPrefix = `${serialMap[e.id]}_`;
              } else {
                serialPrefix = `${nextSerialBase + serialOffset}_`;
                serialOffset++;
              }

              const converted = [];
              let changed = false;
              for (const part of parts) {
                if (part.startsWith("blob:") || part.startsWith("data:")) {
                  try {
                    const conv = part.startsWith("data:") ? { dataUrl: part, mime: "image/jpeg" } : await urlToDataUrl(part);
                    const filename = `${serialPrefix}${e.date}_${e.category}_${safeDesc}_${formattedAmount}원.png`;
                    const up = await gsFetch(gsCfg, "uploadReceipt", {
                      filename,
                      mimeType: conv.mime || "image/png",
                      dataUrl: conv.dataUrl,
                    });
                    const viewUrl = up.viewUrl || (up.fileId ? `https://drive.google.com/uc?export=view&id=${up.fileId}` : "") || (up.id ? `https://drive.google.com/uc?export=view&id=${up.id}` : "");
                    if (viewUrl) { converted.push(viewUrl); changed = true; continue; }
                  } catch (err) {
                    console.warn("Auto upload fail", err);
                  }
                  // 업로드 실패 시: 로컬 상태는 원본 유지 (시트 저장 시 safe filter에서 제거됨)
                  converted.push(part);
                  continue;
                }
                converted.push(part);
              }
              if (changed) {
                next.push({ ...e, receiptUrl: converted.join('|') });
                hasUpdates = true;
                continue;
              }
            } catch (err) {
              console.warn("Auto upload fail (outer)", err);
            }
          }
          next.push(e);
        }

        if (hasUpdates) {
          gsSyncRef.current = true; // prevent loop from this update
          setExpenses(next);
          finalExpenses = next;
        }

        // 2) 시트 저장 (data:/blob: URL은 셀 한도 초과 → 제거 후 저장)
        const safeExpenses = finalExpenses.map(e => ({
          ...e,
          receiptUrl: (e.receiptUrl || '').split('|').filter(u => !u.startsWith('data:') && !u.startsWith('blob:')).join('|')
        }));
        console.log("[auto-save] safeExpenses receiptUrls:", safeExpenses.map(e => e.receiptUrl).filter(Boolean));
      await gsFetch(gsCfg, "save", { expenses: safeExpenses });
      } catch (e) {
        console.warn("Auto save error", e);
      } finally {
        setIsSyncing(false);
      }
    }, 1000); // 1초 디바운스로 단축 (모바일 저장 안정성)

    return () => clearTimeout(timer);
  }, [expenses, gsOn, gsCfg, serialMap]);

  // Google Apps Script: Fellowship Auto Save
  useEffect(() => {
    if (!gsOn || !gsCfg.url || !isFellowshipLoaded) return;
    if (fellowshipSyncRef.current) { fellowshipSyncRef.current = false; return; }

    const timer = setTimeout(async () => {
      try {
        setIsSyncing(true);
        await gsFetch(gsCfg, "saveFellowship", { fellowship: fellowshipData });
      } catch (e) {
        console.warn("Fellowship auto save error", e);
      } finally {
        setIsSyncing(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [fellowshipData, gsOn, gsCfg, isFellowshipLoaded]);

  // 자동 불러오기 (최초 1회)
  useEffect(() => {
    // URL이 있고 인증되었으면 즉시 로드 시도
    if (isAuthenticated && gsOn && gsCfg.url) {
      gsLoad(true);
      gsLoadFellowship(true);
    } else if (!gsCfg.url) {
      // URL 없으면 로컬 데이터만 사용하므로 로드 완료 처리
      setIsLoaded(true);
      setIsFellowshipLoaded(true);
    }
  }, [isAuthenticated, gsOn, gsCfg]); // Re-run when auth changes

  async function resetAll() {
    if (!confirm("모든 데이터가 삭제됩니다. 정말 삭제하시겠습니까? (구글 시트 포함)")) return;
    setExpenses([]);

    // Explicitly sync the empty state to server to bypass useEffect loop protection
    if (gsOn && gsCfg.url) {
      try {
        setIsSyncing(true);
        await gsFetch(gsCfg, "save", { expenses: [] });
        // alert("서버 데이터도 초기화되었습니다."); // Optional: silent is better for UX, or toast
      } catch (e) {
        console.warn("Server reset failed", e);
        alert("서버 동기화 실패. 다시 시도해주세요.");
      } finally {
        setIsSyncing(false);
      }
    }
  }

  function addExpense(e) {
    e.preventDefault();
    console.log("[addExpense] form.receiptUrl:", form.receiptUrl);
    const payload = {
      id: editingId || crypto.randomUUID(),
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      amount: parseAmount(form.amount),
      purchaser: form.purchaser.trim(),
      receiptUrl: form.receiptUrl.trim(),
      reimbursed: false, // editing doesn't change this usually, but simple overwrite is okay for now
      reimbursedAt: "",
      webChurchConfirmed: false,
      webChurchConfirmedAt: "",  // same
    };

    // If editing, preserve existing values for fields not in form if necessary (but form covers all main ones)
    // Actually, preserve 'reimbursed' status if editing
    if (editingId) {
      const existing = expenses.find(x => x.id === editingId);
      if (existing) {
        payload.reimbursed = existing.reimbursed;
        payload.reimbursedAt = existing.reimbursedAt;
        payload.webChurchConfirmed = existing.webChurchConfirmed;
        payload.webChurchConfirmedAt = existing.webChurchConfirmedAt;
      }
    }

    if (!payload.date || !payload.category || !payload.amount) {
      alert("날짜, 세세목, 금액은 필수입니다.");
      return;
    }

    if (editingId) {
      setExpenses((prev) => {
        const existing = prev.find(x => x.id === editingId); // Re-find existing for toast calculation
        const next = prev.map(e => e.id === editingId ? { ...payload, reimbursed: existing.reimbursed, reimbursedAt: existing.reimbursedAt } : e);

        // Calculate stats for toast
        const budgetItem = budget.items.find(item => item.key === payload.category);
        const budgetLimit = budgetItem ? budgetItem.budget : 0;
        const totalSpent = next.filter(e => e.category === payload.category).reduce((sum, e) => sum + e.amount, 0);
        const remaining = budgetLimit - totalSpent;

        const spentRatio = budgetLimit > 0 ? (totalSpent / budgetLimit * 100).toFixed(1) : 0;
        const remainRatio = budgetLimit > 0 ? (remaining / budgetLimit * 100).toFixed(1) : 0;

        showToast(
          `수정되었습니다.\n` +
          `[${payload.category}]\n` +
          `누적집행: ${formatKRW(totalSpent)} (${spentRatio}%)\n` +
          `잔액: ${formatKRW(remaining)} (${remainRatio}%)`
        );
        return next;
      });
    } else {
      setExpenses((prev) => {
        const next = [payload, ...prev];

        // Calculate stats for toast
        const budgetItem = budget.items.find(item => item.key === payload.category);
        const budgetLimit = budgetItem ? budgetItem.budget : 0;
        const totalSpent = next.filter(e => e.category === payload.category).reduce((sum, e) => sum + e.amount, 0);
        const remaining = budgetLimit - totalSpent;

        const spentRatio = budgetLimit > 0 ? (totalSpent / budgetLimit * 100).toFixed(1) : 0;
        const remainRatio = budgetLimit > 0 ? (remaining / budgetLimit * 100).toFixed(1) : 0;

        showToast(
          `추가되었습니다.\n` +
          `[${payload.category}]\n` +
          `누적집행: ${formatKRW(totalSpent)} (${spentRatio}%)\n` +
          `잔액: ${formatKRW(remaining)} (${remainRatio}%)`
        );
        return next;
      });
    }

    setForm({ date: "", category: CATEGORY_ORDER[0], description: "", amount: "", purchaser: "", receiptUrl: "" });
    setEditingId(null);
    setStopRecommending(false);
  }

  function startEdit(item) {
    setForm({
      date: item.date.substring(0, 10),
      category: item.category,
      description: item.description,
      amount: String(item.amount),
      purchaser: item.purchaser || "",
      receiptUrl: item.receiptUrl || ""
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copyExpense(item) {
    setForm({
      date: item.date.substring(0, 10),
      category: item.category,
      description: item.description,
      amount: String(item.amount),
      purchaser: item.purchaser || "",
      receiptUrl: "",
    });
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteExpense(id) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    // Google Drive File Deletion Logic
    const target = expenses.find((e) => e.id === id);
    if (target?.receiptUrl && gsOn && gsCfg?.url) {
      try {
        let fileId = "";
        try {
          const u = new URL(target.receiptUrl);
          fileId = u.searchParams.get("id");
        } catch (e) { /* ignore */ }

        if (fileId) {
          // Fire and forget (don't block UI)
          gsFetch(gsCfg, "deleteReceipt", { fileId })
            .then(() => console.log("Drive file deleted:", fileId))
            .catch((err) => console.warn("Failed to delete Drive file:", err));
        }
      } catch (err) {
        console.warn("Error preparing delete:", err);
      }
    }

    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }
  function handleToggleReimbursed(id) {
    setExpenses((prev) => prev.map((e) => {
      if (e.id !== id) return e;
      const newVal = !e.reimbursed;
      const newDate = newVal ? new Date().toISOString().slice(0, 10) : "";
      return { ...e, reimbursed: newVal, reimbursedAt: newDate };
    }));
  }

  function onImportCsv(evt) {
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = csvToRows(text);
      const normalized = rows
        .map((r) => ({
          id: crypto.randomUUID(),
          date: r.date || r.날짜 || "",
          category: r.category || r.세세목 || r.분류 || "",
          description: r.description || r.적요 || r.설명 || "",
          amount: parseAmount(r.amount || r.금액),
          purchaser: r.purchaser || r.구매자 || "",
          receiptUrl: r.receiptUrl || r.영수증 || r.영수증URL || "",
          reimbursed: String(r.reimbursed || r.입금완료 || "").toLowerCase() === "true",
          reimbursedAt: r.reimbursedAt || r.입금일 || "",
          webChurchConfirmed: String(r.webChurchConfirmed || r.웹교회입력여부 || "").toLowerCase() === "true",
          webChurchConfirmedAt: r.webChurchConfirmedAt || r.웹교회입력일 || "",
        }))
        .filter((x) => x.date && x.category && x.amount);
      setExpenses((prev) => [...normalized, ...prev]);
      if (inputFileRef.current) inputFileRef.current.value = "";
      alert(`${normalized.length}건을 가져왔습니다.`);
    };
    reader.readAsText(file, "utf-8");
  }

  function onExportCsv() {
    const rows = expenses.map(({ id, ...rest }) => rest);
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `유치부_지출내역_${budget.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleJumpToExpense(id) {
    if (authRole !== "full") return;
    setTab("bycat");
    setFilterCat(""); // Clear filter to ensure visibility
    setHighlightId(id);
  }

  function handleJumpToReceipt(id) {
    if (authRole !== "full") return;
    setTab("receipts");
    setHighlightId(id);
  }


  async function onImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const currentUrls = form.receiptUrl ? form.receiptUrl.split('|').filter(Boolean) : [];
    if (currentUrls.length >= 5) return;

    try {
      setIsUploading(true);

      // 항상 먼저 압축 (Drive 성공/실패 무관하게 폴백용으로 사용, 800px/0.45 품질로 소용량)
      const compressed = await compressImage(file, 800, 0.45);

      const safeDesc = form.description ? form.description.replace(/[^\w가-힣_.-]/g, "_") : "receipt";
      const formattedAmount = parseAmount(form.amount).toLocaleString('ko-KR');
      let serialPrefix = "";
      if (editingId && serialMap[editingId]) {
        serialPrefix = `${serialMap[editingId]}_`;
      } else {
        let serverCount = expenses.length;
        try {
          if (gsOn && gsCfg.url) {
            const listData = await gsFetch(gsCfg, "list", {});
            if (listData && Array.isArray(listData.expenses)) serverCount = listData.expenses.length;
          }
        } catch (e) {
          console.warn("Serial fetch failed, using local count", e);
        }
        serialPrefix = `${serverCount + 1}_`;
      }
      const filename = `${serialPrefix}${safeDesc}_${form.date}_${form.category}_${formattedAmount}원_${form.purchaser || "미지정"}.jpg`;

      // 1순위: Apps Script → Google Drive 업로드 (청소년부와 동일 방식)
      let uploadedUrl = null;
      if (gsOn && gsCfg.url) {
        try {
          const res = await gsFetch(gsCfg, "uploadReceipt", {
            filename,
            mimeType: "image/jpeg",
            dataUrl: compressed.dataUrl,
          });
          const viewUrl = res.viewUrl || (res.fileId ? `https://drive.google.com/uc?export=view&id=${res.fileId}` : "") || (res.id ? `https://drive.google.com/uc?export=view&id=${res.id}` : "");
          if (viewUrl) uploadedUrl = viewUrl;
        } catch (err) {
          console.warn("Drive 업로드 실패", err);
          alert("드라이브 업로드 실패: " + err.toString() + "\n(로컬 미리보기로 대체합니다)");
        }
      }

      // 2순위 폴백: imgbb
      if (!uploadedUrl && imgbbKey) {
        try {
          const base64 = compressed.dataUrl.split(',')[1];
          const fd = new FormData();
          fd.append("key", imgbbKey);
          fd.append("image", base64);
          fd.append("name", filename.replace(/\.jpg$/, ""));
          const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: fd });
          const json = await res.json();
          uploadedUrl = json?.data?.display_url || json?.data?.url || null;
        } catch (err) {
          console.warn("imgbb 업로드 실패", err);
        }
      }

      // 최종 폴백: blob URL (로컬 미리보기)
      if (!uploadedUrl) uploadedUrl = URL.createObjectURL(file);

      setForm((f) => {
        const urls = f.receiptUrl ? f.receiptUrl.split('|').filter(Boolean) : [];
        return { ...f, receiptUrl: [...urls, uploadedUrl].join('|') };
      });

    } finally {
      setIsUploading(false);
    }
  }

  async function connectCloud() {
    try {
      setCloudBusy(true);
      const firebase = await loadFirebaseCompat();
      // eslint-disable-next-line no-unused-vars
      const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp({
        apiKey: cloudInfo.apiKey,
        authDomain: cloudInfo.authDomain,
        projectId: cloudInfo.projectId,
        appId: cloudInfo.appId,
      });
      const auth = firebase.auth();
      const { user } = await auth.signInAnonymously();
      const userId = user?.uid || "";
      const fs = firebase.firestore();
      const docRef = fs.collection("nursery-budget").doc(LOCAL_KEY);

      if (cloudRef.current.unsub) { cloudRef.current.unsub(); cloudRef.current.unsub = null; }
      cloudRef.current.unsub = docRef.onSnapshot((snap) => {
        const data = snap.data();
        if (data && Array.isArray(data.expenses)) {
          cloudRef.current.updating = true;
          setExpenses(data.expenses);
          setTimeout(() => (cloudRef.current.updating = false), 200);
        }
      });

      setCloudInfo((prev) => ({ ...prev, userId }));
      localStorage.setItem(CLOUD_META, JSON.stringify({ ...cloudInfo, userId }));
      setCloudOn(true);
      alert("클라우드 동기화에 연결되었습니다.");
    } catch (e) {
      console.warn(e);
      alert("클라우드 연결 실패: Firebase 설정을 확인해 주세요.");
    } finally {
      setCloudBusy(false);
    }
  }

  function disconnectCloud() {
    try {
      if (cloudRef.current.unsub) { cloudRef.current.unsub(); cloudRef.current.unsub = null; }
      setCloudOn(false);
    } catch { }
  }

  async function gsLoad(silent = false) {
    try {
      if (!gsCfg.url) {
        if (!silent) alert("URL이 설정되지 않았습니다. 설정(톱니바퀴)을 확인해주세요.");
        return;
      }
      setIsSyncing(true);
      setIsLoaded(false); // CRITICAL: Start by blocking auto-saves
      const data = await gsFetch(gsCfg, "list", {});
      if (Array.isArray(data.expenses)) {
        // Sanitize incoming data
        const safeExpenses = data.expenses.map(e => ({
          ...e,
          receiptUrl: typeof e.receiptUrl === 'string' ? e.receiptUrl : String(e.receiptUrl || "")
        }));
        gsSyncRef.current = true;
        setExpenses(safeExpenses);
        setIsLoaded(true); // ONLY set true on success
        if (!silent) alert(`총 ${safeExpenses.length}건의 데이터를 성공적으로 불러왔습니다.`);
      } else {
        if (!silent) alert("데이터를 찾을 수 없거나 형식이 올바르지 않습니다.");
        // DO NOT set isLoaded(true) here
      }
    } catch (e) {
      if (!silent) alert("시트에서 불러오기 실패: " + e.message + "\nURL과 토큰을 다시 확인해주세요.");
      else {
        console.warn("Auto-load failed", e);
        // Warn and ensure sync is effectively paused
        alert("⚠️ 서버 데이터 불러오기 실패!\n\n데이터 보호를 위해 '자동 저장'이 일시 중지되었습니다.\n\n인터넷 연결을 확인하고 [설정 > 수동 불러오기]를 시도하여 데이터를 먼저 동기화해주세요.");
      }
      // CRITICAL: Ensure we stay in "not loaded" state to prevent overwriting server data with stale local data
    } finally {
      setIsSyncing(false);
    }
  }

  async function gsLoadFellowship(silent = false) {
    try {
      if (!gsCfg.url) return;
      if (!silent) setIsSyncing(true);
      setIsFellowshipLoaded(false);
      const data = await gsFetch(gsCfg, "getFellowship", {});
      if (data && Array.isArray(data.fellowship)) {
        fellowshipSyncRef.current = true;
        setFellowshipData(data.fellowship);
        setIsFellowshipLoaded(true);
      }
    } catch (e) {
      console.warn("Fellowship load failed", e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }

  // Fetch Attendance Data (once or when config changes)
  const fetchAttendanceData = async (silent = false) => {
    if (!gsCfg.url) return;
    try {
      if (!silent) setIsSyncing(true);
      const res = await gsFetch(gsCfg, 'getAttendanceInit', {});
      if (res.members) {
        setAttendanceState({
          members: res.members,
          attendanceData: res.attendance || { headers: [], records: [] },
          isLoaded: true
        });
      }
    } catch (e) {
      console.warn("Attendance fetch failed", e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && gsOn && gsCfg.url) {
      fetchAttendanceData(true);
    }
  }, [isAuthenticated, gsCfg, gsOn]);

  // Force Auto-Sync ON logic replacement
  // toggleGsSync removed, gsLoad called on mount if configured.

  async function gsPush() {
    try {
      // 1) 로컬 blob:/data: 영수증을 드라이브에 업로드 → 영구 URL로 치환
      let finalExpenses = expenses;
      if (gsOn && gsCfg.url) {
        const next = [];
        let hasUpdates = false;

        for (const e of expenses) {
          if (typeof e.receiptUrl === 'string' && e.receiptUrl) {
            const parts = e.receiptUrl.split('|');
            const converted = [];
            let changed = false;
            for (const part of parts) {
              if (part.startsWith("blob:") || part.startsWith("data:")) {
                try {
                  const conv = part.startsWith("data:") ? { dataUrl: part, mime: "image/jpeg" } : await urlToDataUrl(part);
                  const safeDesc = e.description ? e.description.replace(/[^\w가-힣_.-]/g, "_") : "receipt";
                  const formattedAmount = parseAmount(e.amount).toLocaleString('ko-KR');
                  const serial = serialMap[e.id] || "No";
                  const filename = `${serial}_${safeDesc}_${e.date}_${e.category}_${formattedAmount}원_${e.purchaser || "미지정"}.jpg`;
                  const up = await gsFetch(gsCfg, "uploadReceipt", { filename, mimeType: "image/jpeg", dataUrl: conv.dataUrl });
                  const viewUrl = up.viewUrl || (up.fileId ? `https://drive.google.com/uc?export=view&id=${up.fileId}` : "") || "";
                  if (viewUrl) { converted.push(viewUrl); changed = true; continue; }
                } catch (err) {
                  console.warn("로컬 영수증 업로드 실패, 해당 영수증 제외 후 저장 진행", err);
                }
                // Drive 업로드 실패 시: data:/blob: URL은 시트에 저장 불가 (50,000자 초과) → 빈 문자열로 대체
                changed = true;
                continue;
              }
              converted.push(part);
            }
            if (changed) {
              next.push({ ...e, receiptUrl: converted.join('|') });
              hasUpdates = true;
              continue;
            }
          }
          next.push(e);
        }

        // 화면 상태도 최신 링크로 동기화 (저장 루프 방지를 위해 플래그 사용)
        if (hasUpdates) {
          gsSyncRef.current = true;
          setExpenses(next);
          finalExpenses = next;
        }
      }

      // 2) 최종 저장 (data:/blob: URL은 셀 한도 초과 → 제거 후 저장)
      const safeExpenses = finalExpenses.map(e => ({
        ...e,
        receiptUrl: (e.receiptUrl || '').split('|').filter(u => !u.startsWith('data:') && !u.startsWith('blob:')).join('|')
      }));
      await gsFetch(gsCfg, "save", { expenses: safeExpenses });
      alert("시트에 저장 완료");
    } catch (e) {
      alert("시트 저장 실패: " + e.message);
    }
  }

  async function handleSaveFellowship() {
    try {
      if (!gsCfg.url) return;
      setIsSyncing(true);
      await gsFetch(gsCfg, "saveFellowship", { fellowship: fellowshipData });
      alert("친목회 장부가 시트에 저장되었습니다.");
    } catch (e) {
      alert("친목회 시트 저장 실패: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  }

  // --- Sub-Components passed with props for budget ---
  const dashboardProps = {
    totalSpent,
    categorySummary,
    onNavigate: handleNavigate,
    budget // Pass fetched budget
  };

  const byCategoryProps = {
    categorySummary,
    expenses,
    onDelete: deleteExpense,
    onEdit: startEdit,
    onCopy: copyExpense,
    filterCat,
    setFilterCat: handleNavigate,
    highlightId,
    onToggleReimbursed: handleToggleReimbursed,
    onViewReceipt: handleJumpToReceipt,
    budget, // Pass fetched budget
    categoryOrder
  };

  const analysisProps = {
    expenses,
    onJumpToExpense: handleJumpToExpense,
    categoryOrder // Pass category order if needed
  };


  const expenseInputSection = (
    <section className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-semibold">지출 입력</h2>
      </div>
      <form onSubmit={addExpense} className="flex flex-col gap-4">
        {/* Top Row: Core Info - Strictly Horizontal */}
        {/* Top Row: Core Info - Responsive Grid/Flex */}
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-nowrap md:gap-2 md:items-end">
          <div className="col-span-2 md:flex-1 md:min-w-[180px]">
            <label className="text-sm font-medium text-gray-500 mb-1 block">내역</label>
            <div className="relative">
              <input
                type="text"
                value={form.description}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm({ ...form, description: val });

                  if (val.length < 1) {
                    setRecommendedList([]);
                    return;
                  }

                  // New Keyword-Based Logic with Bidirectional Matching
                  // 1. Context Spotting: User sentence contains keyword (e.g. "간식 샀음" -> "간식")
                  // 2. Autocomplete: Keyword contains user input (e.g. "모임" -> "준비모임")
                  // 3. Description Search: Standard Description contains user input (e.g. "식대" -> "회의 식대")
                  const matched = recommendations.filter(r => {
                    const v = val.trim();
                    if (!v) return false;
                    const keyword = r.keyword.toString();
                    const desc = r.standardDesc.toString();

                    return (
                      keyword.includes(v) || // Autocomplete (Input is substring of Keyword)
                      v.includes(keyword) || // Context Spotting (Keyword is substring of Input)
                      desc.includes(v)       // Description Search (Input is substring of Description)
                    );
                  });

                  // Deduplicate by standardDesc to avoid showing same thing multiple times
                  const uniqueMatches = [];
                  const seen = new Set();
                  matched.forEach(m => {
                    if (!seen.has(m.standardDesc)) {
                      uniqueMatches.push(m);
                      seen.add(m.standardDesc);
                    }
                  });

                  if (uniqueMatches.length > 0 && !stopRecommending) {
                    setRecommendedList(uniqueMatches.slice(0, 7)); // Show top 7
                  } else {
                    setRecommendedList([]);
                  }
                }}
                onFocus={() => {
                  // Trigger search again on focus if text exists
                  if (form.description && !stopRecommending) {
                    const val = form.description;
                    const matched = recommendations.filter(r => {
                      const v = val.trim();
                      if (!v) return false;
                      const keyword = r.keyword.toString();
                      const desc = r.standardDesc.toString();
                      return (keyword.includes(v) || v.includes(keyword) || desc.includes(v));
                    });
                    const uniqueMatches = [];
                    const seen = new Set();
                    matched.forEach(m => {
                      if (!seen.has(m.standardDesc)) {
                        uniqueMatches.push(m);
                        seen.add(m.standardDesc);
                      }
                    });
                    if (uniqueMatches.length > 0) setRecommendedList(uniqueMatches.slice(0, 7)); // Increased limit slightly
                  }
                }}
                onBlur={() => {
                  // Delay hiding to allow click
                  setTimeout(() => setRecommendedList([]), 200);
                }}
                placeholder="내용을 입력하세요"
                className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base"
              />
              {/* Google Search Style Dropdown */}
              {recommendedList.length > 0 && (
                <ul className="absolute top-full left-0 w-full bg-white shadow-xl border border-gray-100 rounded-xl z-50 overflow-hidden mt-1 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-1">
                  {recommendedList.map((item, idx) => (
                    <li
                      key={idx}
                      className="border-b last:border-b-0 hover:bg-blue-50 p-3 cursor-pointer flex justify-between items-center transition-colors group"
                      onClick={() => {
                        setForm({ ...form, description: item.standardDesc, category: item.category });
                        setStopRecommending(true);
                        setRecommendedList([]);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">🔍</span>
                        <span className="font-medium text-gray-700 group-hover:text-blue-700">{item.standardDesc}</span>
                      </div>
                      <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md font-medium">
                        {item.category}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="col-span-1 md:w-36 md:shrink-0">
            <label className="text-sm font-medium text-gray-500 mb-1 block">날짜</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base" />
          </div>
          <div className="col-span-1 md:w-28 md:shrink-0 relative">
            <label className="text-sm font-medium text-gray-500 mb-1 block">세세목</label>
            <div className="flex flex-col">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base">
                {CATEGORY_ORDER.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile: Amount & Purchaser in one row */}
          <div className="col-span-2 flex gap-2 md:contents">
            <div className="flex-1 md:w-32 md:shrink-0 md:flex-none">
              <label className="text-sm font-medium text-gray-500 mb-1 block">금액(원)</label>
              <input type="text" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors font-medium text-right text-base" />
            </div>


            <div className="flex-1 md:w-24 md:shrink-0 md:flex-none relative">
              <label className="text-sm font-medium text-gray-500 mb-1 block">
                구매자 <span className="text-xs text-gray-400 font-normal">({purchaserOptions.length})</span>
              </label>
              <input
                type="text"
                value={form.purchaser}
                onChange={(e) => setForm({ ...form, purchaser: e.target.value })}
                onFocus={() => setShowPurchaserSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPurchaserSuggestions(false), 200)}
                placeholder="이름"
                className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base"
                autoComplete="off"
              />
              {showPurchaserSuggestions && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {purchaserOptions.length > 0 ? (
                    purchaserOptions.map((name, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer text-gray-700"
                        onClick={() => setForm(prev => ({ ...prev, purchaser: name }))}
                      >
                        {name}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-400 cursor-default">
                      목록 없음 (0건) <br />
                      <span className="text-xs text-red-400">* 스크립트 업데이트 확인</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Bottom Row: Receipt & Buttons */}
        {(() => {
          const receiptUrls = form.receiptUrl ? form.receiptUrl.split('|').filter(Boolean) : [];
          const removeReceipt = (idx) => {
            const next = receiptUrls.filter((_, i) => i !== idx);
            setForm((f) => ({ ...f, receiptUrl: next.join('|') }));
          };
          return (
        <div className="flex flex-wrap md:flex-nowrap gap-3 items-start">
          <div className="flex-1 flex flex-col gap-2">
            {/* 썸네일 그리드 */}
            {receiptUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {receiptUrls.map((url, idx) => {
                  const thumb = url.includes("drive.google.com") && url.includes("id=")
                    ? `https://drive.google.com/thumbnail?id=${new URL(url).searchParams.get("id")}&sz=w200`
                    : url;
                  return (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                      <img src={thumb} alt={`증빙${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeReceipt(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                      >×</button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* 업로드 버튼 */}
            <div className="flex items-center gap-2">
              <label className={`shrink-0 px-2 py-2 rounded-xl border border-gray-200 text-base cursor-pointer flex items-center gap-2 transition-colors ${(isUploading || receiptUrls.length >= 5) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                <span>{isUploading ? "업로드 중..." : `증빙 추가 (${receiptUrls.length}/5)`}</span>
                <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" disabled={isUploading || receiptUrls.length >= 5} />
              </label>
            </div>
          </div>


          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="px-3 py-2 rounded-xl bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors text-base" onClick={() => {
              setForm({ date: "", category: CATEGORY_ORDER[0], description: "", amount: "", purchaser: "", receiptUrl: "" });
              setEditingId(null);
              setStopRecommending(false);
            }}>
              <RefreshCcw size={18} /> {editingId ? "취소" : "초기화"}
            </button>
            <button type="submit" disabled={isUploading} className={`px-4 py-2 rounded-xl text-white flex items-center gap-2 shadow-sm transition-colors font-semibold text-base ${isUploading ? "bg-gray-400 cursor-not-allowed" : (editingId ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-blue-600 hover:bg-blue-700 shadow-blue-200")}`}>
              {editingId ? <Save size={20} /> : <Plus size={20} />} {editingId ? "저장" : "추가"}
            </button>
          </div>
        </div>
          );
        })()}
      </form>

      {/* 2026 Budget Guide - Collapsible Hybrid Section */}
      <div className="mt-6 border-t pt-4">
        <button
          type="button"
          onClick={() => setShowBudgetGuide(!showBudgetGuide)}
          className="flex items-center gap-2 text-base font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <FileText size={20} />
          <span>2026년 예산서 지침 {showBudgetGuide ? "접기" : "보기"}</span>
          {showBudgetGuide ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showBudgetGuide && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2">
            {CATEGORY_ORDER.map((cat) => {
              const guide = budgetGuide[cat];
              const isActive = form.category === cat;
              if (!guide) return null;

              return (
                <div
                  key={cat}
                  className={`p-3 rounded-xl border transition-all duration-300 ${isActive
                    ? "bg-blue-50 border-blue-400 shadow-md ring-2 ring-blue-100"
                    : "bg-gray-50 border-gray-100 opacity-80"
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-bold text-base ${isActive ? "text-blue-700" : "text-gray-700"}`}>
                      {cat}
                    </h3>
                    {isActive && (
                      <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-md animate-pulse">
                        선택됨
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-sm leading-relaxed text-gray-600">
                      <p className="font-semibold text-gray-500 mb-0.5">[지출 내용]</p>
                      {guide.descriptions.map((desc, i) => (
                        <p key={i} className="pl-1 border-l border-gray-200">{boldAmounts(desc)}</p>
                      ))}
                    </div>

                    {guide.notes && guide.notes.length > 0 && (
                      <div className="text-xs leading-relaxed text-amber-700 bg-amber-50/50 p-1.5 rounded-lg border border-amber-100/50 mt-2">
                        <p className="font-bold mb-0.5">⚠️ 특이사항</p>
                        {guide.notes.map((note, i) => (
                          <p key={i}>{boldAmounts(note)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section >
  );

  const TABS = ['dashboard', 'bycat', 'analysis', 'receipts', 'reimburse'];


  if (!isAuthenticated) {
    return (
      <>
        <Login onLogin={handleLogin} loading={isAuthLoading} />
        <div className="fixed bottom-4 right-4 text-xs text-gray-300">
          {!gsCfg.url && "⚠️ 시트 연결 필요"}
        </div>
      </>
    );
  }

  return (

    <div className="min-h-screen bg-gray-50 text-gray-900">
      <style>{`
        input, button, select { min-height:44px; }
        th, td { vertical-align: middle; }
        .sticky-cards { position: sticky; top: 64px; z-index: 10; background: white; padding-top: 8px; }
      `}</style>

      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div onClick={() => setTab("dashboard")} className="cursor-pointer">
            <h1 className="text-2xl font-bold">유치부 예산관리</h1>
            <div className="text-base text-gray-600 mt-1">
              <span className="block sm:inline">{budget.year} 회계 | 총 예산 {formatKRW(budget.total)}</span>
              <span className="hidden sm:inline"> | </span>
              <span className="block sm:inline">현재 지출 {formatKRW(totalSpent)} | 잔액 <span className={budget.total - totalSpent < 0 ? "text-red-600 font-bold" : ""}>{formatKRW(budget.total - totalSpent)}</span></span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-3 rounded-xl border bg-white hover:bg-gray-50 text-gray-600" onClick={() => setShowConfig(prev => !prev)}>
              <Settings size={20} className={isSyncing ? "animate-spin text-blue-600" : ""} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Firebase 동기화 */}
        {/* Firebase Section Removed */}

        {/* Google Apps Script (Drive/Sheets) 동기화 */}
        {showConfig && (
          <section className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-top-2 space-y-6">

            {/* Google Sync Settings (Inputs Hidden for Auto-Config) */}
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  구글 연동 설정
                  {isSyncing && <span className="text-xs font-normal text-blue-600 animate-pulse">Running...</span>}
                  <span className="text-xs font-normal text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200 ml-2">
                    ✅ 연결됨 (자동설정)
                  </span>
                </h2>
                <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap">
                  <a
                    href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=0#gid=0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                  >
                    <Table2 size={14} className="text-green-600" /> 지출내역 시트
                  </a>
                  <a
                    href="https://drive.google.com/drive/folders/1q8JWztUpkulaJQWGBXYhaOQ9sWMNh9b7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                  >
                    <Folder size={14} className="text-blue-600" /> 영수증 드라이브
                  </a>
                  <a
                    href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=1598655081#gid=1598655081"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                  >
                    <Table2 size={14} className="text-green-600" /> 명단 시트
                  </a>
                  <a
                    href="https://drive.google.com/drive/folders/1gmhV08lX3V2I0PgO2fNKCiWc3x8nasQn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors"
                  >
                    <Folder size={14} className="text-blue-600" /> 학생사진 드라이브
                  </a>
                  <span className="px-2 py-1 rounded border text-xs bg-green-600 text-white border-green-600 font-bold ml-1">자동동기화 ON</span>
                </div>
              </div>
              {/* 
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-4 flex items-center gap-2">
                  <LinkIcon size={16} className="text-gray-400" />
                  <input className="flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="Apps Script Web App URL" value={gsCfg.url} onChange={(e) => setGsCfg(v => ({ ...v, url: e.target.value }))} />
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <KeyRound size={16} className="text-gray-400" />
                  <input className="flex-1 rounded-xl border px-3 py-2 text-sm" placeholder="보안 토큰" value={gsCfg.token} onChange={(e) => setGsCfg(v => ({ ...v, token: e.target.value }))} />
                </div>
              </div> 
              */}
            </div>

            {/* imgbb API 키 설정 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Upload size={14} className="text-orange-500" /> 영수증 이미지 호스팅 (imgbb)
              </h3>
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-gray-400 shrink-0" />
                <input
                  className="flex-1 rounded-xl border px-3 py-2 text-sm"
                  placeholder="imgbb API 키 (api.imgbb.com에서 발급)"
                  value={imgbbKey}
                  onChange={(e) => {
                    setImgbbKey(e.target.value);
                    try { localStorage.setItem(IMGBB_META, e.target.value); } catch {}
                  }}
                />
                {imgbbKey && <span className="text-xs text-green-600 font-medium shrink-0">✅ 설정됨</span>}
              </div>
            </div>

          </section>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LineChart}>총괄</TabButton>
          {authRole === "full" && (
            <>
              <TabButton active={tab === "bycat"} onClick={() => setTab("bycat")} icon={Table2}>지출</TabButton>
              <TabButton active={tab === "receipts"} onClick={() => setTab("receipts")} icon={GalleryHorizontalEnd}>증빙</TabButton>
              <TabButton active={tab === "analysis"} onClick={() => setTab("analysis")} icon={HeartHandshake}>친목</TabButton>
              <TabButton active={tab === "reimburse"} onClick={() => setTab("reimburse")} icon={CheckSquare}>웹</TabButton>
            </>
          )}
          <TabButton active={tab === "attendance"} onClick={() => setTab("attendance")} icon={Users}>출결</TabButton>
        </div>

        {tab === "bycat" && expenseInputSection}

        {tab === "dashboard" && (
          <div className="space-y-8">
            <Dashboard {...dashboardProps} expenses={expenses} onViewReceipt={handleJumpToReceipt} />
          </div>
        )}
        {tab === "bycat" && (
          <ByCategory {...byCategoryProps} />
        )}
        {tab === "analysis" && (
          <Analysis
            {...analysisProps}
            fellowshipData={fellowshipData}
            setFellowshipData={setFellowshipData}
            gsCfg={gsCfg}
            highlightId={highlightId}
            onSaveFellowship={handleSaveFellowship}
          />
        )}
        {tab === "receipts" && (
          <ReceiptsGallery
            expenses={expenses}
            onDelete={deleteExpense}
            onJumpToExpense={handleJumpToExpense}
            highlightId={highlightId}
          />
        )}
        {tab === "reimburse" && (
          <Reimbursements expenses={expenses} setExpenses={setExpenses} />
        )}
        {tab === "attendance" && (
          <Attendance
            gsCfg={gsCfg}
            onJumpToTab={(t) => setTab(t)}
            initialMembers={attendanceState.members}
            initialAttendanceData={attendanceState.attendanceData}
            onRefreshAttendance={() => fetchAttendanceData(false)}
            onAttendanceUpdate={(updates) => setAttendanceState(prev => ({ ...prev, ...updates }))}
          />
        )}


        <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

        <footer className="mt-12 text-center text-xs text-gray-500">© {new Date().getFullYear()} 유치부 예산관리 — 로컬 저장 + (옵션) Firebase/Apps Script 동기화. 가능 환경에서 PWA 지원.</footer>
      </main>
    </div>
  );
}
