import { parseBlocks, parseInline } from '../../lib/richText.js';

/**
 * The same formatting as RichText but without the paragraph wrappers, for
 * places that are already inside a heading or a label — a quiz option, say.
 */
export function RichInline({ content }) {
  return <Runs runs={parseInline(String(content ?? ''))} />;
}

/**
 * Renders a reply from the AI: paragraphs, lists and emphasis kept, Markdown
 * and LaTeX notation turned into something readable. Everything is rendered as
 * React elements rather than injected HTML, so a model that returns markup
 * cannot put it into the page.
 */
export function RichText({ content, className = '' }) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const spaced = index > 0 ? 'mt-2.5' : undefined;

        if (block.type === 'heading') {
          return (
            <p key={index} className={[spaced, 'font-semibold text-ink'].filter(Boolean).join(' ')}>
              <Runs runs={block.runs} />
            </p>
          );
        }

        if (block.type === 'bullet' || block.type === 'numbered') {
          return (
            <p key={index} className={[spaced, 'flex gap-2'].filter(Boolean).join(' ')}>
              <span aria-hidden="true" className="shrink-0 text-ink-muted">
                {block.type === 'bullet' ? '•' : `${block.marker}.`}
              </span>
              <span>
                <Runs runs={block.runs} />
              </span>
            </p>
          );
        }

        return (
          <p key={index} className={spaced}>
            <Runs runs={block.runs} />
          </p>
        );
      })}
    </div>
  );
}

function Runs({ runs }) {
  return runs.map((run, index) => {
    if (run.code) {
      return (
        <code key={index} className="rounded bg-sunk px-1 py-0.5 font-mono text-[0.9em]">
          {run.text}
        </code>
      );
    }

    if (run.bold) {
      return (
        <strong key={index} className={run.italic ? 'font-semibold italic' : 'font-semibold'}>
          {run.text}
        </strong>
      );
    }

    if (run.italic) {
      return <em key={index}>{run.text}</em>;
    }

    return <span key={index}>{run.text}</span>;
  });
}
