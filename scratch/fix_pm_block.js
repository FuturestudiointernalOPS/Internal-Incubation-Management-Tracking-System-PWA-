const fs = require('fs');
const filepath = 'src/app/pm/programs/[id]/page.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace("{user.role === 'super_admin' && (\n                    \n                    )}", "");
// Handle potential carriage returns
content = content.replace("{user.role === 'super_admin' && (\r\n                    \r\n                    )}", "");

fs.writeFileSync(filepath, content);
console.log('Fixed empty block');
