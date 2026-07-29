'use strict';

const { execFileSync } = require('child_process');

const CODEOWNERS_CANDIDATES = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'];

// Runs the GitHub CLI and returns trimmed stdout.
// Used by resolveDefaultBranch() and fetchCodeownersFiles() for GitHub API access.
function shellOut(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Converts a CODEOWNERS glob pattern into a JavaScript regular expression.
// Used by parseCodeowners() so matchOwnersForPath() can test repository-relative paths.
function globToRegExp(glob) {
  const original = String(glob || '').trim();
  if (!original || original === '*') return /^.*$/;

  let pattern = original.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  pattern = pattern.replace(/\*\*/g, '::DOUBLE_STAR::');
  pattern = pattern.replace(/\*/g, '[^/]*');
  pattern = pattern.replace(/\?/g, '[^/]');
  pattern = pattern.replace(/::DOUBLE_STAR::/g, '.*');

  if (original.startsWith('/')) return new RegExp(`^${pattern.replace(/^\//, '')}$`);
  if (!original.includes('/')) return new RegExp(`(^|/)${pattern}$`);
  return new RegExp(`(^|/)${pattern}$`);
}

// Parses CODEOWNERS text into ordered pattern/owner entries.
// Used by buildResolver(); calls globToRegExp() for each parsed ownership rule.
function parseCodeowners(text) {
  const entries = [];
  for (const rawLine of String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const withoutComment = rawLine.replace(/#.*$/, '').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim();
    if (!withoutComment) continue;
    const parts = withoutComment.split(' ');
    if (parts.length < 2) continue;
    entries.push({
      pattern: parts[0],
      owners: parts.slice(1),
      regex: globToRegExp(parts[0]),
    });
  }
  return entries;
}

// Filters CODEOWNERS owners down to GitHub team handles such as @owner/team.
// Used by createCodeownersResolver() after matchOwnersForPath() returns raw owners.
function teamsFromOwners(owners) {
  return [...new Set((owners || []).filter((owner) => typeof owner === 'string' && /^@[^/\s]+\/[^/\s]+$/.test(owner)))];
}

// Filters CODEOWNERS owners down to individual GitHub user handles such as @octocat.
// Used by createCodeownersResolver() to distinguish user-owned from team-owned paths.
function usersFromOwners(owners) {
  return [...new Set((owners || []).filter((owner) => typeof owner === 'string' && /^@[^/\s]+$/.test(owner)))];
}


// Looks up the default branch for a repository through gh repo view.
// Used by buildResolver() before fetching CODEOWNERS from branch-specific contents URLs.

function resolveDefaultBranch(owner, repo, debug) {
  try {
    return shellOut(['repo', 'view', `${owner}/${repo}`, '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name']);
  } catch (error) {
    debug('default-branch-unavailable', `${owner}/${repo}`, error.message);
    return '';
  }
}

// Looks up the default branch for a repository through gh repo view.
// Used by buildResolver() before fetching CODEOWNERS from branch-specific contents URLs.
function fetchCodeownersFiles(owner, repo, refName, debug) {
  const files = [];
  for (const candidate of CODEOWNERS_CANDIDATES) {
    const apiPath = refName
      ? `repos/${owner}/${repo}/contents/${candidate}?ref=${encodeURIComponent(refName)}`
      : `repos/${owner}/${repo}/contents/${candidate}`;
    try {
      const text = shellOut(['api', '-H', 'Accept: application/vnd.github.raw', apiPath]);
      if (text) files.push({ path: candidate, text });
    } catch (error) {
      debug('codeowners-miss', `${owner}/${repo}`, candidate, error.message);
    }
  }
  return files;
}


// Builds a cached resolver object for one repository's CODEOWNERS state.
// Used by createCodeownersResolver(); calls resolveDefaultBranch(), fetchCodeownersFiles(), and parseCodeowners().
function buildResolver(owner, repo, debug) {
  const refName = resolveDefaultBranch(owner, repo, debug);
  const files = fetchCodeownersFiles(owner, repo, refName, debug);
  const entries = [];

  for (const candidate of CODEOWNERS_CANDIDATES) {
    const file = files.find((item) => item.path === candidate);
    if (file) entries.push(...parseCodeowners(file.text));
  }

  return {
    owner,
    repo,
    refName,
    files: files.map((file) => file.path),
    hasCodeowners: files.length > 0,
    entries,
  };
}

// Applies CODEOWNERS precedence and returns the owners for a specific file path.
// Used by createCodeownersResolver(); consumes resolver entries built by buildResolver().
function matchOwnersForPath(resolver, repoRelativePath) {
  const normalizedPath = String(repoRelativePath || '').replace(/\\/g, '/').replace(/^\//, '');
  if (!resolver || !resolver.entries.length || !normalizedPath) return [];

  let owners = [];
  for (const entry of resolver.entries) {
    if (entry.regex.test(normalizedPath)) owners = entry.owners;
  }
  return owners;
}

// Creates the per-finding CODEOWNERS lookup function used during report generation.
// Used by gen-th-report.js; calls buildResolver(), matchOwnersForPath(), teamsFromOwners(), and usersFromOwners().
function createCodeownersResolver(options = {}) {
  const enabled = Boolean(options.enabled);
  const debug = typeof options.debug === 'function' ? options.debug : () => {};
  const cache = new Map();

  return function resolveFindingCodeowners(finding) {
    if (!finding || !finding.owner || !finding.repo) {
      return { state: 'unresolved-repository', teams: [], users: [], owners: [], files: [] };
    }

    if (!enabled) {
      return { state: 'codeowners-unavailable', teams: [], users: [], owners: [], files: [] };
    }

    const slug = `${finding.owner}/${finding.repo}`;
    if (!cache.has(slug)) cache.set(slug, buildResolver(finding.owner, finding.repo, debug));
    const resolver = cache.get(slug);

    if (!resolver.hasCodeowners) {
      return { state: 'no-codeowners', teams: [], users: [], owners: [], files: [] };
    }

    const owners = matchOwnersForPath(resolver, finding.path);
    const teams = teamsFromOwners(owners);
    const users = usersFromOwners(owners);

    if (teams.length) return { state: 'team-owned', teams, users, owners, files: resolver.files };
    if (users.length) return { state: 'user-owned', teams: [], users, owners, files: resolver.files };
    return { state: 'no-rule-match', teams: [], users: [], owners, files: resolver.files };
  };
}

module.exports = {
  CODEOWNERS_CANDIDATES,
  createCodeownersResolver,
  globToRegExp,
  parseCodeowners,
  teamsFromOwners,
  usersFromOwners,
};