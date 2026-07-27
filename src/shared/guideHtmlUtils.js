'use strict';

function escapeHtml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/<\/script/gi, '<\\/script')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function safeId(value, fallback = 'item') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function safeLinkUrl(value = '') {
  const url = String(value || '').trim();
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^\/(?!\/)[^\s]*$/.test(url)) return url;
  if (/^#[a-z][a-z0-9_-]*$/i.test(url)) return url;
  return '';
}

function renderInlineMarkdown(value = '') {
  const replacements = [];
  const tokenized = String(value || '').replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_match, label, rawUrl) => {
      const url = safeLinkUrl(rawUrl);
      const renderedLabel = escapeHtml(label);
      if (!url) return renderedLabel;
      const external = /^https?:\/\//i.test(url);
      const html = `<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${renderedLabel}</a>`;
      const token = `\u0000LINK${replacements.length}\u0000`;
      replacements.push(html);
      return token;
    }
  );

  let html = escapeHtml(tokenized)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  replacements.forEach((replacement, index) => {
    html = html.replace(`\u0000LINK${index}\u0000`, replacement);
  });
  return html;
}

function isTableSeparator(line = '') {
  const cells = String(line).trim().replace(/^\||\|$/g, '').split('|');
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function tableCells(line = '') {
  return String(line)
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(cell => cell.trim());
}

function renderMarkdownTable(lines, startIndex, caption) {
  const headers = tableCells(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;
  while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
    rows.push(tableCells(lines[index]));
    index += 1;
  }
  const columnCount = headers.length;
  return {
    html: `<div class="guide-v2-table-wrap"><table><caption>${escapeHtml(caption || 'Tabela do guia')}</caption><thead><tr>${headers.map(header => `<th scope="col">${renderInlineMarkdown(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${Array.from({ length: columnCount }, (_, cellIndex) => `<td>${renderInlineMarkdown(row[cellIndex] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    nextIndex: index
  };
}

function renderMarkdownSafe(markdown = '', options = {}) {
  let lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  if (options.stripFirstHeading !== false) {
    const firstContentIndex = lines.findIndex(line => line.trim());
    if (firstContentIndex >= 0 && /^#{1,6}\s+/.test(lines[firstContentIndex])) {
      lines = lines.filter((_line, index) => index !== firstContentIndex);
    }
  }

  const output = [];
  let index = 0;
  let listType = null;
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const minimum = Number(options.minimumHeadingLevel || 3);
      const level = Math.min(6, Math.max(minimum, heading[1].length));
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (
      /^\s*\|.*\|\s*$/.test(line)
      && index + 1 < lines.length
      && isTableSeparator(lines[index + 1])
    ) {
      closeList();
      const rendered = renderMarkdownTable(lines, index, options.tableCaption);
      output.push(rendered.html);
      index = rendered.nextIndex;
      continue;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      const nextListType = ordered ? 'ol' : 'ul';
      if (listType !== nextListType) {
        closeList();
        listType = nextListType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInlineMarkdown((ordered || unordered)[1])}</li>`);
      index += 1;
      continue;
    }

    if (/^>\s*/.test(trimmed)) {
      closeList();
      output.push(`<blockquote>${renderInlineMarkdown(trimmed.replace(/^>\s*/, ''))}</blockquote>`);
      index += 1;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      closeList();
      output.push('<hr>');
      index += 1;
      continue;
    }

    closeList();
    const paragraph = [trimmed];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim()
      && !/^(#{1,6})\s+/.test(lines[index].trim())
      && !/^[-*+]\s+/.test(lines[index].trim())
      && !/^\d+\.\s+/.test(lines[index].trim())
      && !/^>\s*/.test(lines[index].trim())
      && !(
        /^\s*\|.*\|\s*$/.test(lines[index])
        && index + 1 < lines.length
        && isTableSeparator(lines[index + 1])
      )
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
  }
  closeList();
  return output.join('\n');
}

function formatDatePtBr(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function formatIntegerPtBr(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR').format(number) : '';
}

function yesNoPt(value) {
  return value === true ? 'Sim' : 'Não';
}

module.exports = {
  escapeHtml,
  safeJsonForHtml,
  safeId,
  safeLinkUrl,
  renderInlineMarkdown,
  renderMarkdownSafe,
  formatDatePtBr,
  formatIntegerPtBr,
  yesNoPt
};
