const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Remove states
content = content.replace(/const \[showKPIModal, setShowKPIModal\] = useState\(false\);\n/, '');
content = content.replace(/const \[newKPI, setNewKPI\] = useState\(\{ title: '', target_value: 80 \}\);\n/, '');

// 2. Remove addKPI function (approx lines 288-305)
content = content.replace(/  const addKPI = async \(\) => {[\s\S]*?fetchProgramData\(true\); }\n    } catch \(e\) \{ notify\('Network error.', 'error'\); \}\n    finally \{ setIsSaving\(false\); \}\n  };\n/, '');

// 3. Remove removeKPI function (approx lines 308-319)
content = content.replace(/  const removeKPI = async \(kpiId\) => {[\s\S]*?fetchProgramData\(true\);\n    } catch \(e\) \{ notify\('Network error.', 'error'\); \}\n  };\n/, '');

// 4. Remove trash icon
content = content.replace(/<button onClick=\{\(\) => removeKPI\(kpi\.id\)\} className="text-rose-500"><Trash2 className="w-4 h-4" \/><\/button>\n/, '');

// 5. Remove "Define KPI Target" button
const btnRegex = /<button onClick=\{\(\) => setShowKPIModal\(true\)\} className="btn btn-secondary w-full py-3 gap-2 border-dashed">[\s\S]*?<\/button>\n/;
content = content.replace(btnRegex, '');

// 6. Remove the KPI Modal
const modalRegex = /\{\/\* DEFINE KPI MODAL \*\/\}[\s\S]*?\{showKPIModal && \([\s\S]*?<div className="fixed inset-0 z-\[400\][\s\S]*?<\/div>\n      \)\}\n/;
content = content.replace(modalRegex, '');

fs.writeFileSync(filepath, content);
console.log('PM page modifications complete.');
