import { useEffect, useRef, useState } from 'react';

import { Button } from './ui/Button.jsx';
import { Notice } from './ui/Feedback.jsx';
import { RichText } from './ui/RichText.jsx';
import { Textarea } from './ui/Field.jsx';
import { api } from '../lib/api.js';

/**
 * Ask one thing, get it answered, close it.
 *
 * A question that has nothing to do with any plan should not require building
 * a plan first. This asks without a goal attached — the doubt is the whole of
 * it — and lives behind a floating button so it is reachable from the
 * dashboard without taking space from the goals.
 */
export function QuickDoubt() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const ask = async (event) => {
    event.preventDefault();

    const trimmed = question.trim();
    if (trimmed.length < 3 || sending) return;

    setSending(true);
    setError(null);
    setQuestion('');
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);

    try {
      const payload = conversationId
        ? await api.doubts.reply(conversationId, trimmed)
        : await api.doubts.ask(trimmed);

      setConversationId(payload.conversation.id);
      setMessages(payload.conversation.messages);
    } catch (caught) {
      setError(caught);
      // Give the question back rather than losing what they typed.
      setQuestion(trimmed);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const startOver = () => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setQuestion('');
    inputRef.current?.focus();
  };

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Ask a quick doubt"
          className="fixed bottom-24 right-4 z-40 flex max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)] sm:right-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="eyebrow">Quick doubt</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">Ask anything, right now</p>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={startOver}
                  className="ease-lakshya rounded-lg px-2 py-1 text-xs text-ink-muted transition hover:bg-sunk hover:text-ink"
                >
                  New
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ease-lakshya flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition hover:bg-sunk hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <p className="text-sm leading-relaxed text-ink-muted">
                No goal, no setup. Just ask whatever you&rsquo;re stuck on and it
                gets answered here.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {messages.map((message, index) => (
                  <li
                    key={index}
                    className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className={[
                        'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                        message.role === 'user'
                          ? 'bg-ink text-paper'
                          : 'border border-line bg-sunk text-ink',
                      ].join(' ')}
                    >
                      {message.role === 'user' ? (
                        message.content
                      ) : (
                        <RichText content={message.content} />
                      )}
                    </div>
                  </li>
                ))}
                {sending && (
                  <li className="flex justify-start">
                    <div className="flex gap-1.5 rounded-2xl border border-line bg-sunk px-4 py-3">
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted"
                          style={{ animationDelay: `${delay}ms` }}
                        />
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={ask} className="border-t border-line p-3">
            {error && (
              <div className="mb-2">
                <Notice tone="error" title="That did not send">
                  {error.message}
                </Notice>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) ask(event);
                }}
                rows={2}
                placeholder="Why does a deadlock need all four conditions?"
                className="flex-1"
              />
              <Button
                type="submit"
                variant="accent"
                loading={sending}
                disabled={question.trim().length < 3}
              >
                Ask
              </Button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-label={open ? 'Close quick doubt' : 'Ask a quick doubt'}
        aria-expanded={open}
        className={[
          'ease-lakshya fixed bottom-6 right-4 z-40 flex h-14 items-center gap-2.5 rounded-full px-5',
          'bg-saffron text-on-accent shadow-[var(--shadow-lift)] transition duration-200',
          'hover:-translate-y-0.5 active:translate-y-0 sm:right-6',
        ].join(' ')}
      >
        {open ? <CloseIcon /> : <SparkIcon />}
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask a doubt'}</span>
      </button>
    </>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.2 3.5 10.6 8l4.5 1.4-4.5 1.4-1.4 4.5-1.4-4.5L3.3 9.4 7.8 8l1.4-4.5Z"
        fill="currentColor"
      />
      <path d="M17 13.5 17.8 16l2.5.8-2.5.8-.8 2.5-.8-2.5-2.5-.8 2.5-.8.8-2.5Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
