# AI Integration

Which service we chose, why, and everything that had to be built around it to make
it dependable enough to demo.

## The short version

**Google Gemini (`gemini-flash-latest`) is the primary provider, with Groq as an
automatic fallback.** Both are reached over plain `fetch` — no vendor SDK — through
one provider-agnostic module, so no feature in the app knows or cares which model
answered it.

The language model is used for four things and deliberately not for a fifth:

| Used for | Not used for |
|---|---|
| Breaking a subject into a topic graph | **Building the schedule** |
| Writing diagnostic and mock test questions | Deciding what to study first |
| Answering doubts in the tutor | Working out mastery |
| Writing revision notes per topic | Re-planning when someone falls behind |

That split is the core design decision of the whole project, so it is worth being
explicit about: **the model writes the content, our own code builds the plan.**

## Why Gemini

We compared what was available to a team with no budget:

| Option | Free tier | Structured output | Verdict |
|---|---|---|---|
| **Google Gemini** | Daily free quota, no card required | Enforces a response schema server-side | **Primary** |
| **Groq** | Free tier, very low latency on open models | JSON mode, no schema | **Fallback** |
| OpenAI | Paid from the start | Excellent | No budget |
| Hugging Face Inference | Limited free tier | Inconsistent between models | Quality varied too much |
| Self-hosted open model | Free | Varies | No GPU, and cold starts would wreck a live demo |

Gemini won on two things that mattered more than raw answer quality.

**It enforces a response schema server-side.** We hand it a JSON schema and the
topic graph or quiz comes back already the right shape, instead of prose in a code
fence that we would have to parse defensively. Groq has a JSON mode but no schema,
so on the fallback path the schema is described in the prompt and the reply is
validated on our side like any other input.

**Its free tier works without a credit card**, which is what a student team can
actually get on the day.

## What the free tier actually costs

Measured against our own key, not read off a pricing page:

- Roughly **20 generations per day, per model**.
- One student going through the whole flow — topic graph, diagnostic, plan, mock
  test — spends about **four**.
- The allowance is counted **per model, not per key**. When one model is spent,
  another has a full fresh allowance.

That last point is not a footnote. It is why a `429` moves to a different model
instead of being retried, which is described below. For anything past a demo this
would need a paid tier; the architecture would not change, only the limits.

## How a request travels

```
feature (topic graph / quiz / tutor / notes)
   │
   ▼
services/ai/index.js          generateText() · generateJson()
   │   picks the first configured provider, falls through on failure
   ├──▶ services/ai/gemini.js     model resolution · thinking level · schema
   └──▶ services/ai/groq.js       OpenAI-compatible · schema described in prompt
             │
             ▼
        services/ai/httpClient.js   timeout · retry with jittered backoff
```

`generateJson` takes both a provider schema and a zod schema. The provider schema
constrains generation; the zod schema validates what actually came back. **A model
that ignores the shape counts as a provider failure and the next provider gets a
turn** — malformed output never reaches the database.

## The three problems that had to be solved

Everything below was found by running against the live API, not by reading docs.

### 1. Models get retired without warning

`gemini-2.5-flash` began answering `404 — no longer available to new users` partway
through development.

There was already a fallback for this, and it did not work: it probed the model
with a `GET`, and a retired model still *lists* fine — it only refuses when you
actually call it. The probe passed and the real request failed.

The fallback now **sends the real request** to candidate models in preference
order, so a success costs nothing extra and only a genuine refusal moves on.
Candidates are ranked by preferring the aliases Google maintains (`…-latest`),
then flash-tier models, then the highest version number, with image, speech,
embedding and agent models filtered out. The working model is remembered for the
rest of the process.

The configured default is `gemini-flash-latest` — an alias Google repoints as
models are retired, so it does not go stale.

### 2. Thinking tokens are charged against the output budget

This one was subtle and only showed up intermittently. Newer Gemini models reason
internally before answering, and **that reasoning is billed against the same
`maxOutputTokens` budget as the reply**. With a 1200-token budget, roughly 600 went
on thinking, and when it spiked there was nothing left — the response came back
empty with `finishReason: MAX_TOKENS`.

