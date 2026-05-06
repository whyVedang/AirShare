import fs from 'fs';
import path from 'path';

function stripConsole(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      stripConsole(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = content.replace(/^[ \t]*console\.log\([^)]*\);?\s*\n?/gm, '');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent);
        console.log("Stripped from:", fullPath);
      }
    }
  }
}
stripConsole('./apps/frontend/src');
