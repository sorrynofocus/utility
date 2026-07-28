'use strict';

const { themeCss, themes } = require('./themes');

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-US') : String(value ?? '');
}

function percent(part, whole) {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function mapEntries(map) {
  if (!(map instanceof Map)) return [];
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderMetric(label, value, note) {
  return `<section class="metric"><div class="metric-value">${esc(value)}</div><div class="metric-label">${esc(label)}</div>${note ? `<div class="metric-note">${esc(note)}</div>` : ''}</section>`;
}

function renderRankPanel(title, rows) {
  if (!rows.length) {
    return `<section class="panel"><div class="panel-head"><h2>${esc(title)}</h2></div><p class="muted">No data available.</p></section>`;
  }
  const max = Math.max(1, ...rows.map((row) => Number(row[1]) || 0));
  const items = rows.map(([label, value], index) => {
    const width = Math.max(4, Math.round(((Number(value) || 0) / max) * 100));
    return `<li class="rank-row"><div class="rank-meta"><span class="rank-index">${index + 1}</span><span class="rank-name" title="${esc(label)}">${esc(label)}</span><b>${num(value)}</b></div><div class="rank-track"><span style="width:${width}%"></span></div></li>`;
  }).join('');
  return `<section class="panel"><div class="panel-head"><h2>${esc(title)}</h2><span class="muted small">Top ${rows.length}</span></div><ol class="rank-list">${items}</ol></section>`;
}

function renderDetectorChips(map) {
  const entries = mapEntries(map);
  if (!entries.length) return '<span class="muted">No detectors</span>';
  return entries.map(([name, count]) => `<span class="chip" title="${esc(name)}">${esc(name)} <b>${num(count)}</b></span>`).join('');
}

function renderOwners(ownership) {
  const parts = [];
  if (ownership.teams && ownership.teams.length) parts.push(`Team: ${ownership.teams.join(', ')}`);
  if (ownership.users && ownership.users.length) parts.push(`User: ${ownership.users.join(', ')}`);
  if (ownership.manager) parts.push(`Manager: ${ownership.manager}`);
  if (ownership.sourceState) parts.push(`Fallback reason: ${ownership.sourceState}`);
  return parts.length ? parts.join(' | ') : ownership.label;
}

function renderFindingRow(finding) {
  return `<li class="finding-row">
    <div><span>Detector</span><b>${esc(finding.detector)}</b></div>
    <div><span>Verified</span><b>${finding.verified ? 'Yes' : 'No'}</b></div>
    <div><span>Path</span><b>${esc(finding.path || 'N/A')}</b></div>
    <div><span>Blame</span><b>${esc(finding.email || 'N/A')}</b></div>
    <div><span>Age</span><b>${esc(finding.daysAgo)} days</b></div>
    <div><span>Link</span><b>${finding.link ? `<a href="${esc(finding.link)}" target="_blank" rel="noopener noreferrer">Open</a>` : 'N/A'}</b></div>
    <div class="wide"><span>Redacted</span><code>${esc(finding.redacted || 'N/A')}</code></div>
  </li>`;
}

function renderRepository(repository, maxRowsPerRepository) {
  const rows = repository.rows.map(renderFindingRow).join('');
  const ownershipText = renderOwners(repository.ownership);
  return `<details class="repo-block">
    <summary><b>${esc(repository.slug)}</b><span>${num(repository.count)} findings</span></summary>
    <div class="repo-body">
      <div class="meta-line"><b>Owner signal:</b> ${esc(ownershipText)}</div>
      <div class="subhead">Detectors</div>
      <div class="chips">${renderDetectorChips(repository.byDetector)}</div>
      <div class="subhead">Sample findings</div>
      ${rows ? `<ul class="finding-list">${rows}</ul>` : `<p class="muted">No sample rows captured. Increase REPORT_MAX_ROWS_PER_REPOSITORY above ${num(maxRowsPerRepository)} to keep more examples.</p>`}
    </div>
  </details>`;
}

function renderGroup(group, maxRowsPerRepository) {
  const repositories = [...group.repositories.values()].sort((a, b) => b.count - a.count);
  const repoLabel = repositories.length === 1 ? 'repository' : 'repositories';
  return `<details class="owner-group" open>
    <summary><b>${esc(group.label)}</b><span>${num(group.total)} findings across ${num(repositories.length)} ${repoLabel}</span></summary>
    <div class="group-body">
      <div class="subhead">Detectors</div>
      <div class="chips">${renderDetectorChips(group.byDetector)}</div>
      ${repositories.map((repository) => renderRepository(repository, maxRowsPerRepository)).join('')}
    </div>
  </details>`;
}

function renderThemeOptions(defaultTheme) {
  return Object.entries(themes).map(([id, theme]) => {
    const selected = id === defaultTheme ? ' selected' : '';
    return `<option value="${esc(id)}"${selected}>${esc(theme.name)}</option>`;
  }).join('');
}

function renderHtmlReport(model, config) {
  const summary = model.summary;
  const generatedAt = config.generatedAt.toISOString().replace('T', ' ').replace('Z', ' UTC');
  const verifiedRate = percent(summary.verifiedCount, summary.totalFindings);
  const repoHitRate = percent(summary.repositoriesWithFindings, summary.repositoriesScanned);
  const defaultTheme = themes[config.defaultTheme] ? config.defaultTheme : 'light';

  return `<!doctype html>
<html lang="en" data-theme="${esc(defaultTheme)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TruffleHog Secret Scan Report</title>
  <style>
    ${themeCss()}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:var(--accent)}main{max-width:1240px;margin:0 auto;padding:28px 18px 44px}header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.title h1{margin:0 0 6px;font-size:28px;letter-spacing:0}.meta{color:var(--muted);display:flex;flex-wrap:wrap;gap:8px 14px}.toolbar{display:flex;gap:8px;align-items:center}.toolbar label{color:var(--muted);font-size:12px}.toolbar select{border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:6px;padding:6px 8px}.metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:18px 0}.metric,.panel,.owner-group{background:var(--panel);border:1px solid var(--border);border-radius:8px}.metric{padding:16px}.metric-value{font-size:28px;font-weight:800}.metric-label{font-weight:700}.metric-note,.muted{color:var(--muted)}.small{font-size:12px}.panel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:12px 0 18px}.panel{padding:16px}.panel-head{display:flex;justify-content:space-between;gap:12px;align-items:center}.panel h2{font-size:16px;margin:0}.rank-list{list-style:none;margin:12px 0 0;padding:0}.rank-row{padding:10px 0;border-top:1px solid var(--border)}.rank-meta{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:8px;align-items:center}.rank-index{color:var(--muted);font-weight:700}.rank-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rank-track{height:8px;background:var(--panel-alt);border-radius:999px;overflow:hidden;margin-top:7px}.rank-track span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-alt));border-radius:999px}.owner-group{margin:12px 0;overflow:hidden}.owner-group>summary,.repo-block>summary{cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;background:var(--panel-alt)}.group-body{padding:14px}.subhead{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:800;margin:12px 0 8px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--border);border-radius:999px;padding:4px 8px;background:var(--panel-alt)}.repo-block{border:1px solid var(--border);border-radius:8px;margin:12px 0;overflow:hidden}.repo-body{padding:12px}.meta-line{padding:8px 10px;background:var(--panel-alt);border-radius:6px}.finding-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.finding-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--panel-alt)}.finding-row div{min-width:0}.finding-row span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em}.finding-row b,.finding-row code{display:block;overflow-wrap:anywhere}.finding-row .wide{grid-column:1/-1}code{font-family:ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}@media(max-width:760px){header{display:block}.toolbar{margin-top:12px}.finding-row{grid-template-columns:1fr}.owner-group>summary,.repo-block>summary{display:block}.owner-group>summary span,.repo-block>summary span{display:block;color:var(--muted);margin-top:4px}}
  </style>
  <script>
    (function(){
      var key = 'trufflehog-report-theme';
      var allowed = ${JSON.stringify(Object.keys(themes))};
      function applyTheme(theme){
        if (allowed.indexOf(theme) === -1) theme = ${JSON.stringify(defaultTheme)};
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem(key, theme); } catch (_) {}
        var select = document.getElementById('themeSelect');
        if (select) select.value = theme;
      }
      var saved = '';
      try { saved = localStorage.getItem(key) || ''; } catch (_) {}
      applyTheme(saved || ${JSON.stringify(defaultTheme)});
      window.addEventListener('DOMContentLoaded', function(){
        var select = document.getElementById('themeSelect');
        if (!select) return;
        select.addEventListener('change', function(){ applyTheme(select.value); });
      });
    })();
  </script>
</head>
<body>
  <main>
    <header>
      <div class="title">
        <h1>TruffleHog Secret Scan Report</h1>
        <div class="meta">
          <span>Target: <b>${esc(config.scanTarget)}</b></span>
          <span>Mode: <b>${esc(config.scanTargetType)}</b></span>
          <span>Visibility: <b>${esc(config.repositoryVisibility)}</b></span>
          <span>Run: <b>${esc(config.runId || 'local')}</b></span>
          <span>Generated: <b>${esc(generatedAt)}</b></span>
        </div>
      </div>
      <div class="toolbar"><label for="themeSelect">Theme</label><select id="themeSelect">${renderThemeOptions(defaultTheme)}</select></div>
    </header>

    <section class="metric-grid">
      ${renderMetric('Total findings', num(summary.totalFindings), `${num(summary.uniqueDetectors)} detector types`)}
      ${renderMetric('Verified rate', verifiedRate, `${num(summary.verifiedCount)} verified findings`)}
      ${renderMetric('Repositories with findings', num(summary.repositoriesWithFindings), `${repoHitRate} of ${num(summary.repositoriesScanned)} scanned`)}
      ${renderMetric('Invalid NDJSON lines', num(summary.invalidLineCount), 'Ignored while building report')}
    </section>

    <section class="panel-grid">
      ${renderRankPanel('Top detectors', model.topDetectors)}
      ${renderRankPanel('Top repositories', model.topRepositories)}
    </section>

    <section>
      <h2>Ownership Details</h2>
      ${model.groups.length ? model.groups.map((group) => renderGroup(group, model.maxRowsPerRepository)).join('') : '<p class="muted">No findings were available for ownership grouping.</p>'}
    </section>
  </main>
</body>
</html>`;
}

module.exports = { esc, renderHtmlReport };