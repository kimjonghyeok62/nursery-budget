
import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('src/2025_expenses.csv');
const outPath = path.resolve('src/data/expenses2025.js');

try {
    const csv = fs.readFileSync(csvPath, 'utf-8');
    const lines = csv.split('\n');

    // Skip line 1 (Title), Line 2 is Header
    // Headers: 번호, 날짜, 세목, 세세목, 내역, 금액
    // Map to: id, date, category(세세목), description(내역), amount

    const rules = {
        '날짜': 'date',
        '세세목': 'category',
        '내역': 'description',
        '금액': 'amount'
    };

    const data = [];

    // Start from line 3 (index 2)
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith(',합계')) continue; // Skip total line

        // Parse CSV line (handle quotes)
        const parts = [];
        let current = '';
        let inQuote = false;
        for (let char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());

        // Index mapping based on line 2 (hardcoded for safety based on inspection)
        // 0: 번호, 1: 날짜, 2: 세목, 3: 세세목, 4: 내역, 5: 금액
        const date = parts[1];
        const category = parts[3];
        const description = parts[4];
        const rawAmount = parts[5];

        if (!date || !category) continue;

        // Clean amount: Remove "₩", ",", "원"
        const amount = rawAmount ? parseInt(rawAmount.replace(/[₩,원"]/g, ''), 10) : 0;

        data.push({
            id: `2025-${i}`, // Dummy ID
            date,
            category,
            description: description.replace(/^"|"$/g, ''), // Remove surrounding quotes if any
            amount
        });
    }

    const fileContent = `export const expenses2025 = ${JSON.stringify(data, null, 2)};`;

    if (!fs.existsSync('src/data')) {
        fs.mkdirSync('src/data');
    }

    fs.writeFileSync(outPath, fileContent, 'utf-8');
    console.log(`Successfully converted ${data.length} items to ${outPath}`);

} catch (e) {
    console.error("Conversion failed:", e);
    process.exit(1);
}
