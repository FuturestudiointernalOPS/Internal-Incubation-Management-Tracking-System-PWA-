const fs = require('fs');
const lines = fs.readFileSync('src/app/pm/programs/[id]/page.js', 'utf8').split('\n');

// Find lines where a literal } appears in JSX text (between > and <)
// or where } appears after alphanumeric text not inside {}
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  // Skip comments and lines that are JS (not JSX text)
  if (l.trim().startsWith('//')) continue;
  
  // Look for } after a word character - likely a stray } in JSX text
  if (/[a-zA-Z0-9"']\}/.test(l)) {
    // But allow patterns like: })  });  }); })  })} }>  })  }]  })
    const cleaned = l.replace(/\}\s*[);,\]>}]/g, '').replace(/\}\s*$/g, '');
    if (/[a-zA-Z0-9"']\}/.test(cleaned)) {
      console.log((i+1) + ': ' + l.trim());
    }
  }
}
