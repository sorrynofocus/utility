#!/usr/bin/env node
'use strict';
// Generates the TruffleHog HTML report based on the NDJSON findings and 
// configuration.
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
    try 
    {
      ndjson = fs.readFileSync(config.ndjsonPath, 'utf8');
     } 
    catch (error) 
    {
      console.warn(`[warning] Could not read ${config.ndjsonPath}: ${error.message}`);
    }

 // Parse the NDJSON findings.
  const parseResult = parseTruffleHogNdjson(ndjson);

  // Load the manager map and create the codeowners resolver.
  const managerMap = loadManagerMap(config.managerMapPath);
  
  // Create the codeowners resolver based on the GitHub token availability and 
  // debug setting.
  const resolveCodeowners = createCodeownersResolver({
    enabled: config.githubTokenAvailable,
    debug,
  });

  // Resolve codeowners for each finding.
  const findings = parseResult.findings.map((finding) => ({
    ...finding,
    codeowners: resolveCodeowners(finding),
  }));

  // Build the report model based on the findings and configuration.
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