Two fixes: budgets were raised, and `thinkingLevel: 'low'` is requested. Not every
model accepts the option — `thinkingBudget: 0` is rejected outright with a 400 —
so support is learned on first use and the request is retried without it rather
than failing.

The side effect was speed. Topic generation went from **58 seconds to 10**.

Partial text is also returned rather than discarded now. A truncated explanation is
still worth reading; truncated JSON fails to parse a moment later and the fallback
provider picks it up, which is the behaviour we want there.

### 3. A 429 was treated as fatal, after making it worse

Quota exhaustion fell straight through to the error path, ignoring three perfectly
usable models. Worse, `429` sat in the shared retryable set, so before giving up it
spent two more requests on a model that had already said no.

Now a `429` moves immediately to the next model, and Gemini opts out of retrying it
via a `retryOn` option on the shared client — retrying is the one thing that cannot
help and does measurable harm.

## When nothing works

Every feature degrades on its own terms rather than the app collapsing:

| Feature | If no provider can be reached |
|---|---|
| Topic graph | `503` with a message pointing at manual topic entry, which is a fully supported path |
| Diagnostic / mock test | `503` asking them to try again — the plan is untouched |
| Topic notes | `503` saying the plan is unaffected, suggesting the tutor instead |
| Tutor chat | The question is **kept** and an honest reply is stored with `degraded: true`, so nothing typed is lost |
| Study plan | **Unaffected.** The scheduler is our own code — re-planning, progress and mastery never touch the AI |

The last row is the point. A student whose plan already exists can keep studying,
tick sessions off, fall behind, and have the schedule rebuild itself with the AI
completely unreachable.

## Prompt design

Prompts live next to the feature that uses them, not in a shared file — each one is
only meaningful alongside the code that consumes its output.

**Topic graph** (`services/topicGraph.js`) — asks for a topic count scaled to the
time available, and a total estimate near the student's real budget so the plan is
not fiction. Returns key, title, summary, difficulty, exam weight, estimated
minutes and prerequisites.

Everything it returns is treated as untrusted. Keys are re-slugged and de-duplicated,
prerequisites pointing at topics that were never returned are dropped, self-references
are removed, and **cycles are broken** with a depth-first search that discards any
edge closing a loop. The scheduler assumes a clean directed acyclic graph and would
otherwise deadlock.

**Diagnostic** (`services/quizGenerator.js`) — one question per topic, weighted
towards what carries the most marks. Pitched to separate a student who understands
the topic from one who has only heard the name.

**Mock tests** — the same generator, aimed instead at the topics the student has
actually studied and is weakest on. Testing material they have not reached teaches
nothing.

Questions are sanitised too: duplicate options are collapsed and the correct index
follows the answer, questions whose answer index points past the end of the options
are discarded, and a question tagged with a topic that does not exist is reassigned.

**Tutor** (`services/tutor.js`) — told the subject, the student's level, the topic
they are on right now, and the topics they scored worst on. That context is what
makes the answers specific rather than generic. A doubt asked without a goal gets a
different system prompt that explicitly tells the model it has no syllabus, so it
answers the question instead of inventing a course.

**Topic notes** (`services/topicNotes.js`) — four fixed headings: the short version,
what you need to know, where students lose marks, and check yourself. Adapts to
whether the diagnostic score was low, and is told which prerequisites are already
covered so it does not re-teach them.

Notes are **written once and stored on the topic**. Regenerating on every visit
would empty the daily quota in an afternoon, and notes for a fixed syllabus topic do
not change between readings.

All prompts ask for Unicode rather than LaTeX — `x²` not `$x^2$`, `Na⁺` not `Na^+` —
because the interface renders notation by mapping it to Unicode rather than loading
a maths typesetter.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Primary provider. Free from [Google AI Studio](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | no | Defaults to `gemini-flash-latest`. Overridden only to pin a model. |
| `GROQ_API_KEY` | no | Without it the fallback is skipped and Gemini is the only provider. |
| `GROQ_MODEL` | no | Defaults to `llama-3.3-70b-versatile`. |

The key never leaves the server. The browser talks only to our API, which is also
what stops a student reading the key out of the page source.

`GET /api/health` reports which providers are configured, so a deployment can be
checked without making a billable call.
