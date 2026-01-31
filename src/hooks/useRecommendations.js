import { useState, useEffect } from 'react';
import { csvToRows } from '../utils/csv';

const RECOM_CSV_URL = "https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/export?format=csv&gid=918579462";

export function useRecommendations() {
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        fetch(RECOM_CSV_URL)
            .then(res => res.text())
            .then(text => {
                const rows = csvToRows(text);
                // Expected headers based on inspection: 키워드, 표준 적요 추천, 자동 분류 세세목
                const list = rows
                    .filter(r => r.키워드 && r['표준 적요 추천'])
                    .map(r => ({
                        keyword: r.키워드,
                        standardDesc: r['표준 적요 추천'],
                        category: r['자동 분류 세세목'] || "미분류"
                    }));
                setRecommendations(list);
            })
            .catch(err => console.warn("Failed to fetch recommendations", err));
    }, []);

    return recommendations;
}
