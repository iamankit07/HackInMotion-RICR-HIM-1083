# Lakshya API

Base URL: `http://localhost:5000/api` in development.

Every response is JSON in one of two shapes.

**Success**

```json
{ "data": { } }
```

**Failure**

```json
{
  "error": {
    "message": "Please check the highlighted fields.",
    "details": [{ "field": "password", "message": "Use at least 8 characters" }]
  }
}
```

`message` is written to be shown to a student as-is. `details` is only present on
validation failures and lists one entry per offending field.

## Authentication

All routes except `/health`, `/auth/register` and `/auth/login` need a bearer token:

```
Authorization: Bearer <token>
```

Tokens are JWTs signed with `JWT_SECRET`, valid for `JWT_EXPIRES_IN` (7 days by default).

### Status codes

| Code | When |
|---|---|
| 200 | Fine |
| 201 | Something was created |
| 204 | Deleted, nothing to return |
| 400 | The request body did not validate |
| 401 | Missing, invalid or expired token |
| 403 | The resource belongs to another account |
| 404 | No such resource |
| 409 | Conflicts with something that already exists |
| 429 | Rate limited (20 credential attempts per 15 minutes) |
| 503 | No AI provider could be reached |

---

## Health

### `GET /health`

Public. Used by the deployment health check.

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "ai": { "available": true, "providers": ["gemini", "groq"], "primary": "gemini" },
    "uptime": 2568
  }
}
```

---

## Accounts

### `POST /auth/register`

```json
{ "name": "Ankit Kumar", "email": "ankit@example.com", "password": "studypass1" }
```

Password must be at least 8 characters and contain a letter and a number.
Returns `201` with `{ user, token }`. Returns `409` if the email is taken.

### `POST /auth/login`

```json
{ "email": "ankit@example.com", "password": "studypass1" }
```

Returns `{ user, token }`. A wrong password and an unknown email return the same
`401` message, so the endpoint cannot be used to discover which emails are registered.

### `GET /auth/me`

Returns `{ user }` for the token holder.

---

## Learning goals

### `GET /goals`

Returns `{ goals }` — the signed-in student's goals, newest first.

### `POST /goals`

```json
{
  "subject": "Operating Systems",
  "examType": "University End-Sem",
  "notes": "Paging and deadlocks are definitely on the paper",
  "deadline": "2026-08-24T09:00:00.000Z",
  "dailyMinutes": 90,
  "studyDays": [1, 2, 3, 4, 5],
  "confidence": "intermediate"
}
```

`examType` and `notes` are optional. `studyDays` uses `0` for Sunday and defaults to
every day. `confidence` is `beginner`, `intermediate` or `advanced`. The deadline must
be in the future. Returns `201` with `{ goal }` at status `draft`.

### `GET /goals/:goalId`

Returns `{ goal, progress, plan }`, where `plan` is a summary or `null` if none exists yet.

### `PATCH /goals/:goalId`

Accepts any subset of the create fields.

### `DELETE /goals/:goalId`

Returns `204`. Also deletes the goal's plans, progress, assessments and conversations.

---

## Topics

### `POST /goals/:goalId/topics/generate`

Asks the AI to decompose the subject into a topic graph. No body.

Returns `{ goal, topics }`. Each topic:

```json
{
  "key": "virtual-memory",
  "title": "Virtual Memory and Paging",
  "summary": "Demand paging and page replacement policies",
  "difficulty": 4,
  "weight": 5,
  "estimatedMinutes": 90,
  "prerequisites": ["memory-management"]
}
```

`difficulty` and `weight` are 1–5. `prerequisites` holds keys of other topics in the same
graph; the response is always a directed acyclic graph, since dangling references are
dropped and cycles are broken before it is stored.

Returns `503` if no AI provider can be reached. The message points the student at manual
entry, which is a supported path rather than a dead end.

Regenerating replaces the graph and clears the progress measured against the old one.

### `PUT /goals/:goalId/topics`

Manual entry, and the fallback when the AI is unavailable.

```json
{
  "topics": [
    { "title": "Processes and Threads", "estimatedMinutes": 90, "difficulty": 3, "weight": 5 }
  ]
}
```

Keys are generated from the titles. `prerequisites` may be supplied using those generated
keys. Between 1 and 30 topics.

---

## Assessments

### `POST /goals/:goalId/assessments/diagnostic`

```json
{ "questionCount": 8 }
```

Generates a diagnostic spread across the highest-weighted topics. Returns `201` with the
question paper — **the correct answers are not included**:

```json
{
  "data": {
    "assessment": {
      "id": "...",
      "kind": "diagnostic",
      "title": "Where are you with Operating Systems?",
      "questions": [
        { "index": 0, "topicKey": "processes", "prompt": "...", "options": ["...", "..."], "difficulty": 3 }
      ]
    }
  }
}
```

### `POST /goals/:goalId/assessments/mock`

```json
{ "questionCount": 8, "topicKeys": ["sync", "deadlock"] }
```

Both fields optional. With no `topicKeys`, it tests the studied topics the student is
weakest on. Same response shape as the diagnostic.

### `GET /goals/:goalId/assessments`

Returns `{ assessments }` — id, kind, title, total, score, timestamps.

### `GET /goals/:goalId/assessments/:assessmentId`

Returns the question paper before submission, and the full result sheet after.

### `POST /goals/:goalId/assessments/:assessmentId/submit`

```json
{ "answers": [{ "questionIndex": 0, "selectedIndex": 2 }] }
```

Returns the result sheet with `correctIndex`, `selectedIndex`, `wasCorrect` and
`explanation` per question, plus updated `progress`.

Two things happen automatically:

- Submitting the **first diagnostic** builds the study plan. The response carries
  `plan` and `planAction: "initial"`, and the goal moves to `active`.
- Scoring **under 50% on a mock test** rebuilds the plan around the exposed gaps.
  The response carries `planAction: "weak-retest"`.

Returns `409` if the assessment was already submitted.

---

## Study plan

### `POST /goals/:goalId/plan`

Builds the first plan. Returns `201` with `{ plan, summary }`. Returns `400` if the goal
has no topics yet.

### `GET /goals/:goalId/plan`

Returns the current plan and its summary.

```json
{
  "summary": {
    "version": 2,
    "totalSessions": 20,
    "completedSessions": 3,
    "completionPercent": 15,
    "totalMinutes": 554,
    "completedMinutes": 90,
    "missedSessions": 1,
    "isBehind": true,
    "daysRemaining": 9,
    "unscheduledTopicKeys": []
  }
}
```

Each session:

```json
{
  "id": "...",
  "date": "2026-08-14T00:00:00.000Z",
  "order": 2,
  "topicKey": "sync",
  "title": "Process Synchronisation",
  "kind": "learn",
  "minutes": 45,
  "reason": "Weakest area, and it carries a lot of marks. This gets the most time.",
  "status": "pending"
}
```

`kind` is `learn`, `revise`, `practice` or `test`. `status` is `pending`, `completed` or
`skipped`. `unscheduledTopicKeys` names topics that genuinely would not fit before the
deadline — reported rather than silently dropped.

### `POST /goals/:goalId/plan/replan`

```json
{ "reason": "behind-schedule" }
```

Rebuilds from today. Completed study is credited through the progress records, so
re-planning moves the remaining work forward instead of restarting the syllabus. The
previous version is retained. Returns `{ plan, summary, rebuiltBecause }`.

### `GET /goals/:goalId/plan/versions`

Every version with its reason, dates and session counts — the audit trail of how the plan
adapted.

### `GET /goals/:goalId/today`

What the app opens on.

```json
{
  "data": {
    "date": "2026-08-12T00:00:00.000Z",
    "sessions": [],
    "overdue": [],
    "summary": {},
    "progress": {}
  }
}
```

`progress` carries `topicsTotal`, `topicsMastered`, `averageMastery`, `weakestTopics` and
a `byTopic` array with mastery, status, questions answered and minutes studied.

### `PATCH /goals/:goalId/sessions/:sessionId`

```json
{ "status": "completed" }
```

Time is credited only the first time a session is completed, so toggling it does not
inflate how much has been studied.

---

## Tutor

### `POST /goals/:goalId/conversations`

Starts a conversation and answers in one call.

```json
{ "question": "Why does a deadlock need all four conditions?", "topicKey": "deadlock" }
```

`topicKey` is optional; supplying it lets the tutor answer in terms of that topic.
Returns `201` with `{ conversation, reply, degraded }`.

The tutor is given the subject, the student's level, the topic they are on, and the
topics they scored worst on — which is what makes the answers specific rather than generic.

### `POST /goals/:goalId/conversations/:conversationId/messages`

Same body, continues an existing conversation. The last 12 messages are sent as context.

### `GET /goals/:goalId/conversations`

Returns `{ conversations }` — id, title, message count, last updated.

### `GET /goals/:goalId/conversations/:conversationId`

Returns the full conversation with all messages.

### `DELETE /goals/:goalId/conversations/:conversationId`

Returns `204`.

### When the AI is unavailable

The chat endpoints do **not** return `503`. The student's question is saved and an
assistant message is stored with `degraded: true` explaining that the tutor could not be
reached. The client renders those differently and offers a retry, so a question is never
silently lost.

---

## Privacy

Every route under `/goals/:goalId` passes through middleware that loads the goal and
rejects it with `403` if it belongs to another account. Assessments and conversations are
checked against the token holder as well. There is no endpoint that returns another
student's goals, plans, results or chat history.
