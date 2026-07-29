'use strict';

const fs = require('fs');
const path = require('path');

// Creates a small docs/index.md only when the repository does not already have one.
// Used by writePagesOutputs() so GitHub Pages has a project root that links into the scan index.
function ensurePagesHome(config) {
  const docsDir = path.dirname(path.dirname(config.scansMarkdownPath));
  const indexPath = path.join(docsDir, 'index.md');

  if (fs.existsSync(indexPath)) {
    return;
  }

  const relativeIndex = path.relative(docsDir, config.scansMarkdownPath).replace(/\\/g, '/');
  const markdown = [
    '# Utility Reports',
    '',
    '- [TruffleHog Scan Reports](' + relativeIndex + ')',
    '',
  ].join('\n');

  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(indexPath, markdown, 'utf8');
  console.log(`[pages] Wrote ${indexPath}`);
}
// Writes optional GitHub Pages-ready report files and a Markdown index.
// Used by gen-th-report.js after reports/index.html is rendered; calls ensurePagesHome() and copies HTML only when REPORT_PUBLISH_PAGES is enabled.
function writePagesOutputs(config) {
  if (!config.publishPages) {
    console.log('[pages] Skipping docs/scans output because REPORT_PUBLISH_PAGES is false.');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const destFile = path.join(config.pagesDestDir, `trufflehog-scan-${today}.html`);

  fs.mkdirSync(config.pagesDestDir, { recursive: true });
  fs.copyFileSync(config.outputHtmlPath, destFile);
  console.log(`[pages] Copied report to ${destFile}`);

  const files = fs.readdirSync(config.pagesDestDir)
    .filter((file) => /^trufflehog-scan-\d{4}-\d{2}-\d{2}\.html$/.test(file))
    .sort()
    .reverse();

  const markdown = [
    '# TruffleHog Scan Reports',
    '',
    'The following TruffleHog secret scan reports are available:',
    '',
    ...files.map((file) => {
      const match = file.match(/trufflehog-scan-(\d{4}-\d{2}-\d{2})\.html/);
      const date = match ? match[1] : file;
      return `- [Scan ${date}](trufflehog/${file})`;
    }),
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(config.scansMarkdownPath), { recursive: true });
  fs.writeFileSync(config.scansMarkdownPath, markdown, 'utf8');
  console.log(`[pages] Wrote ${config.scansMarkdownPath}`);

  ensurePagesHome(config);
}

module.exports = { writePagesOutputs };