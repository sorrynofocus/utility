'use strict';

function getGitHubMetadata(finding) {
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return data.Github || data.GitHub || {};
}

function getGitMetadata(finding) {
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return data.Git || {};
}

function parseRepositorySlug(value) {
  if (!value) return null;
  const text = String(value).trim();
  const direct = text.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (direct) return { owner: direct[1], repo: direct[2].replace(/\.git$/i, ''), slug: `${direct[1]}/${direct[2].replace(/\.git$/i, '')}` };
  const url = text.match(/github\.com[:/]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?].*)?$/i);
  if (!url) return null;
  return { owner: url[1], repo: url[2], slug: `${url[1]}/${url[2]}` };
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function getFindingPath(finding) {
  const github = getGitHubMetadata(finding);
  const git = getGitMetadata(finding);
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return String(firstNonEmpty(github.file, github.File, git.file, git.File, data.File, data.file, finding.File, finding.file));
}

function getFindingTimestamp(finding) {
  const github = getGitHubMetadata(finding);
  const extra = finding && finding.ExtraData ? finding.ExtraData : {};
  return firstNonEmpty(github.timestamp, github.date, extra.created_at, extra.timestamp, finding.Date, finding.Timestamp);
}

function normalizeFinding(raw) {
  if (!raw || !raw.DetectorName) return null;
  const github = getGitHubMetadata(raw);
  const git = getGitMetadata(raw);
  const repositoryValue = firstNonEmpty(github.repository, github.Repository, raw.Repository, git.repository, git.Repository);
  const parsedRepo = parseRepositorySlug(repositoryValue);
  const detector = raw.DetectorName === 'CustomRegex' && raw.DetectorDescription
    ? raw.DetectorDescription
    : raw.DetectorName;

  return {
    raw,
    detector,
    detectorName: raw.DetectorName,
    detectorDescription: raw.DetectorDescription || '',
    repoSlug: parsedRepo ? parsedRepo.slug : 'UNRESOLVED_REPOSITORY',
    owner: parsedRepo ? parsedRepo.owner : '',
    repo: parsedRepo ? parsedRepo.repo : '',
    repositoryUrl: repositoryValue || '',
    path: getFindingPath(raw),
    link: firstNonEmpty(github.link, github.Link, git.link, git.Link),
    email: firstNonEmpty(github.email, github.Email, git.email, git.Email),
    verified: Boolean(raw.Verified),
    redacted: firstNonEmpty(raw.Redacted, raw.Raw ? '[raw value omitted]' : ''),
    timestamp: getFindingTimestamp(raw),
  };
}

function parseTruffleHogNdjson(text) {
  const findings = [];
  let invalidLineCount = 0;

  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const normalized = normalizeFinding(JSON.parse(line));
      if (normalized) findings.push(normalized);
    } catch (_) {
      invalidLineCount += 1;
    }
  }

  return { findings, invalidLineCount };
}

module.exports = {
  getFindingPath,
  normalizeFinding,
  parseRepositorySlug,
  parseTruffleHogNdjson,
};