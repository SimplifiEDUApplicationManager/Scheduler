/**
 * Minimal Markdown renderer — handles the subset coordinators actually use:
 *   ## Heading, ### Heading
 *   **bold**, *italic*
 *   - unordered list items
 *   Blank-line paragraph breaks
 *
 * Returns an array of ReactNodes suitable for rendering in a <div>.
 */
import type { ReactNode } from 'react';

type Segment = { type: 'bold'; text: string } | { type: 'italic'; text: string } | { type: 'text'; text: string };

function parseInline(raw: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Match **bold** and *italic* interleaved with plain text
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) nodes.push(raw.slice(last, m.index));
    if (m[2] !== undefined) nodes.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] !== undefined) nodes.push(<em key={key++}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < raw.length) nodes.push(raw.slice(last));
  return nodes;
}

export function renderMarkdown(text: string): ReactNode {
  if (!text.trim()) return null;
  const blocks = text.split(/\n{2,}/);
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Heading: ## or ###
    const h2 = trimmed.match(/^#{1,2}\s+(.+)/);
    if (h2) {
      nodes.push(<h3 key={key++} style={{ fontSize: 13, fontWeight: 700, color: '#18181B', margin: '14px 0 4px', letterSpacing: '-0.01em' }}>{h2[1]}</h3>);
      continue;
    }
    const h3 = trimmed.match(/^###\s+(.+)/);
    if (h3) {
      nodes.push(<h4 key={key++} style={{ fontSize: 12, fontWeight: 700, color: '#3F3F46', margin: '10px 0 2px', letterSpacing: '0.01em', textTransform: 'uppercase' }}>{h3[1]}</h4>);
      continue;
    }

    // Unordered list: lines starting with - or *
    const listLines = trimmed.split('\n').filter(Boolean);
    const isList = listLines.every(l => /^[-*]\s/.test(l));
    if (isList) {
      nodes.push(
        <ul key={key++} style={{ margin: '6px 0', paddingLeft: 18, listStyle: 'disc' }}>
          {listLines.map((l, i) => (
            <li key={i} style={{ fontSize: 13, color: '#3F3F46', lineHeight: 1.6, marginBottom: 2 }}>
              {parseInline(l.replace(/^[-*]\s+/, ''))}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph (possibly multi-line)
    const lines = trimmed.split('\n').filter(Boolean);
    nodes.push(
      <p key={key++} style={{ fontSize: 13, color: '#3F3F46', lineHeight: 1.65, margin: '0 0 10px' }}>
        {lines.flatMap((line, i) => i < lines.length - 1 ? [...parseInline(line), <br key={`br-${i}`} />] : parseInline(line))}
      </p>,
    );
  }

  return <>{nodes}</>;
}
