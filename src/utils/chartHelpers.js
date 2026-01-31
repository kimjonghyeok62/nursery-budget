export const CHART_COLORS = [
    '#FF8042', // Orange (간식비)
    '#00C49F', // Teal (교재교구비)
    '#FFBB28', // Yellow (사무용품비)
    '#0088FE', // Blue (행사비)
    '#8884d8', // Purple (기타/수련회)
    '#FF6384', // Red
    '#36A2EB', // Blue
    '#4BC0C0', // Green
    '#9966FF', // Violet
    '#FF9F40'  // Orange
];

export const REMAINING_COLOR = '#E5E7EB'; // Gray-200 for remaining

export function groupExpensesByKeyword(expenses) {
    const mainGroups = {
        '간식비': 0,
        '교재교구비': 0,
        '사무용품비': 0,
        '행사비': 0,
        '수련회/성경학교': 0
    };

    const individualItems = []; // For large expenses
    let otherTotal = 0;

    expenses.forEach(e => {
        const desc = (e.description || "").trim();
        const amount = e.amount || 0;

        let matched = false;

        // 1. Specific Keyword Matching
        if (/수련회|성경학교/.test(desc)) {
            mainGroups['수련회/성경학교'] += amount;
            matched = true;
        } else if (/간식|과자|음료|우유/.test(desc)) {
            mainGroups['간식비'] += amount;
            matched = true;
        } else if (/교재|도서|책|학습|공과/.test(desc)) {
            mainGroups['교재교구비'] += amount;
            matched = true;
        } else if (/사무|문구|복사|펜/.test(desc)) {
            mainGroups['사무용품비'] += amount;
            matched = true;
        } else if (/행사|소풍|캠프/.test(desc)) {
            mainGroups['행사비'] += amount;
            matched = true;
        }

        // 2. Unmatched: Check if "Large" (>= 100,000 KRW)
        if (!matched) {
            if (amount >= 100000) {
                // Check if already exists in individualItems (aggregate if same name, typically unique)
                const existing = individualItems.find(i => i.name === desc);
                if (existing) {
                    existing.value += amount;
                } else {
                    individualItems.push({ name: desc, value: amount });
                }
            } else {
                otherTotal += amount;
            }
        }
    });

    // Combine results
    const result = [];

    // Add Main Groups
    Object.keys(mainGroups).forEach(key => {
        if (mainGroups[key] > 0) {
            result.push({ name: key, value: mainGroups[key] });
        }
    });

    // Add Individual Large Items
    individualItems.forEach(item => {
        result.push(item);
    });

    // Add Other
    if (otherTotal > 0) {
        result.push({ name: '기타', value: otherTotal });
    }

    // Sort by value desc? Optional, but pie chart looks better. 
    // Let's typically keep user Categories first, then individuals, then other?
    // Or just sort by value for better Pie visualization.
    // result.sort((a, b) => b.value - a.value); 

    return result;
}

export function groupExpensesByCategory(expenses) {
    const groups = {};
    expenses.forEach(e => {
        const cat = e.category || '기타';
        groups[cat] = (groups[cat] || 0) + (e.amount || 0);
    });

    const result = Object.keys(groups).map(key => ({
        name: key,
        value: groups[key]
    }));

    // Sort by value desc
    // result.sort((a, b) => b.value - a.value);

    return result;
}
