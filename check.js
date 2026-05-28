const fs = require('fs');
let code = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf8');
code = code.replace('<DashboardLayout role={user.role || "program_manager"}>', '<><DashboardLayout role={user.role || "program_manager"}>');
code = code.replace(/<\/DashboardLayout>\s*\);/g, '</DashboardLayout></>);');
fs.writeFileSync('page_test.js', code);
