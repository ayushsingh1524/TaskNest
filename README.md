# TaskNest

TaskNest is a production-ready monorepo that includes a Next.js 15 frontend and a FastAPI backend, orchestrated with Docker Compose and Nginx.

## Architecture
- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, PostgreSQL, Redis, SQLAlchemy 2.0, Celery
- **DevOps**: Docker, Docker Compose, Nginx

## Prerequisites
- Docker and Docker Compose
- Node.js (v20+)
- Python (v3.11+)

## Getting Started

### Running the Full Stack (Docker)
1. Ensure Docker is running.
2. From the root directory, run:
   ```bash
   docker-compose up -d --build
   ```
3. Access the frontend at `http://localhost`.
4. Access the backend API docs at `http://localhost/api/docs`.

### Local Development (Frontend)
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the frontend at `http://localhost:3000`.

### Local Development (Backend)
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```
4. Access the API docs at `http://localhost:8000/docs`.
