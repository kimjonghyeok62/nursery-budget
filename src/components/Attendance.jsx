import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Users, UserPlus, CheckCircle, CheckSquare, Image as ImageIcon, Search,
    ChevronDown, ChevronUp, Edit2, Trash2, Camera, RefreshCw,
    ExternalLink, ArrowRight, ArrowLeft, Calendar, Plus, Upload, Save, Table2, Folder
} from 'lucide-react';
import { gsFetch, fetchSheetData } from '../utils/google';
import { formatKRW, parseAmount } from '../utils/format';
import { compressImage } from '../utils/dataUrl';
import Card from './Card';
import { useLocalStorageState } from '../hooks/useLocalStorageState';

import {
    SHEET_ID,
    ATTENDANCE_SHEET_GID,
    MEMBERS_SHEET_INDEX,
    MEMORY_VERSES_GID,
    PRAYER_ORDER_GID,
    OFFERING_ORDER_GID,
    CLEANING_ORDER_GID
} from '../constants';

const MEMBERS_SHEET_GID = "1598655081";

// 2026 Sunday Dates for mapping
const SUNDAY_DATES = {
    1: [4, 11, 18, 25],
    2: [1, 8, 15, 22],
    3: [1, 8, 15, 22, 29],
    4: [5, 12, 19, 26],
    5: [3, 10, 17, 24, 31],
    6: [7, 14, 21, 28],
    7: [5, 12, 19, 26],
    8: [2, 9, 16, 23, 30],
    9: [6, 13, 20, 27],
    10: [4, 11, 18, 25],
    11: [1, 8, 15, 22, 29],
    12: [6, 13, 20, 27]
};

