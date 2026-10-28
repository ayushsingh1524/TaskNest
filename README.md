# TaskNest

TaskNest is a full-stack productivity and project management app built as a monorepo. It combines a Next.js frontend, a FastAPI backend, PostgreSQL, Redis, Celery workers, and Nginx for a production-style local setup.

## Architecture

- Frontend: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- Backend: FastAPI, PostgreSQL, Redis, SQLAlchemy 2.0, Celery
- Infrastructure: Docker Compose, Nginx

## Prerequisites

- Docker and Docker Compose
- Node.js (v20+)
- Python (v3.11+)

## Getting Started

### Run the Full Stack with Docker

1. Make sure Docker is running.
2. From the repository root, start the stack:

   ```bash
   docker compose up -d --build
   ```

3. Open the frontend in your browser:
   - `http://localhost`

4. Verify the API is responding:
   - `http://localhost/api/v1/health`

5. If you want to inspect the backend docs while running the app directly, use:
   - `http://localhost:8000/docs`

### Local Development (Frontend)

1. Go to the frontend app:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open the app at:
   - `http://localhost:3000`

### Local Development (Backend)

1. Go to the backend app:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the API:

   ```bash
   uvicorn main:app --reload
   ```

5. Open the API docs at:
   - `http://localhost:8000/docs`

## Project Features

- Task and project tracking
- Kanban workflow management
- Notes and markdown editing
- GitHub integrations and analytics
- Dashboard insights and productivity metrics

## Notes

This repository uses a Dockerized full-stack setup for local development and demonstration. For production-like deployment, see `DEPLOYMENT.md`.
