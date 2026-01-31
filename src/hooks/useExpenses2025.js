import { useState, useEffect } from 'react';
import { csvToRows } from '../utils/csv';
import { parseAmount } from '../utils/format';

const EXPENSES_2025_URL = "https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/export?format=csv&gid=452445058";

export function useExpenses2025() {
    const [data, setData] = useState([]);

    useEffect(() => {
        fetch(EXPENSES_2025_URL)
            .then(res => res.text())
            .then(text => {
                // The CSV likely has a title row. Find where the real header starts.
                // Look for the line starting with "번호" or containing it in the first column
                const lines = text.split(/\r\n|\n/);
                const headerIndex = lines.findIndex(l => l.includes('번호') && l.includes('날짜'));

                // If found, join from that line onwards. Otherwise use original text.
                const cleanText = headerIndex >= 0 ? lines.slice(headerIndex).join("\n") : text;

                const rows = csvToRows(cleanText);
                // Headers: 번호, 날짜, 세목, 세세목, 내역, 금액
                const list = rows
                    .filter(r => r.날짜 && r.금액)
                    .map(r => ({
                        id: r.번호 || crypto.randomUUID(),
                        date: r.날짜,
                        category: r.세세목 || "미분류",
                        description: r.내역 || "",
                        amount: parseAmount(r.금액)
                    }));
                setData(list);
            })
            .catch(err => console.warn("Failed to fetch 2025 expenses", err));
    }, []);

    return data;
}
