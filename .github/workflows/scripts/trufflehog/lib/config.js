'use strict';

const fs = require('fs');
const path = require('path');

// Converts environment-style text values into booleans.
// Used by loadConfig() for feature flags such as REPORT_DEBUG and REPORT_PUBLISH_PAGES.
function boolFromEnv(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

// Converts an environment value into a non-negative number with a safe fallback.
// Used by loadConfig() for numeric report limits such as REPORT_MAX_ROWS_PER_REPOSITORY.
function numberFromEnv(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

/**
 * Resolves a path-like config value relative to the GitHub workspace when needed.
 * Used by loadConfig() so the workflow can move between local folders and repositories.
 */
function resolveWorkspacePath(workspace, value) {
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.join(workspace, value);
}

// Resolves a path-like config value relative to the GitHub workspace when needed.
// Used by loadConfig() so the workflow can move between local folders and repositories.
function loadConfig(env = process.env) {
  const workspace = env.GITHUB_WORKSPACE || process.cwd();
  const reportsDir = resolveWorkspacePath(workspace, env.REPORT_OUTPUT_DIR || 'reports');
  const defaultManagerMapPath = path.join(__dirname, '..', '..', '..', 'conf', 'team-repo-em.json');

  return {
    workspace,
    reportsDir,
    ndjsonPath: resolveWorkspacePath(workspace, env.TRUFFLEHOG_NDJSON_PATH || 'reports/_merged.ndjson'),
    outputHtmlPath: resolveWorkspacePath(workspace, env.REPORT_HTML_PATH || 'reports/index.html'),
    reposTxtPath: resolveWorkspacePath(workspace, env.REPOSITORY_LIST_PATH || 'repos.txt'),
    pagesDestDir: resolveWorkspacePath(workspace, env.REPORT_PAGES_DIR || 'docs/scans/trufflehog'),
    scansMarkdownPath: resolveWorkspacePath(workspace, env.REPORT_INDEX_MARKDOWN_PATH || 'docs/scans/trufflehog.md'),
    managerMapPath: resolveWorkspacePath(workspace, env.REPORT_MANAGER_MAP_PATH || defaultManagerMapPath),
    scanTargetType: env.SCAN_TARGET_TYPE || 'org',
    scanTarget: env.SCAN_TARGET || 'unknown-target',
    repositoryVisibility: env.REPOSITORY_VISIBILITY || 'private',
    scanProfile: env.TRUFFLEHOG_SCAN_PROFILE || 'strict',
    scanFlags: env.TRUFFLEHOG_SCAN_FLAGS || '',
    runId: env.RUN_ID || env.GITHUB_RUN_ID || '',
    maxRowsPerRepository: numberFromEnv(env.REPORT_MAX_ROWS_PER_REPOSITORY, 300),
    defaultTheme: env.REPORT_THEME_DEFAULT || 'light',
    debug: boolFromEnv(env.REPORT_DEBUG, false),
    publishPages: boolFromEnv(env.REPORT_PUBLISH_PAGES, false),
    githubTokenAvailable: Boolean(env.GH_TOKEN || env.SCAN_GITHUB_TOKEN || env.GITHUB_TOKEN),
    generatedAt: new Date(),
    readReposScannedCount() {
      try {
        return fs.readFileSync(this.reposTxtPath, 'utf8').split(/\r?\n/).filter(Boolean).length;
      } catch (_) {
        return 0;
      }
    },
  };
}

module.exports = { boolFromEnv, loadConfig, numberFromEnv };