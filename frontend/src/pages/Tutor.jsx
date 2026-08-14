import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { Loading, Notice } from '../components/ui/Feedback.jsx';
import { Textarea } from '../components/ui/Field.jsx';
import { RichText } from '../components/ui/RichText.jsx';
import { api } from '../lib/api.js';
import { useResource } from '../lib/useResource.js';
import { useVoice } from '../lib/useVoice.js';

export default function Tutor() {
  const { goalId } = useParams();
  const location = useLocation();

  const goal = useResource(() => api.goals.get(goalId), [goalId]);
  const history = useResource(() => api.tutor.conversations(goalId), [goalId]);

  const [conversation, setConversation] = useState(null);
  const [question, setQuestion] = useState('');
  const [topicKey, setTopicKey] = useState(location.state?.topicKey ?? '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // Only read answers aloud when the question was asked aloud. Someone typing
  // in a library does not expect the page to start talking.
  const [askedByVoice, setAskedByVoice] = useState(false);

  const endRef = useRef(null);

  const voice = useVoice({
    onTranscript: (text) => {
      setQuestion((current) => (current ? `${current} ${text}` : text));
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages?.length, sending]);

  if (goal.loading) return <Loading label="Loading your tutor" />;

  const topics = goal.data?.goal?.topics ?? [];
  const messages = conversation?.messages ?? [];

  const send = async (event) => {
    event.preventDefault();

    const trimmed = question.trim();
    if (trimmed.length < 3 || sending) return;

    setSending(true);
    setError(null);
    voice.stopListening();

    // Held until after the request has settled: reading the answer out is a
    // separate concern from sending it, and must never be able to report the
    // question as failed.
    let spokenReply = null;

    // Show the question immediately rather than after the round trip — a tutor
    // that appears to swallow your message feels broken even when it is not.
    const optimistic = {
      messages: [...messages, { role: 'user', content: trimmed, topicKey: topicKey || null }],
    };
    setConversation({ ...conversation, ...optimistic });

    try {
      const payload = conversation?.id
        ? await api.tutor.reply(goalId, conversation.id, { question: trimmed, topicKey: topicKey || undefined })
        : await api.tutor.start(goalId, { question: trimmed, topicKey: topicKey || undefined });

      setConversation(payload.conversation);
      setQuestion('');
      history.reload();
      spokenReply = askedByVoice ? payload.conversation?.messages?.at(-1) : null;
    } catch (caught) {
      setError(caught);
      // Put the question back so nothing the student typed is lost.
      setConversation(conversation);
      setQuestion(trimmed);
    } finally {
      setSending(false);
    }

    if (spokenReply?.role === 'assistant') {
      voice.speak(spokenReply.content);
    }
    setAskedByVoice(false);
  };

  const openConversation = async (id) => {
    setError(null);

    try {
      const { conversation: loaded } = await api.tutor.conversation(goalId, id);
      setConversation(loaded);
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
      <Card className="flex min-h-[32rem] flex-col p-0 lg:min-h-[38rem]">
        <div className="border-b border-line px-5 py-4">
          <p className="eyebrow">Ask a doubt</p>
          <h1 className="mt-1 text-xl font-semibold">
            {goal.data?.goal?.subject} tutor
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 ? (
            <Opener topics={topics} onPick={(text) => setQuestion(text)} />
          ) : (
            <ul className="flex flex-col gap-4">
              {messages.map((message, index) => (
                <Message
                  key={index}
                  message={message}
                  voice={voice}
                  isLast={index === messages.length - 1}
                />
              ))}
              {sending && <Thinking />}
            </ul>
          )}

          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="border-t border-line p-4">
          {error && (
            <Notice tone="error" title="That did not send">
              {error.message}
            </Notice>
          )}

          {topics.length > 0 && (
            <select
              value={topicKey}
              onChange={(event) => setTopicKey(event.target.value)}
              className="mb-2.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink-soft"
              aria-label="Topic this question is about"
            >
              <option value="">Not about a specific topic</option>
              {topics.map((topic) => (
                <option key={topic.key} value={topic.key}>
                  {topic.title}
                </option>
              ))}
            </select>
          )}

          {voice.error && (
            <p className="mb-2 text-[0.8125rem] text-clay">{voice.error}</p>
          )}

          {voice.listening && (
            <p className="mb-2 flex items-center gap-2 text-[0.8125rem] text-saffron">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-saffron" />
              </span>
              Listening{voice.interim ? `: ${voice.interim}` : '…'}
            </p>
          )}

          <div className="flex items-end gap-2">
            {voice.canListen && (
              <MicButton
                listening={voice.listening}
                onStart={() => {
                  setAskedByVoice(true);
                  voice.startListening();
                }}
                onStop={voice.stopListening}
              />
            )}

            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  send(event);
                }
              }}
              placeholder="Why does a deadlock need all four conditions at once?"
              rows={2}
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
      </Card>

      <Card className="h-fit p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Earlier doubts</p>
          {conversation && (
            <Button variant="ghost" size="sm" onClick={() => setConversation(null)}>
              New
            </Button>
          )}
        </div>

        {history.loading ? (
          <p className="mt-3 text-sm text-ink-muted">Loading…</p>
        ) : history.data?.conversations?.length ? (
          <ul className="mt-3 flex flex-col gap-1">
            {history.data.conversations.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => openConversation(entry.id)}
                  className={[
                    'ease-lakshya w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition',
                    conversation?.id === entry.id
                      ? 'bg-sunk text-ink'
                      : 'text-ink-soft hover:bg-sunk hover:text-ink',
                  ].join(' ')}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Questions you ask will be saved here so you can look them up again before the exam.
          </p>
        )}
      </Card>
    </div>
  );
}

