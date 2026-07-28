#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { loadConfig } = require('./lib/config');
const { parseTruffleHogNdjson } = require('./lib/trufflehog-findings');
const { createCodeownersResolver } = require('./lib/github-codeowners');
const { buildReportModel, loadManagerMap } = require('./lib/report-model');
const { renderHtmlReport } = require('./lib/html-report');
const { writePagesOutputs } = require('./lib/pages-output');

function main() {
  const config = loadConfig(process.env);
  const debug = (...args) => {
    if (config.debug) console.log('[debug]', ...args);
  };

  let ndjson = '';
  try {
    ndjson = fs.readFileSync(config.ndjsonPath, 'utf8');
  } catch (error) {
    console.warn(`[warning] Could not read ${config.ndjsonPath}: ${error.message}`);
  }

  const parseResult = parseTruffleHogNdjson(ndjson);
  const managerMap = loadManagerMap(config.managerMapPath);
  const resolveCodeowners = createCodeownersResolver({
    enabled: config.githubTokenAvailable,
    debug,
  });

  const findings = parseResult.findings.map((finding) => ({
    ...finding,
    codeowners: resolveCodeowners(finding),
  }));

  const model = buildReportModel(findings, {
    maxRowsPerRepository: config.maxRowsPerRepository,
    managerMap,
    reposScanned: config.readReposScannedCount(),
    invalidLineCount: parseResult.invalidLineCount,
  });

  fs.mkdirSync(config.reportsDir, { recursive: true });
  fs.writeFileSync(config.outputHtmlPath, renderHtmlReport(model, config), 'utf8');
  console.log(`Wrote ${config.outputHtmlPath} (findings=${model.summary.totalFindings}, repositories=${model.summary.repositoriesWithFindings})`);

  writePagesOutputs(config);
}

main();