const fs = require('fs');
const filePath = 'd:/My Projects/FYP VS Code/evalyn-client/src/pages/instructor/ExamBuilder.jsx';

let c = fs.readFileSync(filePath, 'utf8');

const oldGrid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'start' }}>";
const newGrid = "<div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>";
c = c.replace(oldGrid, newGrid);

const oldGap = "<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>";
const newGap = "<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>";
c = c.replace(oldGap, newGap);

const idx = c.indexOf('Required Domain Tags');
if (idx !== -1) {
    let sub = c.substring(Math.max(0, idx - 1500), Math.min(c.length, idx + 500));
    sub = sub.replace(/borderRadius: '10px'/g, "borderRadius: '100px'");
    sub = sub.replace(/width: '100%'/g, "width: '80px'");
    c = c.substring(0, Math.max(0, idx - 1500)) + sub + c.substring(Math.min(c.length, idx + 500));
}

fs.writeFileSync(filePath, c, 'utf8');
console.log('File successfully updated with JS.');
