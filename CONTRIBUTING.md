# Working on Lakshya

Notes for the two of us so the repository stays clean and both our contributions
are visible across all three days.

## Who owns what

| Area | Owner | Lives in |
|---|---|---|
| API server, database models, authentication | Ankit ([@iamankit07](https://github.com/iamankit07)) | `backend/` |
| AI integration and the study plan scheduler | Ankit | `backend/src/services/` |
| Interface, design system, all screens | Kamalneet ([@kamalneetkaur666](https://github.com/kamalneetkaur666)) | `frontend/` |
| Documentation | whoever built the thing being documented | `docs/`, `README.md` |

Ownership is about who writes it and who explains it in the technical viva — not
a wall. Ask, review each other's pull requests, and say so in the PR if you
touched something outside your area.

## Getting set up

You need **Node.js 20 or newer** and **MongoDB** (a local install or an Atlas
connection string).

```bash
git clone https://github.com/iamankit07/RICR-HIM-1083.git
cd RICR-HIM-1083
```

Backend:

```bash
cd backend
npm install
cp .env.example .env    # fill in MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
npm run dev
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Check the API is alive at <http://localhost:5000/api/health>.

## Before your first commit

Set your identity so GitHub links commits to your profile. If the email is not
one that is verified on your GitHub account, the commit will not appear on your
contribution graph and will not count as your work.

```bash
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
```

Confirm it worked after pushing: your avatar should appear next to the commit on
GitHub. If it shows a plain grey icon instead, the email is not linked.

## Branches

Work happens on a branch, never directly on `main`.

```
feature/<what-you-are-building>     feature/login-screen, feature/plan-scheduler
fix/<what-is-broken>                fix/quiz-empty-state
```

```bash
git checkout main
git pull origin main
git checkout -b feature/login-screen
```

Pull `main` before starting anything new, so you branch off current work.

## Commits

Write the message as a completed action, in title case, describing what actually
changed:

```
Added Login Authentication
Integrated Gemini API For Topic Graph Generation
Implemented Progress Ring Component
Fixed Quiz Submission Validation
```

Not these:

```
update    final    done    changes    testing    asdf
```

Commit when a piece of work is finished, not once at the end of the day. Small,
frequent, meaningful commits are what the daily evaluation looks for.

## Pull requests

Push your branch and open a pull request into `main`:

```bash
git push -u origin feature/login-screen
```

The description should say what changed and why anyone would care. A few lines
is enough — enough that the other person can review it without opening every
file. Merge once the other person has looked at it.

## Daily rhythm

- Pull `main` in the morning before starting.
- Open a pull request when a feature works end to end, not when it is perfect.
- Push before you stop for the day. Work sitting on your laptop is invisible to
  everyone else.
