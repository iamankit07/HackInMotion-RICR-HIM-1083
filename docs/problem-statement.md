# Problem Statement — AI Learning Assistant & Personalized Study Planner

**Theme:** Education & EdTech
**Event:** HackInMotion 2026 (12–15 August 2026)
**Team:** RICR-HIM-1083

> "Because no two students learn the same way — so why should they all get the same study plan?"

## Real-World Context

Every student is different. Some grasp concepts quickly and need advanced challenges, while others
need more time and simpler explanations before moving forward. Yet most schools, colleges, and
self-study resources give every student the same content, the same pace, and the same generic study
schedule — regardless of their strengths, weaknesses, or how much time they actually have.

This leads to real problems:

- Students spend hours studying topics they already understand, while weak areas get ignored.
- Exam preparation often becomes last-minute cramming with no structured plan.
- Students don't get instant help when they're stuck on a concept — they wait for a teacher, tutor,
  or classmate.
- Personal tutoring is expensive and not accessible to everyone.

An intelligent system that understands what a student knows, what they don't, and how much time they
have — and builds a real plan around that — could change how millions of students prepare for exams
and learn new subjects.

## The Ask

Build a web-based application where a student can input what they need to learn or prepare for, get a
personalized study plan based on their current knowledge level and available time, and get instant
AI-powered help while studying. It should feel like a smart personal tutor who knows the student's
strengths, weaknesses, and schedule — not a generic to-do list generator.

## Objectives

The delivered application must:

1. Let a student create an account and securely log in.
2. Let a student set up a learning goal along with their available time and current knowledge level.
3. Assess the student's current understanding and generate a personalized study plan.
4. Provide an AI-powered assistant that answers questions and explains concepts while studying.
5. Track the student's progress against their study plan over time.

## Must-Have Requirements

| # | Requirement | Notes |
|---|---|---|
| 1 | User accounts & authentication | Secure sign-up/login. All user data private to the account. |
| 2 | Learning goal setup | Subject/topic/exam, deadline or available time, current confidence level. |
| 3 | Knowledge assessment | Diagnostic quiz or self-rating with quiz validation. Must identify weak areas. |
| 4 | Personalized study plan generator | **The technical core.** Day-by-day or session-by-session, prioritizes weak areas, fits available time. Must use a third-party AI/LLM API, documented and justified in the README. Must not be a static template. |
| 5 | AI-powered study assistant | Chat-style doubt solving. Genuinely helpful, topic-relevant answers. |
| 6 | Progress tracking | Mark sessions complete, visual progress, plan adjusts when the student falls behind. |
| 7 | Database integration | Persist accounts, goals, assessments, plans, progress, chat history. |
| 8 | Responsive, clean UI | Works on desktop and mobile. Encouraging and organized — the student should immediately know what to study next. |
| 9 | Mock test generator | Auto-generate practice tests from the topics in the student's plan. |
| 10 | Error handling | Incomplete setup, AI API failures, empty quiz responses, invalid input — never a blank or broken screen. |

## Stretch Challenges

- **Adaptive re-planning** — adjust the plan in real time when sessions are missed or a re-test goes badly.
- **Spaced repetition** — schedule revision of earlier topics using proven memory-retention techniques.
- **Voice-based doubt solving** — ask by voice, hear the explanation back.
- **Gamification** — streaks, badges, points.
- **Group study mode** — students with the same goal collaborate or compare progress.

## Deliverables

1. Fully functional deployed application — frontend, backend, database.
2. GitHub repository named `HackInMotion-TeamCode`, containing `architecture-diagram.png`,
   `api-documentation.md`, `presentation.pptx`, and a complete `README.md`.
3. Live demo showing a real goal being set up, a plan being generated, and the assistant answering a
   real question.
4. Product pitch (finalists) covering problem, solution, tech stack, impact, and future scope.

## Suggested Stack (flexible)

- **Frontend:** React.js / Next.js
- **Backend:** Node.js (Express) / Python (Django, Flask, FastAPI) / Java (Spring Boot) / .NET
- **Database:** MongoDB / PostgreSQL / MySQL / Firebase
- **AI/LLM:** any suitable third-party API — evaluating options and justifying the pick is part of the challenge
- **Auth:** JWT / Firebase Auth / OAuth
- **Deployment:** Vercel / Netlify / Render / Railway / AWS / Azure
