# Database Design

MongoDB, accessed through Mongoose. Seven collections.

## Why a document store

A study plan is a goal, a list of topics, a schedule of sessions and a running
measure of what the student knows — and the shape of it changes as the app learns
about them. Modelling that relationally would mean five or six join tables to read
one screen.

Two properties of this data decided it:

**Plans are read whole.** Opening the app fetches one plan and every session in it.
As one document that is a single read; normalised it is a join across a sessions
table on every page load.

**Topic graphs are irregular.** One subject comes back with eight topics, another
with sixteen, prerequisites vary per topic, and the AI can regenerate the lot. A
schema-flexible store absorbs that; a fixed table does not.

Where the data is genuinely relational — a student's mastery of a topic, which
changes constantly and independently of the plan — it is a separate collection with
a compound index, not an embedded field.

## The collections

```
users ──┬── goals ──┬── plans          (one current, older versions kept)
        │           ├── progress       (one per topic per goal)
        │           ├── assessments    (diagnostics and mock tests)
        │           └── conversations  (tutor chat)
        │
        ├── conversations              (doubts with no goal attached)
        └── studygroups                (membership pairs a user with their own goal)
```

---

### `users`

| Field | Notes |
|---|---|
| `name` | |
| `email` | Unique, lowercased and trimmed |
| `passwordHash` | bcrypt, 12 rounds |

`passwordHash` is `select: false`, so it is not loaded unless a query asks for it,
and it is stripped again in `toJSON`. It takes two separate mistakes for a hash to
reach a response.

---

### `goals`

The subject, the deadline, the hours available — and the topic graph, embedded.

| Field | Notes |
|---|---|
| `user` | Owner. Indexed. |
| `subject`, `examType`, `notes` | What the student told us |
| `deadline` | Must be in the future at creation |
| `dailyMinutes`, `studyDays` | Real availability. `studyDays` holds weekday numbers, 0 = Sunday. |
| `confidence` | `beginner` · `intermediate` · `advanced` — the prior for mastery |
| `status` | `draft` → `assessing` → `active` → `completed` / `archived` |
| `topics[]` | The topic graph, embedded |
| `topicsFromFallback` | True when the graph was typed in by hand because the AI was unreachable |

Each embedded topic carries `key`, `title`, `summary`, `difficulty` (1–5), `weight`
(1–5, how heavily examined), `estimatedMinutes`, `prerequisites[]`, and the study
`notes` once they have been written.

**Topics are embedded, not referenced.** They are created together, read together
and replaced together — a topic has no meaning outside its goal. **Prerequisites
reference other topics by `key`, not by id**, so the whole graph can be regenerated
or hand-edited without repairing object references.

Indexes: `{ user: 1, createdAt: -1 }` for the dashboard, plus `user` and `status`.

---

### `plans`

One document per version. Sessions are embedded.

| Field | Notes |
|---|---|
| `user`, `goal` | Both indexed |
| `version` | Increments per rebuild |
| `isCurrent` | Exactly one true per goal |
| `reason` | `initial` · `behind-schedule` · `weak-retest` · `requested` |
| `startDate`, `endDate` | |
| `sessions[]` | `date`, `order`, `topicKey`, `title`, `kind`, `minutes`, `reason`, `status`, `completedAt` |
| `unscheduledTopicKeys[]` | Topics that genuinely would not fit — reported, not silently dropped |

`kind` is `learn` · `revise` · `practice` · `test`. `status` is `pending` ·
`completed` · `skipped`.

**Old versions are kept rather than overwritten.** Re-planning writes a new
document and clears `isCurrent` on the previous one, so the history of how a plan
adapted is a queryable record — which is what `GET /plan/versions` reads.

The `reason` field is what makes that history worth keeping: it says *why* each
rebuild happened.

Index: `{ goal: 1, version: -1 }`.

Note: the summary virtuals (`totalMinutes`, `completionPercent`) cope with
`sessions` being absent, because the version-list query deliberately does not load
them. A virtual that assumes its source field is present will throw on a projected
query — that was a real 500 during development.

---

### `progress`

What we believe the student knows about one topic, and when they should see it
again. **One document per topic per goal.**

| Field | Notes |
|---|---|
| `mastery` | 0–1 |
| `questionsAnswered`, `questionsCorrect` | The evidence behind it |
| `minutesStudied`, `sessionsCompleted` | Time actually invested |
| `status` | `not_started` · `learning` · `review` · `mastered` |
| `repetitions`, `easeFactor`, `intervalDays`, `dueAt` | SM-2 spaced repetition state |
| `lastStudiedAt` | |

