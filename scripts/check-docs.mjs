import fs from 'node:fs';
import path from 'node:path';

const docsRoot = path.resolve('docs');
const markdownFiles = [];
const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.md')) {
      markdownFiles.push(fullPath);
    }
  }
}

function anchorSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

function collectAnchors(filePath, text) {
  const anchors = new Set();

  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      anchors.add(anchorSlug(heading[2]));
    }
  }

  return anchors;
}

function isExternalTarget(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//');
}

function resolveTarget(fromFile, target) {
  const [targetPath, rawAnchor = ''] = target.split('#');
  const cleanTargetPath = decodeURIComponent(targetPath.split('?')[0]);
  const anchor = rawAnchor.toLowerCase();

  if (!cleanTargetPath) {
    return { resolvedPath: fromFile, anchor };
  }

  let resolvedPath = path.resolve(path.dirname(fromFile), cleanTargetPath);

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    resolvedPath = path.join(resolvedPath, 'README.md');
  }

  return { resolvedPath, anchor };
}

walk(docsRoot);

const fileText = new Map(
  markdownFiles.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')]),
);
const anchorsByFile = new Map(
  markdownFiles.map((filePath) => [filePath, collectAnchors(filePath, fileText.get(filePath))]),
);

for (const [filePath, text] of fileText) {
  let openFenceLine = null;
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      openFenceLine = openFenceLine === null ? index + 1 : null;
    }
  });

  if (openFenceLine !== null) {
    failures.push(`${path.relative(process.cwd(), filePath)}: unclosed code fence opened at line ${openFenceLine}`);
  }

  const linkPattern = /!?\[[^\]\n]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    const target = match[1];

    if (isExternalTarget(target)) {
      continue;
    }

    const { resolvedPath, anchor } = resolveTarget(filePath, target);
    const relativeTarget = path.relative(process.cwd(), resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
      failures.push(`${path.relative(process.cwd(), filePath)}: missing link target ${target} -> ${relativeTarget}`);
      continue;
    }

    if (anchor && resolvedPath.endsWith('.md') && !anchorsByFile.get(resolvedPath)?.has(anchor)) {
      failures.push(`${path.relative(process.cwd(), filePath)}: missing anchor ${target}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation check failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Documentation check passed for ${markdownFiles.length} Markdown files.`);
