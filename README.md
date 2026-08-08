# NexusAI - Enterprise AI Operating System

NexusAI is a modern enterprise operating system designed to manage documents, employees, AI agents, and organizational workflows from a unified pane.

## Technology Stack

### Frontend
- **Framework**: Next.js (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Component Library**: shadcn/ui

### Backend
- **Framework**: FastAPI (Asynchronous Python REST API)
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Database**: PostgreSQL (with SQLite support for local dev fallback)

## Directory Structure

```text
.
├── backend/                  # FastAPI Backend Application
├── frontend/                 # Next.js Frontend Web Client
├── docs/                     # Architecture & Design Documents
└── README.md                 # Workspace documentation
```

## Running the Application

### 1. Backend Setup
Navigate to the `backend/` directory:
- Create Python virtual environment: `python -m venv venv`
- Activate virtual environment:
  - Windows: `.\venv\Scripts\activate`
  - macOS/Linux: `source venv/bin/activate`
- Install dependencies: `pip install -r requirements.txt`
- Set up environment variables in `.env` (copied from `.env.example`)
- Run with Uvicorn: `uvicorn app.main:app --reload`

### 2. Frontend Setup
Navigate to the `frontend/` directory:
- Install dependencies: `npm install`
- Copy environment configuration: `cp .env.example .env.local`
- Start local development server: `npm run dev`
