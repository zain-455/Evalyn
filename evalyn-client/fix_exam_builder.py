import re
import os

file_path = 'd:/My Projects/FYP VS Code/evalyn-client/src/pages/instructor/ExamBuilder.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    c = f.read()

# Constraints grid change
old_grid = "<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'start' }}>"
new_grid = "<div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>"
if old_grid in c:
    c = c.replace(old_grid, new_grid)

old_gap = "<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>"
new_gap = "<div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>"
c = c.replace(old_gap, new_gap)

# Min max inputs align nicely
idx = c.find('Required Domain Tags')
if idx != -1:
    sub = c[max(0, idx - 1500):min(len(c), idx + 500)]
    sub = sub.replace("borderRadius: '10px'", "borderRadius: '100px'")
    sub = sub.replace("width: '100%'", "width: '80px'")
    c = c[:max(0, idx - 1500)] + sub + c[min(len(c), idx + 500):]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(c)

print('File replaced successfully')
