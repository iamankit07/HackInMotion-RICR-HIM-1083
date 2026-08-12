# Running Lakshya on your machine

Everything you need to get both halves of the app up, plus the commands worth
knowing during the hackathon.

## What has to be installed

| | Check it is there | If it is missing |
|---|---|---|
| Node.js 20+ | `node --version` | <https://nodejs.org> or `winget install OpenJS.NodeJS.LTS` |
| MongoDB | `Get-Service MongoDB` | `winget install MongoDB.Server`, or use an Atlas connection string |
| Git | `git --version` | <https://git-scm.com> |

> **If `node` is not recognised straight after installing it**, close the terminal
> and open a new one. The installer adds it to `PATH`, but terminals that were
> already open do not pick that up.

MongoDB installs as a Windows service and starts on its own. To check:

```powershell
Get-Service MongoDB
```

If it says `Stopped`, start it with `Start-Service MongoDB`.

## First time setup

```bash
git clone https://github.com/iamankit07/HackInMotion-RICR-HIM-1083.git
cd HackInMotion-RICR-HIM-1083
```

**Backend**

```bash
cd backend
npm install
cp .env.example .env
```

Then open `backend/.env` and fill in:

- `MONGODB_URI` — leave as `mongodb://127.0.0.1:27017/lakshya` for a local install
- `JWT_SECRET` — any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
- `GEMINI_API_KEY` — free from <https://aistudio.google.com/apikey>. Without it
  everything still runs; the AI features return a clear message instead.

**Frontend**

```bash
cd ../frontend
npm install
cp .env.example .env
```

`frontend/.env` only needs `VITE_API_URL=http://localhost:5000/api`.

## Every day after that

Two terminals.

**Terminal 1 — the API**

```bash
cd backend
npm run dev
```

You should see:

```
MongoDB connected — 127.0.0.1/lakshya
Lakshya API listening on http://localhost:5000 (development)
```

**Terminal 2 — the web app**

```bash
cd frontend
npm run dev
```

Then open <http://localhost:5173>.

## Useful commands

| What | Command | Where |
|---|---|---|
| Run the tests | `npm test` | `backend` |
| Build for production | `npm run build` | `frontend` |
| Preview the production build | `npm run preview` | `frontend` |
| Start the API without auto-reload | `npm start` | `backend` |

## Checking things are alive

```bash
curl http://localhost:5000/api/health
```

```json
{
  "data": {
    "status": "ok",
    "database": "connected",
    "ai": { "available": true, "providers": ["gemini"], "primary": "gemini" },
    "uptime": 42
  }
}
```

`database` should say `connected`. `ai.available` will be `false` until a
`GEMINI_API_KEY` is set — that is expected, not a fault.

## When something is wrong

**`MongoServerError` or the API exits at startup**
MongoDB is not running. `Start-Service MongoDB`, or check `MONGODB_URI`.

**`Cannot start: the environment is not configured correctly`**
A required value is missing from `backend/.env`. The message names the exact
field — usually `JWT_SECRET` being too short or absent.

**The app loads but every request fails**
The API is not running, or `VITE_API_URL` in `frontend/.env` points somewhere
else. Check <http://localhost:5000/api/health> in a browser.

**CORS errors in the browser console**
`CLIENT_ORIGIN` in `backend/.env` has to match the address the frontend is
served from. It defaults to `http://localhost:5173`.

**Port 5000 or 5173 already in use**
Something is still running from earlier. On Windows:

```powershell
Get-Process node | Stop-Process -Force
```

**AI features return 503**
No `GEMINI_API_KEY`, an invalid key, or the free-tier limit is hit. Add a
`GROQ_API_KEY` as well and requests fall over to Groq automatically.
