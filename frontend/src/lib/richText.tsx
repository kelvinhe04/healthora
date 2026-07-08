import type { ReactNode } from 'react';

/** Splits a single line on **bold** markers and wraps the matched spans in <strong>. */
export function renderInlineText(text: string, keyPrefix: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part !== '');
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  );
}

/**
 * Minimal, dependency-free formatting for admin-authored product text (usage, ingredients,
 * warnings, custom tabs): **bold** spans, lines starting with "- " become a bullet list,
 * blank lines separate paragraphs. Mirrors the syntax hinted next to the admin textareas.
 */
export function renderRichText(text: string): ReactNode {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} style={{ margin: '4px 0', paddingLeft: 18 }}>
        {listBuffer.map((item, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {renderInlineText(item, `${key}-item-${i}`)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      listBuffer.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${i}`);
    if (trimmed === '') return;
    blocks.push(
      <p key={`p-${i}`} style={{ margin: 0 }}>
        {renderInlineText(line, `p-${i}`)}
      </p>,
    );
  });
  flushList('list-end');

  return <>{blocks}</>;
}
