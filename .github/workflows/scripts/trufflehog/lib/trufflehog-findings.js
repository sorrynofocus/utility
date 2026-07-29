'use strict';


//Extracts GitHub source metadata despite TruffleHog casing differences.
// Used by getFindingPath(), getFindingTimestamp(), and normalizeFinding().
function getGitHubMetadata(finding) {
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return data.Github || data.GitHub || {};
}


// Extracts generic Git source metadata from a TruffleHog finding.
// Used by getFindingPath() and normalizeFinding() as a fallback when GitHub metadata is absent.
function getGitMetadata(finding) {
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return data.Git || {};
}


// Parses either owner/repo text or GitHub URLs into a normalized repository slug object.
// Used by normalizeFinding() and exported for callers that need consistent slug parsing.
function parseRepositorySlug(value) {
  if (!value) return null;
  const text = String(value).trim();
  const direct = text.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (direct) return { owner: direct[1], repo: direct[2].replace(/\.git$/i, ''), slug: `${direct[1]}/${direct[2].replace(/\.git$/i, '')}` };
  const url = text.match(/github\.com[:/]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[#?].*)?$/i);
  if (!url) return null;
  return { owner: url[1], repo: url[2], slug: `${url[1]}/${url[2]}` };
}

// Returns the first value that is present and not blank.
// Used throughout normalization to handle alternate TruffleHog field names safely.
function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

// Chooses the best repository-relative file path from a raw finding.
// Used by normalizeFinding(); the result is later passed to CODEOWNERS matching.
function getFindingPath(finding) {
  const github = getGitHubMetadata(finding);
  const git = getGitMetadata(finding);
  const data = finding && finding.SourceMetadata && finding.SourceMetadata.Data ? finding.SourceMetadata.Data : {};
  return String(firstNonEmpty(github.file, github.File, git.file, git.File, data.File, data.file, finding.File, finding.file));
}

// Converts one raw TruffleHog JSON object into the report generator's normalized finding shape.
// Used by parseTruffleHogNdjson(); calls metadata, path, timestamp, repository parsing, and redaction helpers.
function getFindingTimestamp(finding) {
  const github = getGitHubMetadata(finding);
  const extra = finding && finding.ExtraData ? finding.ExtraData : {};
  return firstNonEmpty(github.timestamp, github.date, extra.created_at, extra.timestamp, finding.Date, finding.Timestamp);
}


// Builds a short, non-sensitive fingerprint for a raw secret value.
// Used by normalizeFinding() when TruffleHog does not provide Redacted; preserves known type prefixes when possible.

function maskRawSecretForReport(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const slackMatch = text.match(/^(https:\/\/hooks\.slack\.com\/services\/[^/]+\/[^/]+\/)([^\s/]+)$/);
  if (slackMatch) {
    const secretPart = slackMatch[2];
    return `${slackMatch[1]}${secretPart.slice(0, 4)}...${secretPart.slice(-3)}`;
  }

  const prefixes = ['github_pat_', 'sk-proj-', 'sk_test_', 'ghp_', 'hvs.', 'hvb.', 'hvr.', 'hvc.', 'SG.', 'AKIA'];
  const prefix = prefixes.find((candidate) => text.startsWith(candidate)) || '';
  const body = prefix ? text.slice(prefix.length) : text;
  if (body.length <= 7) return `${prefix}${body.slice(0, 1)}...`;
  return `${prefix}${body.slice(0, 4)}...${body.slice(-3)}`;
}

// Converts one raw TruffleHog JSON object into the report generator's normalized finding shape.
// Used by parseTruffleHogNdjson(); calls metadata, path, timestamp, repository parsing, and redaction helpers.
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
    redacted: firstNonEmpty(raw.Redacted, raw.Raw ? maskRawSecretForReport(raw.Raw) : ''),
    timestamp: getFindingTimestamp(raw),
  };
}

// Parses TruffleHog NDJSON into normalized findings while counting malformed lines.
// Used by gen-th-report.js; calls normalizeFinding() for every valid JSON line.
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
  maskRawSecretForReport,
  normalizeFinding,
  parseRepositorySlug,
  parseTruffleHogNdjson,
};