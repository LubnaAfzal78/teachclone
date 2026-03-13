# TeachNova

TeachNova is a full-stack educational web app built for the Amazon Nova Hackathon. Teachers can upload lesson videos, generate an AI teaching persona, and let students chat with that persona through a secure backend that proxies requests to Amazon Bedrock-powered Amazon Nova models.

## Architecture

Frontend -> Backend -> Amazon Bedrock / Amazon Nova

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express
- **AI:** Amazon Nova via Amazon Bedrock Runtime
- **Storage (demo mode):** Browser localStorage and IndexedDB for local development

## Project Structure

```text
teachnova/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx
│       ├── index.tsx
│       ├── types.ts
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── services/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Express
- Amazon Bedrock Runtime SDK
- Amazon Nova Lite

## Local Setup

### 1) Clone the repository

```bash
git clone <your-repo-url>
cd teachnova
```

### 2) Configure backend environment variables

Copy the example file and add your real values locally:

```bash
cd backend
cp .env.example .env
```

Example variables:

```env
PORT=8787
AWS_REGION=us-east-1
AWS_BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
```

Use AWS credentials through your local AWS profile, environment variables, or your hosting provider's secret manager. Do **not** expose any API keys or secret access keys in the frontend.

### 3) Install dependencies

In one terminal:

```bash
cd backend
npm install
npm run dev
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and calls the backend API, which runs on `http://localhost:8787` by default.

## Build

Frontend production build:

```bash
cd frontend
npm install
npm run build
```

Backend production start:

```bash
cd backend
npm install
npm start
```

## Deployment Notes

### GitHub

- Commit the full repository except local `.env` files.
- Keep only `.env.example` in version control.
- Add your AWS credentials in GitHub Actions or your hosting environment, not in source files.

### Hostinger

- Deploy the `frontend/dist` output as the static site.
- Run the `backend` app on Node.js hosting.
- Set `PORT`, `AWS_REGION`, and `AWS_BEDROCK_MODEL_ID` in Hostinger environment settings.
- Point the frontend environment variable `VITE_API_BASE_URL` to your deployed backend URL.

## Hackathon Positioning

TeachNova is designed as an Amazon Nova hackathon submission that demonstrates:

- Nova-powered teaching persona generation
- Student chat grounded in teacher style and lesson context
- Secure full-stack architecture with secrets kept in the backend
- A repository structure that is clean, deployable, and GitHub-ready

## Security Notes

- No real `.env` file should be committed.
- Frontend does not call Amazon Bedrock directly.
- Backend owns all communication with Amazon Nova.

## Next Improvements

- Replace demo localStorage persistence with a database
- Add S3 for media upload storage
- Add authentication tokens and server-side session validation
- Add vector retrieval for lesson grounding
