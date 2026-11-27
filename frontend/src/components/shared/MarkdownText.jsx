import React from 'react';

/**
 * Safe lightweight Markdown renderer with normalized heading hierarchy.
 * Shifts the top markdown heading level inside each message to <h2> so messages
 * nested under a page <h1> never skip heading levels (WCAG 100/100).
 */
export default function MarkdownText({ content, baseLevel = 2 }) {
    if (!content) return null;
    const lines = String(content).split('\n');
    const headingLevels = lines
        .map((line) => line.match(/^(#{1,6})\s/)?.[1]?.length)
        .filter(Boolean);
    const minLevel = headingLevels.length ? Math.min(...headingLevels) : baseLevel;
    const elements = [];
    let listItems = [];
    let key = 0;

    const flushList = () => {
        if (listItems.length) {
            elements.push(<ul key={key++} className="md-list">{listItems}</ul>);
            listItems = [];
        }
    };

    const renderInline = (text) => {
        const parts = String(text).split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
        return parts.map((p, i) => {
            if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
            if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
            if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="md-code">{p.slice(1, -1)}</code>;
            return p;
        });
    };

    const isTableSeparator = (row = '') => /^\|\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(row.trim());
    const parseTableCells = (row = '') =>
        row
            .trim()
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split('|')
            .map((cell) => cell.trim());

    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        const nextLine = lines[idx + 1] || '';

        if (line.trim().includes('|') && isTableSeparator(nextLine)) {
            flushList();
            const headers = parseTableCells(line);
            idx += 1; // skip separator
            const bodyRows = [];
            while (idx + 1 < lines.length && lines[idx + 1].trim().includes('|') && !isTableSeparator(lines[idx + 1])) {
                idx += 1;
                bodyRows.push(parseTableCells(lines[idx]));
            }
            elements.push(
                <div key={key++} className="table-wrapper" style={{ margin: '10px 0' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                {headers.map((h, hi) => (
                                    <th key={hi}>{renderInline(h)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {bodyRows.map((row, ri) => (
                                <tr key={ri}>
                                    {headers.map((_, ci) => (
                                        <td key={ci}>{renderInline(row[ci] ?? '')}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        if (line.match(/^#{1,6}\s/)) {
            flushList();
            const level = line.match(/^(#+)/)[1].length;
            const text = line.replace(/^#+\s*/, '');
            const normalizedLevel = Math.min(6, Math.max(baseLevel, baseLevel + (level - minLevel)));
            const Tag = `h${normalizedLevel}`;
            elements.push(<Tag key={key++} className={`md-h${Math.min(level, 3)}`}>{renderInline(text)}</Tag>);
        } else if (line.match(/^[-*] /)) {
            listItems.push(<li key={key++}>{renderInline(line.replace(/^[-*] /, ''))}</li>);
        } else if (line.match(/^\d+\. /)) {
            flushList();
            elements.push(<p key={key++} className="md-numbered">{renderInline(line)}</p>);
        } else if (line.trim() === '') {
            flushList();
            elements.push(<br key={key++} />);
        } else {
            flushList();
            elements.push(<p key={key++} className="md-p">{renderInline(line)}</p>);
        }
    }
    flushList();
    return <div className="markdown-content">{elements}</div>;
}
