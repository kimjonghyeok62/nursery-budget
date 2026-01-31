import { useState, useEffect } from 'react';
import { csvToRows } from '../utils/csv';

const SERIAL_CSV_URL = "https://docs.google.com/spreadsheets/d/1METL5eBui0qkLiwJHFYsk5dUuhIU_JG_jG5FxO0SyrA/export?format=csv&gid=0";

export function useSerialNumbers() {
    const [serialMap, setSerialMap] = useState({});

    useEffect(() => {
        fetch(SERIAL_CSV_URL)
            .then(res => res.text())
            .then(text => {
                const rows = csvToRows(text);
                const map = {};
                rows.forEach(r => {
                    const id = r.ID || r.id;
                    const serial = r['연번'] || r['No'] || "";
                    if (id && serial) map[id] = serial;
                });
                setSerialMap(map);
            })
            .catch(err => console.warn("Failed to fetch serial numbers", err));
    }, []);

    return serialMap;
}