export default function Attendance({ gsCfg, onJumpToTab, initialMembers = [], initialAttendanceData = { headers: [], records: [] }, onRefreshAttendance, onAttendanceUpdate }) {
    const [members, setMembers] = useState(initialMembers);
    const [attendanceData, setAttendanceData] = useState(initialAttendanceData);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const memberFormRef = useRef(null);

    // Refs for header-body scroll sync
    const attendanceHeaderRef = useRef(null);
    const attendanceBodyRef = useRef(null);
    const studentListHeaderRef = useRef(null);
    const studentListBodyRef = useRef(null);
    const teacherListHeaderRef = useRef(null);
    const teacherListBodyRef = useRef(null);

    useEffect(() => {
        if (initialMembers && initialMembers.length > 0) {
            // Ensure every member has an ID to prevent editing issues (especially for manually added rows in Sheets)
            let needsUpdate = false;
            const processed = initialMembers.map(m => {
                if (!m.id) {
                    needsUpdate = true;
                    return { ...m, id: crypto.randomUUID() };
                }
                return m;
            });

            setMembers(processed);

            if (needsUpdate) {
                console.log("Attendance: Assigning missing IDs to members");
                onAttendanceUpdate?.({ members: processed });
                // Optional: Sync back to Google immediately to persist these IDs
                gsFetch(gsCfg, 'saveMembers', { members: processed }).catch(console.error);
            }
        }
    }, [initialMembers]);

    useEffect(() => {
        setAttendanceData(initialAttendanceData);
    }, [initialAttendanceData]);

    const [memberType, setMemberType] = useState('학생');
    const [memberForm, setMemberForm] = useState({
        id: '', name: '', age: '', position: '', group: '', teacher: '',
        assignedStudents: '', prayer: '',
        birthDate: '',
        regDate: new Date().toISOString().split('T')[0],
        leaveDate: '',
        photoUrl: '', photoDriveId: '', s1: '', s2: '', s3: ''
    });
    const [isUploading, setIsUploading] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState(null);

    // Google Sheets 데이터 state
    const [memoryVerses, setMemoryVerses] = useState({});
    const [prayerSchedule, setPrayerSchedule] = useState({});
    const [offeringSchedule, setOfferingSchedule] = useState({});
    const [cleaningSchedule, setCleaningSchedule] = useState({});

    // Google Sheets 데이터 불러오기
    useEffect(() => {
        const loadDutyData = async () => {
            try {
                // 암송말씀 데이터
                const memoryData = await fetchSheetData(SHEET_ID, MEMORY_VERSES_GID);
                const memoryObj = {};
                memoryData.slice(1).forEach(row => {
                    const month = row[0]?.replace('월', '').trim();
                    if (month) {
                        const verses = [row[1], row[2]].filter(v => v && v.trim());
                        memoryObj[month] = verses;
                    }
                });
                setMemoryVerses(memoryObj);

                // 기도 데이터
                const prayerData = await fetchSheetData(SHEET_ID, PRAYER_ORDER_GID);
                const prayerObj = {};
                prayerData.slice(1).forEach(row => {
                    if (row[0] && row[1]) {
                        prayerObj[row[0]] = row[1];
                    }
                });
                setPrayerSchedule(prayerObj);

                // 헌금 데이터
                const offeringData = await fetchSheetData(SHEET_ID, OFFERING_ORDER_GID);
                const offeringObj = {};
                offeringData.slice(1).forEach(row => {
                    if (row[0] && row[1]) {
                        offeringObj[row[0]] = row[1];
                    }
                });
                setOfferingSchedule(offeringObj);

                // 청소 데이터
                const cleaningData = await fetchSheetData(SHEET_ID, CLEANING_ORDER_GID);
                const cleaningObj = {};
                cleaningData.slice(1).forEach(row => {
                    if (row[0]) {
                        const pair = [row[1], row[2]].filter(v => v && v.trim());
                        cleaningObj[row[0]] = pair;
                    }
                });
                setCleaningSchedule(cleaningObj);

            } catch (error) {
                console.error('출석 관련 데이터 로딩 실패:', error);
            }
        };

        loadDutyData();
    }, []);

    const today = new Date();
    const [selectedYear, setSelectedYear] = useState(2026);
    const [monthRange, setMonthRange] = useState(() => {
        const currentYear = today.getFullYear();
        // If current year is before 2026 (target), default to 1-2월
        if (currentYear < 2026) return [1, 2];
        // If current year is after 2026, default to 11-12월
        if (currentYear > 2026) return [11, 12];

        // Standard logic for 2026
        const m = today.getMonth() + 1;
        if (m <= 2) return [1, 2];
        if (m <= 4) return [3, 4];
        if (m <= 6) return [5, 6];
        if (m <= 8) return [7, 8];
        if (m <= 10) return [9, 10];
        return [11, 12];
    });

    const monthRangeOptions = [
        { label: "1-2월", months: [1, 2] },
        { label: "3-4월", months: [3, 4] },
        { label: "5-6월", months: [5, 6] },
        { label: "7-8월", months: [7, 8] },
        { label: "9-10월", months: [9, 10] },
        { label: "11-12월", months: [11, 12] },
    ];

    const getMonthWeeks = (month) => {
        const monthDates = SUNDAY_DATES[month] || [];
        return monthDates.map((d, i) => ({
            label: `${month}월 ${i + 1}주차`,
            date: `(${month}월 ${d}일)`,
            fullDate: new Date(2026, month - 1, d)
        }));
    };

    const isMemberActiveAt = useCallback((member, dateObj) => {
        if (!dateObj) return true;

        // Convert Date object to YYYYMMDD integer
        const getVal = (d) => {
            if (!d) return null;
            const dt = (typeof d === 'string') ? new Date(d) : d;
            if (isNaN(dt.getTime())) return null;
            return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
        };

        const checkVal = getVal(dateObj);
        if (!checkVal) return true;

        // regDate check
        if (member.regDate) {
            const regVal = getVal(member.regDate);
            if (regVal && checkVal < regVal) return false;
        }

        // leaveDate check
        if (member.leaveDate) {
            const leaveVal = getVal(member.leaveDate);
            if (leaveVal && checkVal > leaveVal) return false;
        }

        return true;
    }, []);

    const currentMonthRangeHeaders = useMemo(() => {
        const headers = [];
        monthRange.forEach(m => {
            headers.push(...getMonthWeeks(m));
        });
        return headers;
    }, [monthRange]);

    const [sortKey, setSortKey] = useState('serial');
    const [sortOrder, setSortOrder] = useState('asc');
    const [expandedPrayerId, setExpandedPrayerId] = useState(null);
    const isFirstRender = useRef(true);
    const latestAttendanceDataRef = useRef(attendanceData);

    useEffect(() => {
        latestAttendanceDataRef.current = attendanceData;
    }, [attendanceData]);

    const highlightAndScroll = (id) => {
        const element = document.getElementById(id);
        if (!element) return;

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remove existing highlight if any to restart animation
        element.style.backgroundColor = '';
        element.style.transition = 'none';

        // Force reflow
        void element.offsetWidth;

        // Apply pale yellow background for 5 seconds
        element.style.transition = 'background-color 0.5s ease-in-out';
        element.style.backgroundColor = '#fef9c3'; // yellow-100

        setTimeout(() => {
            element.style.backgroundColor = '';
        }, 5000);
    };

    // Scroll synchronization handlers
    const handleAttendanceScroll = (e) => {
        if (attendanceHeaderRef.current) {
            attendanceHeaderRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const handleStudentListScroll = (e) => {
        if (studentListHeaderRef.current) {
            studentListHeaderRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const handleTeacherListScroll = (e) => {
        if (teacherListHeaderRef.current) {
            teacherListHeaderRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    useEffect(() => {
        if (initialMembers.length === 0 && isFirstRender.current) {
            onRefreshAttendance?.();
        }
        isFirstRender.current = false;
    }, [initialMembers, onRefreshAttendance]);

    const handleMemberSubmit = async (e) => {
        e.preventDefault();
        if (!memberForm.name) return alert("이름을 입력해주세요.");

        const isEditing = editingMemberId !== null;
        // const newMember = { // This is implicitly handled by memberForm in the new logic
        //     ...memberForm,
        //     id: editingMemberId || crypto.randomUUID(),
        //     type: memberType
        // };

        // 자동 매핑 로직 (반 기준으로 선생님-학생 연결)
        const applyAutoMapping = (list) => {
            return list.map(m => {
                if (m.type === '학생') {
                    const matchedTeacher = list.find(t => t.type === '선생님' && t.group === m.group);
                    return { ...m, teacher: matchedTeacher ? matchedTeacher.name : "" };
                } else if (m.type === '선생님') {
                    const matchedStudents = list
                        .filter(s => s.type === '학생' && s.group === m.group)
                        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                        .map(s => s.name);
                    return { ...m, assignedStudents: matchedStudents.join(', ') };
                }
                return m;
            });
        };

        const updatedMembersRaw = isEditing
            ? members.map(m => String(m.id) === String(editingMemberId) ? { ...m, ...memberForm } : m)
            : [...members, { ...memberForm, id: crypto.randomUUID(), type: memberType }];

        const updatedMembers = applyAutoMapping(updatedMembersRaw);

        setMembers(updatedMembers);
        onAttendanceUpdate?.({ members: updatedMembers });
        resetMemberForm();
        setEditingMemberId(null);

        if (isEditing) {
            alert("수정하였습니다.");
        } else {
            alert("추가되었습니다.");
        }

        // Sync to Google
        try {
            await gsFetch(gsCfg, 'saveMembers', { members: updatedMembers });
            // CRITICAL: After saving members, trigger Attendance sheet sync too to include new member rows
            await saveAttendance(true, null, updatedMembers);
        } catch (err) {
            console.error("Save failed", err);
            alert("서버 저장 실패: " + err.message);
        }
    };

    const resetMemberForm = () => {
        setMemberForm({
            id: '', name: '', age: '', position: '', group: '', teacher: '',
            assignedStudents: '', prayer: '',
            birthDate: '',
            regDate: new Date().toISOString().split('T')[0],
            leaveDate: '',
            photoUrl: '', photoDriveId: '', s1: '', s2: '', s3: ''
        });
    };

    const handleEditMember = (m) => {
        setMemberType(m.type);
        setMemberForm(m);
        setEditingMemberId(m.id);

        // 특정 폼 위치로 스크롤
        if (memberFormRef.current) {
            memberFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    const handleDeleteMember = async (id) => {
        if (!confirm("정말로 삭제하시겠습니까? 지금 삭제하면 영구적으로 삭제됩니다.")) return;
        const listAfterDelete = members.filter(m => m.id !== id);

        // 삭제 후에도 매핑 정보 갱신 (선생님이 삭제되었거나 학생이 삭제되었을 때 대응)
        const applyAutoMapping = (list) => {
            return list.map(m => {
                if (m.type === '학생') {
                    const matchedTeacher = list.find(t => t.type === '선생님' && t.group === m.group);
                    return { ...m, teacher: matchedTeacher ? matchedTeacher.name : "" };
                } else if (m.type === '선생님') {
                    const matchedStudents = list
                        .filter(s => s.type === '학생' && s.group === m.group)
                        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                        .map(s => s.name);
                    return { ...m, assignedStudents: matchedStudents.join(', ') };
                }
                return m;
            });
        };

        const updated = applyAutoMapping(listAfterDelete);
        setMembers(updated);
        onAttendanceUpdate?.({ members: updated });
        try {
            await gsFetch(gsCfg, 'saveMembers', { members: updated });
            await saveAttendance(true, null, updated);
        } catch (e) {
            alert("서버 삭제 실패: " + e.message);
        }
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const filename = `member_${memberForm.name || 'temp'}_${Date.now()}.jpg`;
            const res = await gsFetch(gsCfg, 'uploadMemberPhoto', {
                filename, mimeType: 'image/jpeg', dataUrl: compressed.dataUrl
            });
            if (res.viewUrl) {
                setMemberForm(prev => ({ ...prev, photoUrl: res.viewUrl, photoDriveId: res.fileId }));
            }
        } catch (err) {
            alert("업로드 실패: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };



    const getInactiveLabel = (member) => {
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        const reg = member.regDate ? new Date(member.regDate) : null;
        const leave = member.leaveDate ? new Date(member.leaveDate) : null;

        if (reg) {
            reg.setHours(0, 0, 0, 0);
            if (t < reg) return "(등록전)";
        }
        if (leave) {
            leave.setHours(0, 0, 0, 0);
            if (t > leave) return "(전출)";
        }
        return "";
    };

    const isWeekLocked = (weekHeader, records = attendanceData.records) => {
        const lockRecord = records.find(r => r.memberId === 'SYSTEM_LOCK' || r["이름"] === '마감');
        return lockRecord && (lockRecord[weekHeader] === 'LOCKED' || lockRecord[weekHeader] === true);
    };

    const handleToggleLock = async (weekHeader) => {
        const currentlyLocked = isWeekLocked(weekHeader);
        if (currentlyLocked && !confirm("정말 마감을 해제하시겠습니까?")) return;

        const nextRecords = [...attendanceData.records];
        let lockIdx = nextRecords.findIndex(r => r.memberId === 'SYSTEM_LOCK' || r["이름"] === '마감');

        const newVal = currentlyLocked ? 'UNLOCKED' : 'LOCKED';

        if (lockIdx !== -1) {
            nextRecords[lockIdx] = { ...nextRecords[lockIdx], memberId: 'SYSTEM_LOCK', "이름": "마감", type: "SYSTEM", [weekHeader]: newVal };
        } else {
            nextRecords.push({ memberId: 'SYSTEM_LOCK', "이름": "마감", type: "SYSTEM", [weekHeader]: newVal });
        }

        // Update local state
        const nextData = { ...attendanceData, records: nextRecords };
        setAttendanceData(nextData);
        latestAttendanceDataRef.current = nextData;

        // Save the new lock state IMMEDIATELY using the updated records
        await saveAttendance(false, nextRecords);
    };

    const handleAttendanceChange = (m, weekHeader, checked) => {
        if (isWeekLocked(weekHeader)) {
            alert("해당 주차는 마감되어 변경할 수 없습니다.");
            return;
        }
        const val = checked ? "O" : "X";
        const nextRecords = attendanceData.records.map(r => {
            // Match by memberId primarily, fallback to Name+Type
            if ((r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type)) {
                return { ...r, memberId: m.id, type: m.type, [weekHeader]: val };
            }
            return r;
        });

        if (!nextRecords.find(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type))) {
            nextRecords.push({ "이름": m.name, type: m.type, memberId: m.id, [weekHeader]: val });
        }

        const nextData = { ...attendanceData, records: nextRecords };
        setAttendanceData(nextData);
        latestAttendanceDataRef.current = nextData;
        // saveAttendance(true, nextRecords); // Auto-save disabled per user request
    };

    const handleBulkSelect = (weekHeader) => {
        if (isWeekLocked(weekHeader)) {
            alert("해당 주차는 마감되어 변경할 수 없습니다.");
            return;
        }
        const nextRecords = [...attendanceData.records];

        // Determine if all are currently checked
        const allChecked = members.every(m => {
            const r = nextRecords.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type));
            return r && r[weekHeader] === "O";
        });

        const targetVal = allChecked ? "X" : "O";

        members.forEach(m => {
            const idx = nextRecords.findIndex(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type));
            if (idx !== -1) {
                nextRecords[idx] = { ...nextRecords[idx], [weekHeader]: targetVal };
            } else {
                nextRecords.push({ "이름": m.name, type: m.type, memberId: m.id, [weekHeader]: targetVal });
            }
        });
        const nextData = { ...attendanceData, records: nextRecords };
        setAttendanceData(nextData);
        latestAttendanceDataRef.current = nextData;
        // saveAttendance(true, nextRecords); // Auto-save disabled per user request
    };



    const saveAttendance = async (isAuto = false, overrideRecords = null, overrideMembers = null) => {
        if (isAuto) setIsSaving(true);
        else setLoading(true);

        const currentRecords = overrideRecords || attendanceData.records;
        const currentMembers = overrideMembers || members;

        try {
            // Create a lookup map for records to achieve O(N) lookup instead of O(N^2)
            const recordLookup = new Map();
            currentRecords.forEach(r => {
                if (r.memberId) recordLookup.set(r.memberId, r);
                else recordLookup.set(`${r["이름"]}_${r.type}`, r);
            });

            // Reconstruct records based on CURRENT sorted members to ensure strict sync
            const studentsForSync = currentMembers.filter(m => m.type === '학생').sort((a, b) => {
                const groupComp = (a.group || "").localeCompare(b.group || "");
                if (groupComp !== 0) return groupComp;
                return (a.name || "").localeCompare(b.name || "");
            });
            const teachersForSync = currentMembers.filter(m => m.type === '선생님').sort((a, b) => {
                const groupComp = (a.group || "").localeCompare(b.group || "");
                if (groupComp !== 0) return groupComp;
                return (a.name || "").localeCompare(b.name || "");
            });
            const allMembersForSync = [...studentsForSync, ...teachersForSync];

            const syncedRecords = allMembersForSync.map(m => {
                const existing = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                return {
                    ...existing,
                    memberId: m.id,
                    type: m.type,
                    "이름": m.name,
                    "반": m.group || "",
                    "담임선생님": m.teacher || "",
                    "생년월일": m.birthDate || "",
                    "등록일": m.regDate || "",
                    "전출일": m.leaveDate || ""
                };
            });

            // Include system lock record if exists
            const lockRecord = recordLookup.get('SYSTEM_LOCK');
            if (lockRecord) {
                syncedRecords.push(lockRecord);
            }

            // Generate ALL possible week headers for the year to ensure a stable, sorted sheet structure
            const allYearWeekObjects = [];
            for (let m = 1; m <= 12; m++) {
                allYearWeekObjects.push(...getMonthWeeks(m));
            }
            const allYearWeekHeaders = allYearWeekObjects.map(w => w.label);

            // 1. Calculate and add Stats Rows
            const getStatRecord = (id, label, typeFilter) => {
                const rec = { memberId: id, "이름": label, type: "SYSTEM" };
                const baseFiltered = typeFilter ? currentMembers.filter(m => m.type === typeFilter) : currentMembers;

                allYearWeekObjects.forEach(wObj => {
                    const h = wObj.label;
                    const checkDate = wObj.fullDate;
                    const activeMembers = baseFiltered.filter(m => isMemberActiveAt(m, checkDate));
                    const total = activeMembers.length;

                    let attendedCount = 0;
                    activeMembers.forEach(m => {
                        const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                        if (r[h] === "O") attendedCount++;
                    });
                    rec[h] = `${attendedCount} / ${total}`;
                });
                return rec;
            };

            const getAbsentRecord = (id, label, typeFilter) => {
                const rec = { memberId: id, "이름": label, type: "SYSTEM" };
                const baseFiltered = currentMembers.filter(m => m.type === typeFilter);

                allYearWeekObjects.forEach(wObj => {
                    const h = wObj.label;
                    const checkDate = wObj.fullDate;
                    // Only show absent names if the week is LOCKED
                    if (isWeekLocked(h, currentRecords)) {
                        const absentNames = [];
                        const activeMembers = baseFiltered.filter(m => isMemberActiveAt(m, checkDate));
                        activeMembers.forEach(m => {
                            const r = recordLookup.get(m.id) || recordLookup.get(`${m.name}_${m.type}`) || {};
                            if (r[h] !== "O") absentNames.push(m.name);
                        });
                        rec[h] = absentNames.join("\n");
                    } else {
                        rec[h] = "";
                    }
                });
                return rec;
            };

            const getTransferRecord = (id, label) => {
                const rec = { memberId: id, "이름": label, type: "SYSTEM" };
                allYearWeekObjects.forEach(wObj => {
                    const h = wObj.label;
                    const weekStart = wObj.fullDate;
                    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

                    const getVal = (d) => {
                        if (!d) return null;
                        const dt = (typeof d === 'string') ? new Date(d) : d;
                        return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
                    };
                    const sVal = getVal(weekStart);
                    const eVal = getVal(weekEnd);

                    const formatDateMD = (dateStr) => {
                        if (!dateStr) return "";
                        const dt = new Date(dateStr);
                        if (isNaN(dt.getTime())) return "";
                        const mm = String(dt.getMonth() + 1).padStart(2, '0');
                        const dd = String(dt.getDate()).padStart(2, '0');
                        return `${mm}-${dd}`;
                    };

                    const transfers = [];
                    currentMembers.forEach(m => {
                        const rVal = getVal(m.regDate);
                        const lVal = getVal(m.leaveDate);
                        if (rVal && rVal >= sVal && rVal <= eVal) {
                            transfers.push(`${m.name}\n(${formatDateMD(m.regDate)} 전입)`);
                        }
                        if (lVal && lVal >= sVal && lVal <= eVal) {
                            transfers.push(`${m.name}\n(${formatDateMD(m.leaveDate)} 전출)`);
                        }
                    });
                    rec[h] = transfers.join("\n\n");
                });
                return rec;
            };

            const getBirthdayRecord = (id, label) => {
                const rec = { memberId: id, "이름": label, type: "SYSTEM" };
                allYearWeekObjects.forEach(wObj => {
                    const h = wObj.label;
                    const weekStart = wObj.fullDate;
                    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

                    const birthdayPeople = currentMembers.filter(member => {
                        if (!member.birthDate) return false;
                        const bDate = new Date(member.birthDate);
                        const bMonth = bDate.getMonth();
                        const bDay = bDate.getDate();
                        const birthdayThisYear = new Date(selectedYear, bMonth, bDay);
                        return birthdayThisYear >= weekStart && birthdayThisYear <= weekEnd;
                    }).map(member => {
                        const bDate = new Date(member.birthDate);
                        const bStr = `${bDate.getMonth() + 1}월 ${bDate.getDate()}일`;
                        return `${member.name}\n(${bStr})`;
                    });
                    rec[h] = birthdayPeople.join("\n");
                });
                return rec;
            };

            syncedRecords.push(getStatRecord('SYSTEM_STAT_STUDENT', '학생 출석', '학생'));
            syncedRecords.push(getStatRecord('SYSTEM_STAT_TEACHER', '교사 출석', '선생님'));
            syncedRecords.push(getStatRecord('SYSTEM_STAT_TOTAL', '전체 출석', null));
            syncedRecords.push(getTransferRecord('SYSTEM_STAT_TRANSFER', '전입/전출'));
            syncedRecords.push(getAbsentRecord('SYSTEM_STAT_STUDENT_ABSENT', '학생 결석자', '학생'));
            syncedRecords.push(getAbsentRecord('SYSTEM_STAT_TEACHER_ABSENT', '교사 결석자', '선생님'));
            syncedRecords.push(getBirthdayRecord('SYSTEM_STAT_BIRTHDAY', '생일자'));

            const allHeaders = ["memberId", "type", "이름", "반", "담임선생님", "생년월일", "등록일", "전출일", ...allYearWeekHeaders];

            // Perform both Remote and Local Sync using the same robust record set
            await gsFetch(gsCfg, 'saveAttendance', { headers: allHeaders, records: syncedRecords });
            onAttendanceUpdate?.({ attendanceData: { headers: allHeaders, records: syncedRecords } });

            if (!isAuto) {
                alert("출석 데이터가 성공적으로 저장 및 동기화되었습니다.");
            }
        } catch (e) {
            if (!isAuto) alert("저장 실패: " + e.message);
        } finally {
            setLoading(false);
            setIsSaving(false);
        }
    };

    const sortedStudents = useMemo(() => {
        return members.filter(m => m.type === '학생').sort((a, b) => {
            const groupComp = (a.group || "").localeCompare(b.group || "");
            if (groupComp !== 0) return groupComp;
            return (a.name || "").localeCompare(b.name || "");
        });
    }, [members]);

    const sortedAttendanceMembers = useMemo(() => {
        const students = members.filter(m => m.type === '학생').sort((a, b) => {
            const groupComp = (a.group || "").localeCompare(b.group || "");
            if (groupComp !== 0) return groupComp;
            return (a.name || "").localeCompare(b.name || "");
        });
        const teachers = members.filter(m => m.type === '선생님').sort((a, b) => {
            const groupComp = (a.group || "").localeCompare(b.group || "");
            if (groupComp !== 0) return groupComp;
            return (a.name || "").localeCompare(b.name || "");
        });

        // Add groupIndex for students to alternate colors
        let currentGroup = null;
        let groupIdx = 0;
        const processedStudents = students.map(s => {
            if (s.group !== currentGroup) {
                currentGroup = s.group;
                groupIdx++;
            }
            return { ...s, groupIdx };
        });

        return [...processedStudents, ...teachers];
    }, [members]);

    return (
        <div className="space-y-8 pb-20 relative">
            {(loading || isSaving) && (
                <div className="fixed inset-0 bg-white/40 flex items-center justify-center z-[100] backdrop-blur-[1px]">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-blue-50">
                        <RefreshCw className="animate-spin text-blue-600 w-10 h-10" />
                        <div className="text-center">
                            <p className="font-bold text-gray-900 text-lg">데이터 저장 및 동기화 중...</p>
                            <p className="text-sm text-gray-500 mt-1">잠시만 기다려 주세요 (약 5초 소요)</p>
                        </div>
                    </div>
                </div>
            )}
            {loading && !isSaving && members.length === 0 && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white p-4 rounded-xl shadow-xl flex items-center gap-3">
                        <RefreshCw className="animate-spin text-blue-600" />
                        <span className="font-medium">데이터 불러오는 중...</span>
                    </div>
                </div>
            )}


            {/* 2. 출석부 */}
            <Card
                title={
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">출석부</span>
                        <a
                            href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=348133938#gid=348133938"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                        >
                            <Table2 size={14} className="text-green-600" /> 시트
                        </a>
                    </div>
                }
                right={
                    <div className="relative">
                        <select
                            value={JSON.stringify(monthRange)}
                            onChange={(e) => setMonthRange(JSON.parse(e.target.value))}
                            className="appearance-none bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
                        >
                            {monthRangeOptions.map(opt => (
                                <option key={opt.label} value={JSON.stringify(opt.months)}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                }
            >
                {/* Sticky Header Table */}
                <div ref={attendanceHeaderRef} className="sticky top-[108px] md:top-[85px] z-10 overflow-x-hidden -mx-4 px-4 scrollbar-hide">
                    <table className="w-full border-collapse table-fixed" style={{ minWidth: `${32 + 44 + 140 + (currentMonthRangeHeaders.length * 60)}px` }}>
                        <colgroup>
                            <col style={{ width: '32px' }} />
                            <col style={{ width: '44px' }} />
                            <col style={{ width: '140px' }} />
                            {currentMonthRangeHeaders.map((_, i) => <col key={i} style={{ width: '60px' }} />)}
                        </colgroup>
                        <thead>
                            <tr className="border-b-2 border-gray-200 text-gray-700 font-bold bg-gray-50 h-14">
                                <th className="py-3 px-1 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center w-[32px] whitespace-nowrap text-xs">No.</th>
                                <th className="py-3 px-1 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center w-[44px] whitespace-nowrap text-sm uppercase tracking-wider">구분</th>
                                <th className="sticky left-0 z-30 py-3 px-1 bg-gray-50 border-r border-gray-200 text-gray-500 font-normal text-center w-[140px] whitespace-nowrap text-sm uppercase tracking-wider">이름</th>
                                {currentMonthRangeHeaders.map((h, i) => (
                                    <th key={i} className="py-2 px-1 border-r border-gray-100 text-gray-500 font-normal text-center w-[60px] whitespace-nowrap text-[13px] leading-tight bg-gray-50">
                                        <div className="flex flex-col items-center">
                                            <span>{h.label}</span>
                                            <span className="text-[13px]">{h.date}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                    </table>
                </div>

                {/* Scrollable Body Table */}
                <div ref={attendanceBodyRef} className="overflow-x-auto -mx-4 px-4 scrollbar-hide" onScroll={handleAttendanceScroll}>
                    <table className="w-full border-collapse table-fixed" style={{ minWidth: `${32 + 44 + 140 + (currentMonthRangeHeaders.length * 60)}px` }}>
                        <colgroup>
                            <col style={{ width: '32px' }} />
                            <col style={{ width: '44px' }} />
                            <col style={{ width: '140px' }} />
                            {currentMonthRangeHeaders.map((_, i) => <col key={i} style={{ width: '60px' }} />)}
                        </colgroup>
                        <tbody>
                            {sortedAttendanceMembers.map((m, index) => {
                                // Match by memberId primarily, fallback to Name+Type
                                return (
                                    <tr key={m.id} id={`attendance-row-${m.id}`} className={`border-b border-gray-50 transition-all duration-300 ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-orange-50/50' : 'bg-white') : 'bg-blue-50/40'}`}>
                                        <td className={`py-1 px-1 border-r border-gray-100 text-center font-normal text-gray-400 text-[11px] whitespace-nowrap w-[32px] ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-orange-50/50' : 'bg-white') : 'bg-blue-50/40'}`}>
                                            {index + 1}
                                        </td>
                                        <td className={`py-1 px-0 border-r border-gray-100 text-center font-normal text-gray-500 text-[13px] whitespace-nowrap w-[44px] max-w-[48px] leading-none tracking-tighter ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-orange-50/50' : 'bg-white') : 'bg-blue-50/40'}`}>
                                            {m.type === '학생' ? '학생' : '교사'}
                                        </td>
                                        <td className={`sticky left-0 py-1 px-1 border-r border-gray-100 font-bold text-base whitespace-nowrap cursor-pointer hover:text-blue-600 transition-colors w-[140px] ${m.type === '학생' ? (m.groupIdx % 2 === 1 ? 'bg-[#fff7ed]' : 'bg-white') : 'bg-[#eff6ff]'} ${!isMemberActiveAt(m, today) ? 'text-gray-400 line-through decoration-2' : 'text-gray-900'}`} onClick={() => {
                                            if (m.type === '선생님') {
                                                highlightAndScroll(`list-row-teacher-${m.id}`);
                                            } else {
                                                // If student has photo, go to gallery, else go to list
                                                const targetId = m.photoUrl ? `gallery-member-${m.id}` : `list-row-${m.id}`;
                                                highlightAndScroll(targetId);
                                            }
                                        }}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-lg">{m.name}</span>
                                                <div className="flex items-center gap-1 text-[13px] text-gray-500 font-medium mt-0.5 whitespace-nowrap">
                                                    <span>{m.group && m.group.length > 10 && m.group.includes('T') ? "반미정" : m.group}</span>
                                                    {m.teacher && <span>({m.teacher})</span>}
                                                </div>
                                            </div>
                                        </td>
                                        {(() => {
                                            const record = attendanceData.records.find(r => (r.memberId && r.memberId === m.id) || (r["이름"] === m.name && r.type === m.type)) || {};
                                            return currentMonthRangeHeaders.map((h, i) => {
                                                const isActive = isMemberActiveAt(m, h.fullDate);
                                                const locked = isWeekLocked(h.label);
                                                return (
                                                    <td key={i} className={`py-1 px-0.5 border-r border-gray-100 text-center w-[60px] ${!isActive ? 'bg-gray-100/50' : ''}`}>
                                                        <div
                                                            onClick={() => isActive && !locked && handleAttendanceChange(m, h.label, record[h.label] !== "O")}
                                                            className={`w-7 h-7 mx-auto rounded-md flex items-center justify-center transition-all ${!isActive
                                                                ? "bg-gray-200 text-transparent cursor-not-allowed"
                                                                : locked
                                                                    ? (record[h.label] === "O" ? "bg-blue-300 text-white cursor-not-allowed" : "bg-gray-50 border border-gray-100 text-transparent cursor-not-allowed")
                                                                    : (record[h.label] === "O" ? 'bg-blue-600 text-white shadow-sm cursor-pointer' : 'bg-gray-50 border border-gray-100 text-transparent cursor-pointer hover:border-blue-200')
                                                                }`}
                                                        >
                                                            <CheckSquare size={16} strokeWidth={2.5} />
                                                        </div>
                                                    </td>
                                                );
                                            });
                                        })()}
                                    </tr>
                                );
                            })}

                            {/* 전체체크 행 추가 */}
                            <tr className="border-t border-gray-100 bg-gray-50/30">
                                <td className="py-0 px-1 bg-gray-50/30 border-r border-gray-100 w-[32px]"></td>
                                <td className="py-0 px-1 bg-gray-50/30 border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-0 px-4 bg-gray-50 border-r border-gray-100 font-normal text-gray-400 text-base text-center leading-none w-[140px]">전체</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const locked = isWeekLocked(h.label);
                                    return (
                                        <td key={i} className="py-0 px-1 border-r border-gray-100 text-center w-[60px]">
                                            <button
                                                onClick={() => handleBulkSelect(h.label)}
                                                className={`font-bold underline text-base transition-colors mx-auto whitespace-nowrap ${locked
                                                    ? "text-gray-300 no-underline cursor-not-allowed"
                                                    : "text-blue-600 hover:text-blue-800 cursor-pointer"
                                                    }`}
                                                disabled={locked}
                                                title={`${h.label} 전체 선택/해제`}
                                            >
                                                {members.every(m => {
                                                    const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type));
                                                    return r && r[h.label] === "O";
                                                }) ? "전체취소" : "전체"}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 마감 행 추가 */}
                            <tr className="border-t border-gray-100 bg-gray-50/30">
                                <td className="py-0 px-1 bg-gray-50/30 border-r border-gray-100 w-[32px]"></td>
                                <td className="py-0 px-1 bg-gray-50/30 border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-0 px-4 bg-gray-50 border-r border-gray-100 font-normal text-gray-400 text-base text-center leading-none w-[140px]">마감</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const locked = isWeekLocked(h.label);
                                    return (
                                        <td key={i} className="py-0 px-1 border-r border-gray-100 text-center w-[60px]">
                                            <button
                                                onClick={() => handleToggleLock(h.label)}
                                                className={`font-bold underline text-base transition-colors mx-auto whitespace-nowrap cursor-pointer ${locked
                                                    ? "text-red-600 hover:text-red-800"
                                                    : "text-blue-600 hover:text-blue-800"
                                                    }`}
                                                title={`${h.label} ${locked ? '마감 해제' : '마감'}`}
                                            >
                                                {locked ? '해제' : '마감'}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 통계 행 추가 */}
                            <tr className="border-t-2 border-gray-200 bg-white">
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-white border-r border-gray-100 font-bold text-gray-700 whitespace-nowrap text-sm w-[140px]">학생 출석</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const activeStudents = members.filter(m => m.type === '학생' && isMemberActiveAt(m, h.fullDate));
                                    const studentTotal = activeStudents.length;
                                    const studentAttended = activeStudents.filter(m => {
                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                        return r[h.label] === "O";
                                    }).length;
                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 text-center text-base w-[60px]">
                                            <span className="font-bold text-blue-600 text-base">{studentAttended}</span>
                                            <span className="text-gray-400 mx-1">/</span>
                                            <span className="text-gray-500">{studentTotal}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-white">
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-white border-r border-gray-100 font-bold text-gray-700 whitespace-nowrap text-sm w-[140px]">교사 출석</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const activeTeachers = members.filter(m => m.type === '선생님' && isMemberActiveAt(m, h.fullDate));
                                    const teacherTotal = activeTeachers.length;
                                    const teacherAttended = activeTeachers.filter(m => {
                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                        return r[h.label] === "O";
                                    }).length;
                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 text-center text-base w-[60px]">
                                            <span className="font-bold text-blue-600 text-base">{teacherAttended}</span>
                                            <span className="text-gray-400 mx-1">/</span>
                                            <span className="text-gray-500">{teacherTotal}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-blue-50/20 font-bold border-t border-blue-100">
                                <td className="py-1 px-1 bg-blue-50/20 border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-blue-50/20 border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-3 px-4 bg-blue-50 border-r border-gray-100 font-bold text-blue-800 whitespace-nowrap text-sm uppercase tracking-wide w-[140px]">
                                    <div className="flex items-center gap-2">
                                        <span>전체 출석</span>
                                    </div>
                                </td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const activeMembers = members.filter(m => isMemberActiveAt(m, h.fullDate));
                                    const totalCount = activeMembers.length;
                                    const totalAttended = activeMembers.filter(m => {
                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                        return r[h.label] === "O";
                                    }).length;
                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 text-center text-base w-[60px]">
                                            <span className="font-bold text-blue-600 text-base">{totalAttended}</span>
                                            <span className="text-gray-400 mx-1">/</span>
                                            <span className="text-gray-500 text-base">{totalCount}</span>
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-white border-t border-gray-100">
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-white border-r border-gray-100 font-bold text-blue-700 whitespace-nowrap text-base w-[140px]">전입/전출</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const weekStart = h.fullDate;
                                    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

                                    const getVal = (d) => {
                                        if (!d) return null;
                                        const dt = (typeof d === 'string') ? new Date(d) : d;
                                        return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
                                    };
                                    const sVal = getVal(weekStart);
                                    const eVal = getVal(weekEnd);

                                    const formatDateMD = (dateStr) => {
                                        if (!dateStr) return "";
                                        const dt = new Date(dateStr);
                                        if (isNaN(dt.getTime())) return "";
                                        const mm = String(dt.getMonth() + 1).padStart(2, '0');
                                        const dd = String(dt.getDate()).padStart(2, '0');
                                        return `${mm}-${dd}`;
                                    };

                                    const newcomers = members.filter(m => {
                                        const rVal = getVal(m.regDate);
                                        return rVal && rVal >= sVal && rVal <= eVal;
                                    });
                                    const leavers = members.filter(m => {
                                        const lVal = getVal(m.leaveDate);
                                        return lVal && lVal >= sVal && lVal <= eVal;
                                    });

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 bg-white text-center text-[13px] font-medium leading-tight w-[60px]">
                                            <div className="flex flex-col gap-2">
                                                {newcomers.map(m => (
                                                    <div key={m.id} className="text-blue-600 flex flex-col items-center">
                                                        <span className="font-bold text-sm">{m.name}</span>
                                                        <span className="text-[11px] font-normal">({formatDateMD(m.regDate)} 전입)</span>
                                                    </div>
                                                ))}
                                                {leavers.map(m => (
                                                    <div key={m.id} className="text-red-500 flex flex-col items-center">
                                                        <span className="font-bold text-sm">{m.name}</span>
                                                        <span className="text-[11px] font-normal">({formatDateMD(m.leaveDate)} 전출)</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                            {/* 결석자 명단 행 추가 */}
                            <tr className="bg-white border-t border-gray-100">
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-white border-r border-gray-100 font-bold text-green-700 whitespace-nowrap text-base w-[140px]">학생 결석자</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const isLocked = isWeekLocked(h.label);
                                    const activeStudents = members.filter(m => m.type === '학생' && isMemberActiveAt(m, h.fullDate));
                                    const absentNames = activeStudents.filter(m => {
                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                        return r[h.label] !== "O";
                                    }).map(m => m.name).join("\n");
                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 text-center text-[13px] text-green-600 font-medium leading-tight whitespace-pre-line w-[60px]">
                                            {isLocked ? absentNames : ""}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-white border-t border-gray-100">
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-white border-r border-gray-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-white border-r border-gray-100 font-bold text-green-700 whitespace-nowrap text-base w-[140px]">교사 결석자</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const isLocked = isWeekLocked(h.label);
                                    const activeTeachers = members.filter(m => m.type === '선생님' && isMemberActiveAt(m, h.fullDate));
                                    const absentNames = activeTeachers.filter(m => {
                                        const r = attendanceData.records.find(rec => (rec.memberId && rec.memberId === m.id) || (rec["이름"] === m.name && rec.type === m.type)) || {};
                                        return r[h.label] !== "O";
                                    }).map(m => m.name).join("\n");
                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-gray-100 text-center text-[13px] text-green-600 font-medium leading-tight whitespace-pre-line w-[60px]">
                                            {isLocked ? absentNames : ""}
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr className="bg-pink-50/50 border-t border-pink-100">
                                <td className="py-1 px-1 bg-pink-50/50 border-r border-pink-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-pink-50/50 border-r border-pink-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-pink-50 border-r border-pink-100 font-bold text-pink-700 whitespace-nowrap text-base w-[140px]">생일자</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const match = h.date.match(/\((\d+)월 (\d+)일\)/);
                                    if (!match) return <td key={i} className="py-2 px-1 border-r border-pink-50 text-center w-[60px]">-</td>;

                                    const m = parseInt(match[1]);
                                    const d = parseInt(match[2]);
                                    const weekStart = new Date(selectedYear, m - 1, d);
                                    const weekEnd = new Date(selectedYear, m - 1, d + 6);

                                    const birthdayPeople = members.filter(member => {
                                        if (!member.birthDate) return false;
                                        const bDate = new Date(member.birthDate);
                                        const bMonth = bDate.getMonth();
                                        const bDay = bDate.getDate();
                                        const birthdayThisYear = new Date(selectedYear, bMonth, bDay);
                                        return birthdayThisYear >= weekStart && birthdayThisYear <= weekEnd;
                                    });

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-pink-100 bg-pink-50 text-center text-[13px] text-pink-600 font-medium leading-tight whitespace-pre-line w-[60px]">
                                            {birthdayPeople.map((p, idx) => {
                                                const bDate = new Date(p.birthDate);
                                                return (
                                                    <div key={idx} className="mb-1 last:mb-0">
                                                        <div className="font-bold text-pink-800 text-sm">{p.name}</div>
                                                        <div className="text-[11px] font-normal">({bDate.getMonth() + 1}월 {bDate.getDate()}일)</div>
                                                    </div>
                                                );
                                            })}
                                        </td>
                                    );
                                })}
                            </tr>
                            {/* 암송말씀 행 */}
                            <tr className="bg-purple-50/50 border-t border-purple-100">
                                <td className="py-1 px-1 bg-purple-50/50 border-r border-purple-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-purple-50/50 border-r border-purple-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-purple-50 border-r border-purple-100 font-bold text-purple-700 whitespace-nowrap text-base w-[140px]">암송말씀</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    const match = h.date.match(/\((\d+)월 (\d+)일\)/);
                                    if (!match) return <td key={i} className="py-2 px-1 border-r border-purple-50 text-center w-[60px]">-</td>;

                                    const m = parseInt(match[1]);

                                    // 월별 암송말씀 매핑 (Google Sheets에서 불러온 데이터 사용)
                                    const verses = memoryVerses[m] || [];

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-purple-100 text-center text-[13px] text-purple-600 font-medium leading-tight whitespace-pre-line w-[60px]">
                                            {verses.map((verse, idx) => (
                                                <div key={idx} className="mb-1 last:mb-0">
                                                    <div className="font-bold text-purple-800 text-sm">{verse}</div>
                                                </div>
                                            ))}
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 기도 행 */}
                            <tr className="bg-indigo-50/50 border-t border-indigo-100">
                                <td className="py-1 px-1 bg-indigo-50/50 border-r border-indigo-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-indigo-50/50 border-r border-indigo-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-indigo-50 border-r border-indigo-100 font-bold text-indigo-700 whitespace-nowrap text-base w-[140px]">기도</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    // Google Sheets에서 불러온 기도 일정 사용
                                    const person = prayerSchedule[h.label] || '';

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-indigo-100 text-center text-[13px] text-indigo-600 font-medium leading-tight w-[60px]">
                                            <div className="font-bold text-indigo-800 text-sm">{person}</div>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 헌금 행 */}
                            <tr className="bg-amber-50/50 border-t border-amber-100">
                                <td className="py-1 px-1 bg-amber-50/50 border-r border-amber-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-amber-50/50 border-r border-amber-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-amber-50 border-r border-amber-100 font-bold text-amber-700 whitespace-nowrap text-base w-[140px]">헌금</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    // Google Sheets에서 불러온 헌금 일정 사용
                                    const person = offeringSchedule[h.label] || '';

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-amber-100 text-center text-[13px] text-amber-600 font-medium leading-tight w-[60px]">
                                            <div className="font-bold text-amber-800 text-sm">{person}</div>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* 청소 행 */}
                            <tr className="bg-teal-50/50 border-t border-teal-100">
                                <td className="py-1 px-1 bg-teal-50/50 border-r border-teal-100 w-[32px]"></td>
                                <td className="py-1 px-1 bg-teal-50/50 border-r border-teal-100 w-[44px]"></td>
                                <td className="sticky left-0 py-2 px-4 bg-teal-50 border-r border-teal-100 font-bold text-teal-700 whitespace-nowrap text-base w-[140px]">청소</td>
                                {currentMonthRangeHeaders.map((h, i) => {
                                    // Google Sheets에서 불러온 청소 일정 사용
                                    const people = cleaningSchedule[h.label] || [];

                                    return (
                                        <td key={i} className="py-2 px-1 border-r border-teal-100 text-center text-[13px] text-teal-600 font-medium leading-tight w-[60px]">
                                            {people.map((person, idx) => (
                                                <div key={idx} className="mb-1 last:mb-0">
                                                    <div className="font-bold text-teal-800 text-sm">{person}</div>
                                                </div>
                                            ))}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* 2. 명단 추가 */}
            <div ref={memberFormRef}>
                <Card
                    title={<span className="text-lg font-semibold">{editingMemberId !== null ? "명단 수정" : "명단 추가"}</span>}
                    right={
                        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            {['학생', '선생님'].map(t => (
                                <button key={t} onClick={() => { setMemberType(t); resetMemberForm(); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${memberType === t ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-700'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    }
                >
                    <form onSubmit={handleMemberSubmit} className="space-y-4 min-h-[160px]">
                        {memberType === '학생' ? (
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">학생 이름</label>
                                    <input type="text" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="학생 이름" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">나이</label>
                                    <input type="number" value={memberForm.age} onChange={e => setMemberForm({ ...memberForm, age: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="세" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">반</label>
                                    <input
                                        type="text"
                                        value={memberForm.group}
                                        onChange={e => {
                                            const group = e.target.value;
                                            const teacher = members.find(t => t.type === '선생님' && t.group === group)?.name || '';
                                            setMemberForm({ ...memberForm, group, teacher });
                                        }}
                                        className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none"
                                        placeholder="OO반"
                                    />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">생년월일</label>
                                    <input type="date" value={memberForm.birthDate} onChange={e => setMemberForm({ ...memberForm, birthDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">등록일</label>
                                    <input type="date" value={memberForm.regDate} onChange={e => setMemberForm({ ...memberForm, regDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                </div>
                                <div className="col-span-1 md:col-span-1">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">전출일</label>
                                    <input type="date" value={memberForm.leaveDate} onChange={e => setMemberForm({ ...memberForm, leaveDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                </div>
                                <div className="col-span-2 md:col-span-2">
                                    <label className="text-sm font-medium text-gray-500 mb-1 block">기도제목 (메모)</label>
                                    <input type="text" value={memberForm.prayer} onChange={e => setMemberForm({ ...memberForm, prayer: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="기도제목 입력" />
                                </div>
                                <div className="col-span-3 md:col-span-3 flex gap-1 items-end">
                                    <div className="flex-1 relative">
                                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-11" />
                                        <button type="button" className={`w-full h-11 rounded-xl flex items-center justify-center gap-1 border transition-all text-xs ${isUploading ? 'bg-orange-50 text-orange-500 border-orange-200' : memberForm.photoUrl ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 font-normal border-gray-300'}`}>
                                            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={18} />}
                                            <span>사진</span>
                                        </button>
                                    </div>
                                    <button type="submit" className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-md font-bold text-base active:scale-95 transition-all">
                                        {editingMemberId !== null ? <Save size={18} /> : <Plus size={18} />}
                                        <span>{editingMemberId !== null ? "저장" : "추가"}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-4 md:grid-cols-4 gap-3">
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">선생님 이름</label>
                                        <input type="text" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="이름" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">직책</label>
                                        <input type="text" value={memberForm.position} onChange={e => setMemberForm({ ...memberForm, position: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="부장 등" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">반</label>
                                        <input
                                            type="text"
                                            value={memberForm.group}
                                            onChange={e => {
                                                const group = e.target.value;
                                                const assignedStudents = members
                                                    .filter(m => m.type === '학생' && m.group === group)
                                                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                                                    .map(m => m.name)
                                                    .join(', ');
                                                setMemberForm({ ...memberForm, group, assignedStudents });
                                            }}
                                            className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none"
                                            placeholder="OO반"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">생년월일</label>
                                        <input type="date" value={memberForm.birthDate} onChange={e => setMemberForm({ ...memberForm, birthDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-5 gap-3 items-end">
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">등록일</label>
                                        <input type="date" value={memberForm.regDate} onChange={e => setMemberForm({ ...memberForm, regDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">전출일</label>
                                        <input type="date" value={memberForm.leaveDate} onChange={e => setMemberForm({ ...memberForm, leaveDate: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-sm font-medium text-gray-500 mb-1 block">기도제목 (메모)</label>
                                        <input type="text" value={memberForm.prayer} onChange={e => setMemberForm({ ...memberForm, prayer: e.target.value })} className="w-full rounded-xl border-gray-300 border px-2 py-2 bg-gray-50 focus:bg-white transition-colors text-base h-11 outline-none" placeholder="내용 입력" />
                                    </div>
                                    <div className="col-span-1">
                                        <button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center font-bold text-base shadow-md transition-colors active:scale-95">
                                            {editingMemberId !== null ? <Save size={18} className="mr-1" /> : <Plus size={18} className="mr-1" />}
                                            <span>{editingMemberId !== null ? "저장" : "추가"}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {editingMemberId !== null && (
                            <button type="button" onClick={() => { setEditingMemberId(null); resetMemberForm(); }} className="w-full py-2 text-base text-gray-400 underline">수정 취소</button>
                        )}
                    </form>
                </Card>
            </div>

            {/* 3. 학생명단 */}
            <Card title={
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">학생명단</span>
                    <a
                        href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=1598655081#gid=1598655081"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Table2 size={14} className="text-green-600" /> 명단 시트
                    </a>
                </div>
            }>
                {/* Sticky Header Table */}
                <div ref={studentListHeaderRef} className="sticky top-[108px] md:top-[85px] z-10 overflow-x-hidden -mx-4 px-4 scrollbar-hide">
                    <table className="w-full text-base table-fixed">
                        <colgroup>
                            <col style={{ width: '48px' }} />
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '112px' }} />
                            <col style={{ width: '96px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '144px' }} />
                            <col style={{ minWidth: '160px' }} />
                            <col style={{ width: '80px' }} />
                        </colgroup>
                        <thead>
                            <tr className="border-b-2 border-gray-200 text-gray-700 bg-gray-50">
                                <th className="py-2.5 px-2 font-normal text-center text-base w-12 whitespace-nowrap bg-gray-50">연번</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-20 whitespace-nowrap bg-gray-50">반</th>
                                <th className="sticky left-0 z-30 py-2.5 px-2 font-normal text-center text-base w-28 whitespace-nowrap bg-gray-50">이름</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-24 whitespace-nowrap bg-gray-50">나이</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-32 whitespace-nowrap bg-gray-50">선생님</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-32 whitespace-nowrap bg-gray-50">생년월일</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-36 whitespace-nowrap bg-gray-50">
                                    <div className="flex flex-col items-center leading-tight">
                                        <span className="text-blue-600">등록일</span>
                                        <span className="text-red-500">전출일</span>
                                    </div>
                                </th>
                                <th className="py-2.5 px-2 font-normal text-center text-base min-w-[160px] bg-gray-50">기도제목</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-20 whitespace-nowrap bg-gray-50">관리</th>
                            </tr>
                        </thead>
                    </table>
                </div>

                {/* Scrollable Body Table */}
                <div ref={studentListBodyRef} className="overflow-x-auto -mx-4 px-4 scrollbar-hide" onScroll={handleStudentListScroll}>
                    <table className="w-full text-base table-fixed">
                        <colgroup>
                            <col style={{ width: '48px' }} />
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '112px' }} />
                            <col style={{ width: '96px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '144px' }} />
                            <col style={{ minWidth: '160px' }} />
                            <col style={{ width: '80px' }} />
                        </colgroup>
                        <tbody>
                            {sortedStudents.map((m, index) => (
                                <tr key={m.id} id={`list-row-${m.id}`} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-all border-l-4 border-l-amber-400/50">
                                    <td className="py-1.5 px-2 text-center text-gray-400 text-sm w-12">{index + 1}</td>
                                    <td className="py-1.5 px-2 text-center font-normal text-blue-700 text-base cursor-pointer class-cell w-20 whitespace-nowrap" onClick={() => {
                                        if (m.photoUrl) highlightAndScroll(`gallery-member-${m.id}`);
                                    }}>
                                        <span className="text-base">{m.group && m.group.length > 10 && m.group.includes('T') ? "반미정" : m.group}</span>
                                    </td>
                                    <td className={`sticky left-0 py-1.5 px-2 text-center font-bold text-base cursor-pointer name-cell w-28 whitespace-nowrap hover:underline bg-white ${!isMemberActiveAt(m, today) ? 'text-gray-400 line-through decoration-2' : 'text-blue-600'}`} onClick={() => highlightAndScroll(`attendance-row-${m.id}`)}>
                                        {m.name}
                                        {!isMemberActiveAt(m, today) && (
                                            <div className="text-[10px] text-gray-400 font-normal no-underline leading-none mt-0.5">
                                                {getInactiveLabel(m)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-1.5 px-2 text-center text-gray-600 text-base w-24 whitespace-nowrap">{m.age}세</td>
                                    <td className="py-1.5 px-2 text-center text-gray-700 font-medium text-base w-32 whitespace-nowrap cursor-pointer hover:underline" onClick={() => {
                                        const teacher = members.find(t => t.type === '선생님' && t.name === (m.teacher || "").trim());
                                        if (teacher) highlightAndScroll(`list-row-teacher-${teacher.id}`);
                                    }}>{m.teacher}</td>
                                    <td className="py-1.5 px-2 text-center text-gray-600 text-base w-32 whitespace-nowrap">{m.birthDate || "-"}</td>
                                    <td className="py-1 px-2 text-center text-sm w-36 whitespace-nowrap leading-tight">
                                        <div className="text-blue-600 font-medium">{m.regDate || "-"}</div>
                                        <div className="text-red-500 font-medium">{m.leaveDate || "-"}</div>
                                    </td>
                                    <td className="py-1.5 px-4 text-gray-700 text-left text-base max-w-[160px]" onClick={() => setExpandedPrayerId(expandedPrayerId === m.id ? null : m.id)}>
                                        <div className={`leading-relaxed ${expandedPrayerId === m.id ? "break-words" : "truncate"}`}>{m.prayer}</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handleEditMember(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            <tr className="border-t-2 border-blue-200 bg-blue-50/30 sticky bottom-0 z-5">
                                <td colSpan={9} className="py-3 px-4 text-left text-blue-800 font-bold">
                                    합계: 실 인원 {sortedStudents.filter(m => isMemberActiveAt(m, today)).length}명
                                    <span className="text-gray-500 text-xs font-normal"> ({today.toISOString().split('T')[0]} 오늘 기준)</span>
                                    / 총 {sortedStudents.length}명
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* 4. 교사명단 */}
            <Card title={
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">교사명단</span>
                    <a
                        href="https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/edit?gid=1598655081#gid=1598655081"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Table2 size={14} className="text-green-600" /> 명단 시트
                    </a>
                </div>
            }>
                {/* Sticky Header Table */}
                <div ref={teacherListHeaderRef} className="sticky top-[108px] md:top-[85px] z-10 overflow-x-hidden -mx-4 px-4 scrollbar-hide">
                    <table className="w-full text-base table-fixed">
                        <colgroup>
                            <col style={{ width: '48px' }} />
                            <col style={{ width: '64px' }} />
                            <col style={{ width: '96px' }} />
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '192px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '144px' }} />
                            <col style={{ minWidth: '200px' }} />
                            <col style={{ width: '80px' }} />
                        </colgroup>
                        <thead>
                            <tr className="border-b-2 border-gray-200 text-gray-700 bg-gray-50">
                                <th className="py-2.5 px-2 font-normal text-center text-base w-12 whitespace-nowrap bg-gray-50">연번</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-16 whitespace-nowrap bg-gray-50">반</th>
                                <th className="sticky left-0 z-30 py-2.5 px-2 font-normal text-center text-base w-24 whitespace-nowrap bg-gray-50">이름</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-20 whitespace-nowrap bg-gray-50">직책</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-48 whitespace-nowrap bg-gray-50">담당 학생</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-32 whitespace-nowrap bg-gray-50">생년월일</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-36 whitespace-nowrap bg-gray-50">
                                    <div className="flex flex-col items-center leading-tight">
                                        <span className="text-blue-600">등록일</span>
                                        <span className="text-red-500">전출일</span>
                                    </div>
                                </th>

                                <th className="py-2.5 px-2 font-normal text-center text-base min-w-[200px] bg-gray-50">기도제목</th>
                                <th className="py-2.5 px-2 font-normal text-center text-base w-20 whitespace-nowrap bg-gray-50">관리</th>
                            </tr>
                        </thead>
                    </table>
                </div>

                {/* Scrollable Body Table */}
                <div ref={teacherListBodyRef} className="overflow-x-auto -mx-4 px-4 scrollbar-hide" onScroll={handleTeacherListScroll}>
                    <table className="w-full text-base table-fixed">
                        <colgroup>
                            <col style={{ width: '48px' }} />
                            <col style={{ width: '64px' }} />
                            <col style={{ width: '96px' }} />
                            <col style={{ width: '80px' }} />
                            <col style={{ width: '192px' }} />
                            <col style={{ width: '128px' }} />
                            <col style={{ width: '144px' }} />
                            <col style={{ minWidth: '200px' }} />
                            <col style={{ width: '80px' }} />
                        </colgroup>
                        <tbody>
                            {members.filter(m => m.type === '선생님').sort((a, b) => {
                                const groupComp = (a.group || "").localeCompare(b.group || "");
                                if (groupComp !== 0) return groupComp;
                                return (a.name || "").localeCompare(b.name || "");
                            }).map((m, index) => (
                                <tr key={m.id} id={`list-row-teacher-${m.id}`} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-all border-l-4 border-l-slate-400">
                                    <td className="py-1.5 px-2 text-center text-gray-400 text-sm w-12">{index + 1}</td>
                                    <td className="py-1.5 px-2 text-center font-normal text-blue-700 text-base cursor-pointer hover:bg-blue-100/50 w-16 whitespace-nowrap" onClick={() => {
                                        // Highlight student rows in the same class
                                        const studentRows = document.querySelectorAll(`[id^="list-row-"]`);
                                        let firstMatch = null;
                                        studentRows.forEach(row => {
                                            const classCell = row.querySelector('.class-cell');
                                            if (classCell && classCell.textContent.trim() === m.group) {
                                                if (!firstMatch) firstMatch = row;
                                                row.style.transition = 'background-color 0.5s ease-in-out';
                                                row.style.backgroundColor = '#fef9c3';
                                                setTimeout(() => row.style.backgroundColor = '', 5000);
                                            }
                                        });
                                        if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}>{m.group || "-"}</td>
                                    <td className={`sticky left-0 py-1.5 px-2 text-center font-bold text-base w-24 whitespace-nowrap cursor-pointer hover:underline bg-white ${!isMemberActiveAt(m, today) ? 'text-gray-400 line-through decoration-2' : 'text-blue-600'}`} onClick={() => highlightAndScroll(`attendance-row-${m.id}`)}>
                                        {m.name}
                                        {!isMemberActiveAt(m, today) && (
                                            <div className="text-[10px] text-gray-400 font-normal no-underline leading-none mt-0.5">
                                                {getInactiveLabel(m)}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-1.5 px-2 text-center text-gray-600 text-base w-20 whitespace-nowrap">{m.position}</td>
                                    <td className="py-1.5 px-2 text-left text-base text-gray-700 w-48">
                                        <div className="flex gap-1 justify-start whitespace-nowrap px-2">
                                            {(m.assignedStudents || "-").split(',').map((s, i) => (
                                                <span key={i} className="cursor-pointer hover:text-blue-600 hover:underline" onClick={() => {
                                                    const targetName = s.trim();
                                                    const studentRows = document.querySelectorAll(`[id^="list-row-"]`);
                                                    studentRows.forEach(row => {
                                                        const nameCell = row.querySelector('.name-cell');
                                                        if (nameCell && nameCell.textContent.trim() === targetName) {
                                                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            row.style.transition = 'background-color 0.5s ease-in-out';
                                                            row.style.backgroundColor = '#fef9c3';
                                                            setTimeout(() => row.style.backgroundColor = '', 5000);
                                                        }
                                                    });
                                                }}>
                                                    {s.trim()}{i < (m.assignedStudents || "").split(',').length - 1 ? ',' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-1.5 px-2 text-center text-gray-600 text-base w-32 whitespace-nowrap">{m.birthDate || "-"}</td>
                                    <td className="py-1 px-2 text-center text-sm w-36 whitespace-nowrap leading-tight">
                                        <div className="text-blue-600 font-medium">{m.regDate || "-"}</div>
                                        <div className="text-red-500 font-medium">{m.leaveDate || "-"}</div>
                                    </td>
                                    <td className="py-1.5 px-4 text-gray-700 text-left text-base max-w-[300px]" onClick={() => setExpandedPrayerId(expandedPrayerId === m.id ? null : m.id)}>
                                        <div className={`leading-relaxed ${expandedPrayerId === m.id ? "break-words" : "truncate"}`}>{m.prayer}</div>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handleEditMember(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                            <button onClick={() => handleDeleteMember(m.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-blue-50/30 font-bold border-t-2 border-blue-100">
                                <td colSpan={4} className="py-3 px-6 text-left text-blue-800">
                                    합계: 실인원 {members.filter(m => m.type === '선생님' && isMemberActiveAt(m, today)).length}명
                                    <span className="text-[11px] font-normal text-gray-500 ml-1">({today.toISOString().split('T')[0]} 오늘 기준)</span>
                                </td>
                                <td colSpan={2} className="py-3 px-4 text-left text-blue-800">/ 총 {members.filter(m => m.type === '선생님').length}명</td>
                                <td colSpan={3}></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card >

            {/* 5. 사진 갤러리 */}
            < div className="mt-8 space-y-4" >
                <div className="flex items-center gap-3 px-1">
                    <ImageIcon className="text-blue-600" size={24} />
                    <h3 className="text-xl font-bold">사진 갤러리</h3>
                    <a
                        href="https://drive.google.com/drive/folders/1gmhV08lX3V2I0PgO2fNKCiWc3x8nasQn"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 rounded border text-xs bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1 transition-colors font-normal"
                    >
                        <Folder size={14} className="text-blue-600" /> 학생사진 드라이브
                    </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {members.filter(m => m.photoUrl).sort((a, b) => {
                        const groupComp = (a.group || "").localeCompare(b.group || "");
                        if (groupComp !== 0) return groupComp;
                        return (a.name || "").localeCompare(b.name || "");
                    }).map(m => (
                        <div key={m.id} id={`gallery-member-${m.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all">
                            <div className="aspect-square relative flex items-center justify-center bg-gray-50 cursor-pointer" onClick={() => window.open(m.photoUrl, '_blank')}>
                                <img
                                    src={m.photoUrl.includes("drive.google.com") && m.photoUrl.includes("id=")
                                        ? `https://drive.google.com/thumbnail?id=${new URL(m.photoUrl).searchParams.get("id")}&sz=w800`
                                        : m.photoUrl}
                                    alt={m.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleEditMember(m); }} className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm text-blue-600 hover:bg-white transition-colors">
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                                <div className={`absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full font-bold shadow-sm ${m.type === '학생' ? 'bg-blue-600 text-white' : 'bg-orange-600 text-white'}`}>
                                    {m.type}
                                </div>
                            </div>
                            <div className="p-3 space-y-1 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => highlightAndScroll(`list-row-${m.id}`)}>
                                <div className="flex items-center justify-between pointer-events-none">
                                    <span className="font-bold text-gray-800 text-lg">{m.name}</span>
                                    {m.age && <span className="text-gray-400 text-sm">{m.age}세</span>}
                                    {m.position && <span className="text-orange-500 text-sm font-bold">{m.position}</span>}
                                </div>
                                <div className="flex items-center justify-between gap-1 pointer-events-none">
                                    <span className="text-blue-600 text-sm font-bold">{m.group && `<${m.group}>`}</span>
                                    <span className="text-xs text-gray-400 truncate">{m.type === '학생' ? m.teacher : '공동체'}</span>
                                </div>
                                {m.prayer && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); setExpandedPrayerId(expandedPrayerId === m.id ? null : m.id); }}
                                        className={`text-sm text-gray-500 bg-gray-50 p-2 rounded cursor-pointer mt-1 leading-tight pointer-events-auto ${expandedPrayerId === m.id ? "" : "truncate"}`}
                                    >
                                        🙏 {m.prayer}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div >
        </div >
    );
}
