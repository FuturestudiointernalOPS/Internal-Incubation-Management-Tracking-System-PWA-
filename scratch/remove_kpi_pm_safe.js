const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace('const [showKPIModal, setShowKPIModal] = useState(false);', '');
content = content.replace("const [newKPI, setNewKPI] = useState({ title: '', target_value: 80 });", '');

// Remove addKPI
const addKpiRegex = /  const addKPI = async \(\) => \{[\s\S]*?finally \{ setIsSaving\(false\); \}\n  \};\n/;
content = content.replace(addKpiRegex, '');

// Remove removeKPI
const removeKpiRegex = /  const removeKPI = async \(kpiId\) => \{[\s\S]*?\} catch \(e\) \{ notify\('Network error\.', 'error'\); \}\n  \};\n/;
content = content.replace(removeKpiRegex, '');

// Remove the trash icon button in the KPI list
const trashBtnRegex = /<button onClick=\{\(\) => removeKPI\(kpi\.id\)\} className="text-rose-500"><Trash2 className="w-4 h-4" \/><\/button>/;
content = content.replace(trashBtnRegex, '');

// Remove Define KPI Target button
const defineBtnRegex = /<button onClick=\{\(\) => setShowKPIModal\(true\)\} className="btn btn-secondary w-full py-3 gap-2 border-dashed">[\s\S]*?<\/button>/;
content = content.replace(defineBtnRegex, '');

// Remove Define KPI Modal block
const modalRegex = /\{\/\* DEFINE KPI MODAL \*\/\}[\s\S]*?\{showKPIModal && \([\s\S]*?<div className="fixed inset-0 z-\[400\][\s\S]*?<\/div>\n      \)\}/;
content = content.replace(modalRegex, '');

fs.writeFileSync(filepath, content);
console.log('Done replacement');
