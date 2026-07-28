'use strict';

const fs = require('fs');
const path = require('path');

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
}

module.exports = { writePagesOutputs };