Separate from the goal for two reasons. It **changes constantly** — every answered
question and every completed session writes here, and rewriting a whole goal
document for one number would be wasteful. And it **outlives any single plan**: a
rebuild creates a new plan document, so anything stored on the plan would be lost.
Streaks and completed-session counts survive re-planning precisely because they are
derived from here.

`mastery` is a blend, not a raw score. The self-rating acts as a prior worth two
imaginary questions, and every real answer pulls the estimate toward measured
performance. With no answers it returns the self-rating exactly; after a dozen
questions the self-rating barely matters. That is why a confident student who fails
the diagnostic still gets those topics scheduled first.

Index: `{ goal: 1, topicKey: 1 }`, **unique** — one record per topic per goal is an
invariant, enforced by the database rather than by hoping.

---

### `assessments`

Diagnostics and mock tests, with the questions embedded.

| Field | Notes |
|---|---|
| `user`, `goal`, `kind` | `kind` is `diagnostic` or `mock` |
| `questions[]` | `topicKey`, `prompt`, `options[]`, `correctIndex`, `explanation`, `difficulty`, `selectedIndex` |
| `score`, `submittedAt` | |

**The correct answer lives in the same document as the question**, so the model has
two serialisers rather than one: `toQuestionPaper()` omits `correctIndex` and
`explanation` entirely, and `toResultSheet()` includes them. The paper is what is
sent before submission — the answers are not merely hidden in the interface, they
are never sent.

Index: `{ user: 1, goal: 1, createdAt: -1 }`.

---

### `conversations`

Tutor chat. Messages embedded, ordered by nature.

| Field | Notes |
|---|---|
| `user` | Indexed |
| `goal` | **Nullable.** A one-off doubt asked from the dashboard has no syllabus behind it. |
| `title` | Taken from the first question, without an AI call |
| `messages[]` | `role`, `content`, `topicKey`, `degraded` |

`degraded` marks a reply written when no provider could be reached, so the interface
can render it differently and offer a retry — the student's question is kept either
way.

The goal-free routes scope every query on `user` **and** `goal: null`, so that path
cannot reach a goal-scoped conversation even with a valid id.

Index: `{ user: 1, goal: 1, updatedAt: -1 }`.

---

### `studygroups`

The only place data crosses between accounts.

| Field | Notes |
|---|---|
| `name` | |
| `joinCode` | Six characters, unique and indexed. Alphabet excludes O/0 and I/1 — these get read aloud and typed by hand. |
| `owner` | Transfers to the longest-standing member if the owner leaves |
| `members[]` | `user`, `goal`, `joinedAt` |

**Membership pairs a person with one of their own goals.** The group compares
progress across separate plans rather than sharing one, and a student preparing for
two exams joins with the one the group is about.

**The group stores nothing about anyone's studying.** It holds references only, and
what members see of each other is assembled at read time as a hand-built shape:
name, subject, deadline, completion percent, sessions, minutes, streak, points,
badges. Plans, conversations, quiz questions and answers, topic notes and email
addresses are absent by construction, not by filtering.

Join codes are random rather than sequential, so one group's code tells you nothing
about another's, and collisions are retried rather than assumed away.

Index: `{ 'members.user': 1 }` — every read is "which groups am I in".

---

## Privacy

Requirement 1 of the problem statement is that a student's goals, plans, progress
and chat history stay private to their account. That is enforced in one place
rather than repeated in every handler:

- **`loadGoal`** loads the goal named in the route and rejects it with `403` unless
  it belongs to the caller. Every goal-scoped route sits behind it, so no handler
  past that point has to think about ownership.
- **`loadGroup`** does the same for groups, but answers **404** rather than 403 —
  telling a stranger "this group exists but you cannot see it" is more than they
  need to know.
- Assessments and conversations are checked against the token holder directly.
- Attaching a goal to a group re-checks ownership on both create and join, because
  that is the one place a goal id arrives in a request body rather than through
  `loadGoal`.

Verified with real requests rather than by inspection: a second account gets `403`
on another student's goal, plan and tutor chats, `400` when trying to join a group
with someone else's goal, and `404` on a group it does not belong to.

## Deleting a goal

Removing a goal deletes its plans, progress records, assessments and conversations
in the same operation. Nothing belonging to a deleted goal outlives it.

## Connection

`MONGODB_URI` — a local `mongodb://127.0.0.1:27017/lakshya` in development, a
MongoDB Atlas connection string in deployment. Nothing else changes between the two.

The connection retries on disconnect and closes cleanly on `SIGINT`/`SIGTERM`, and
`GET /api/health` reports the current connection state so a deployment health check
can see it.
