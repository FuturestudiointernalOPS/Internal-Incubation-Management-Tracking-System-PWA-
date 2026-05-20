const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let lines = fs.readFileSync(filepath, 'utf8').split('\n');

const newLines = [];
let inAddKPI = false;
let inRemoveKPI = false;
let inKPIModal = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Remove states
    if (line.includes('const [showKPIModal, setShowKPIModal] = useState(false);')) continue;
    if (line.includes("const [newKPI, setNewKPI] = useState({ title: '', target_value: 80 });")) continue;
    
    // Remove addKPI function
    if (line.includes('const addKPI = async () => {')) {
        inAddKPI = true;
        continue;
    }
    if (inAddKPI) {
        if (line.includes('};') && lines[i-1].includes('setIsSaving(false);')) {
            inAddKPI = false;
        }
        continue;
    }

    // Remove removeKPI function
    if (line.includes('const removeKPI = async (kpiId) => {')) {
        inRemoveKPI = true;
        continue;
    }
    if (inRemoveKPI) {
        if (line.includes('};') && lines[i-1].includes("notify('Network error.', 'error'); }")) {
            inRemoveKPI = false;
        }
        continue;
    }

    // Remove trash icon button
    if (line.includes('<button onClick={() => removeKPI(kpi.id)} className="text-rose-500"><Trash2 className="w-4 h-4" /></button>')) continue;

    // Remove Define KPI Target button
    if (line.includes('onClick={() => setShowKPIModal(true)}') && line.includes('Define KPI Target')) {
        // Skip this line and the next one (which is the closing tag)
        i++;
        continue;
    }

    // Remove KPI Modal
    if (line.includes('{/* DEFINE KPI MODAL */}')) {
        inKPIModal = true;
        continue;
    }
    if (inKPIModal) {
        if (line.includes(')}')) {
            inKPIModal = false;
        }
        continue;
    }

    newLines.push(line);
}

fs.writeFileSync(filepath, newLines.join('\n'));
console.log('PM page KPI elements removed.');
