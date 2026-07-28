'use strict';

const fs = require('fs');

const FALLBACK_ELIGIBLE_STATES = new Set([
  'codeowners-unavailable',
  'no-codeowners',
  'no-rule-match',
  'unresolved-repository',
]);

const OWNERSHIP_LABELS = {
  'team-owned': 'CODEOWNERS team',
  'fallback-map': 'Fallback map',
  'user-owned': 'CODEOWNERS user',
  'codeowners-unavailable': 'CODEOWNERS unavailable',
  'no-codeowners': 'No CODEOWNERS file',
  'no-rule-match': 'No CODEOWNERS rule match',
  'unresolved-repository': 'Unresolved repository',
};

function loadManagerMap(filePath) {
  const map = new Map();
  if (!filePath || !fs.existsSync(filePath)) return map;

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) return map;

  for (const entry of parsed) {
    const repo = String(entry.repo || entry.repository || '').trim();
    if (!repo) continue;
    map.set(repo.toLowerCase(), {
      repo,
      team: String(entry.team || entry.owner || '').trim(),
      manager: String(entry.manager || entry.EM || entry.engineeringManager || '').trim(),
    });
  }

  return map;
}

function mapToSortedArray(map, limit) {
  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);
  return Number.isFinite(limit) ? rows.slice(0, limit) : rows;
}

function daysAgo(value) {
  if (!value) return 'N/A';
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return 'N/A';
  const diffMs = Date.now() - ms;
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'N/A';
  return String(Math.floor(diffMs / 86400000));
}

function getFallback(managerMap, repoSlug) {
  return managerMap.get(String(repoSlug || '').toLowerCase()) || null;
}

function resolveOwnership(finding, managerMap) {
  const codeowners = finding.codeowners || { state: 'codeowners-unavailable', teams: [], users: [] };
  const fallback = getFallback(managerMap, finding.repoSlug);

  if (codeowners.state === 'team-owned') {
    return {
      state: 'team-owned',
      label: codeowners.teams.join(', '),
      groupKey: `team:${codeowners.teams.join(',')}`,
      groupLabel: codeowners.teams.join(', '),
      teams: codeowners.teams,
      users: codeowners.users || [],
      manager: fallback ? fallback.manager : '',
      fallback,
    };
  }

  if (fallback && FALLBACK_ELIGIBLE_STATES.has(codeowners.state)) {
    const label = fallback.team || fallback.manager || 'Fallback map';
    return {
      state: 'fallback-map',
      label,
      groupKey: `fallback:${label}`,
      groupLabel: label,
      teams: fallback.team ? [fallback.team] : [],
      users: codeowners.users || [],
      manager: fallback.manager || '',
      fallback,
      sourceState: codeowners.state,
    };
  }

  if (codeowners.state === 'user-owned') {
    return {
      state: 'user-owned',
      label: codeowners.users.join(', '),
      groupKey: 'user-owned',
      groupLabel: 'CODEOWNERS user-owned repositories',
      teams: [],
      users: codeowners.users,
      manager: fallback ? fallback.manager : '',
      fallback,
    };
  }

  const state = codeowners.state || 'codeowners-unavailable';
  return {
    state,
    label: OWNERSHIP_LABELS[state] || state,
    groupKey: state,
    groupLabel: OWNERSHIP_LABELS[state] || state,
    teams: [],
    users: [],
    manager: fallback ? fallback.manager : '',
    fallback,
  };
}

function ensureGroup(groups, ownership) {
  if (!groups.has(ownership.groupKey)) {
    groups.set(ownership.groupKey, {
      key: ownership.groupKey,
      label: ownership.groupLabel,
      state: ownership.state,
      total: 0,
      byDetector: new Map(),
      repositories: new Map(),
    });
  }
  return groups.get(ownership.groupKey);
}

function ensureRepository(group, finding, ownership) {
  if (!group.repositories.has(finding.repoSlug)) {
    group.repositories.set(finding.repoSlug, {
      slug: finding.repoSlug,
      count: 0,
      byDetector: new Map(),
      rows: [],
      ownership,
    });
  }
  return group.repositories.get(finding.repoSlug);
}

function addCount(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function buildReportModel(findings, options = {}) {
  const managerMap = options.managerMap || new Map();
  const maxRowsPerRepository = Number.isFinite(options.maxRowsPerRepository) ? options.maxRowsPerRepository : 300;
  const byDetector = new Map();
  const byRepository = new Map();
  const groups = new Map();
  let verifiedCount = 0;

  for (const finding of findings) {
    const ownership = resolveOwnership(finding, managerMap);
    const group = ensureGroup(groups, ownership);
    const repository = ensureRepository(group, finding, ownership);

    if (finding.verified) verifiedCount += 1;
    addCount(byDetector, finding.detector);
    addCount(byRepository, finding.repoSlug);
    addCount(group.byDetector, finding.detector);
    addCount(repository.byDetector, finding.detector);
    group.total += 1;
    repository.count += 1;

    if (repository.rows.length < maxRowsPerRepository) {
      repository.rows.push({ ...finding, daysAgo: daysAgo(finding.timestamp), ownership });
    }
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    const order = { 'team-owned': 1, 'fallback-map': 2, 'user-owned': 3 };
    const left = order[a.state] || 10;
    const right = order[b.state] || 10;
    if (left !== right) return left - right;
    return b.total - a.total;
  });

  return {
    summary: {
      totalFindings: findings.length,
      verifiedCount,
      uniqueDetectors: byDetector.size,
      repositoriesWithFindings: byRepository.size,
      repositoriesScanned: options.reposScanned || 0,
      invalidLineCount: options.invalidLineCount || 0,
    },
    topDetectors: mapToSortedArray(byDetector, 10),
    topRepositories: mapToSortedArray(byRepository, 10),
    groups: sortedGroups,
    maxRowsPerRepository,
  };
}

module.exports = {
  OWNERSHIP_LABELS,
  buildReportModel,
  daysAgo,
  loadManagerMap,
  resolveOwnership,
};