/** Hold to talk, or click to start and click again to stop. */
function MicButton({ listening, onStart, onStop }) {
  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      aria-label={listening ? 'Stop listening' : 'Ask by voice'}
      aria-pressed={listening}
      title={listening ? 'Stop listening' : 'Ask by voice'}
      className={[
        'ease-lakshya flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition duration-200',
        listening
          ? 'border-saffron bg-saffron text-white'
          : 'border-line text-ink-soft hover:border-line-strong hover:bg-sunk hover:text-ink',
      ].join(' ')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Message({ message, voice, isLast }) {
  const isStudent = message.role === 'user';
  const canRead = !isStudent && voice?.canSpeak && message.content;

  return (
    <li className={['flex', isStudent ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isStudent
            ? 'bg-ink text-paper'
            : message.degraded
              ? 'border border-amber/40 bg-amber/10 text-ink-soft'
              : 'border border-line bg-sunk text-ink',
        ].join(' ')}
      >
        <RichText content={message.content} />

        {canRead && (
          <button
            type="button"
            onClick={() =>
              voice.speaking && isLast ? voice.stopSpeaking() : voice.speak(message.content)
            }
            className="ease-lakshya mt-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs text-ink-muted transition hover:text-saffron"
          >
            {voice.speaking && isLast ? (
              <>
                <StopIcon /> Stop reading
              </>
            ) : (
              <>
                <SpeakerIcon /> Read aloud
              </>
            )}
          </button>
        )}
      </div>
    </li>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M15.5 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}

function Thinking() {
  return (
    <li className="flex justify-start">
      <div className="flex gap-1.5 rounded-2xl border border-line bg-sunk px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </li>
  );
}

function Opener({ topics, onPick }) {
  const suggestions = topics.slice(0, 3).map((topic) => `Explain ${topic.title} simply`);

  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <h2 className="font-display text-xl font-semibold text-ink">Stuck on something?</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        The tutor knows your subject, what you are studying today, and which topics you scored badly
        on. Ask it the thing you would text a friend at midnight.
      </p>

      {suggestions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onPick(suggestion)}
              className="ease-lakshya rounded-full border border-line px-3.5 py-2 text-sm text-ink-soft transition hover:border-line-strong hover:text-ink"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
