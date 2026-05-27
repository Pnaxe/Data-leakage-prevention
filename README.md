# Insider-Driven Data Leakage Detection and Prevention System

Full-stack cybersecurity dashboard for monitoring insider activity, detecting suspicious data leakage behavior, blocking risky actions, raising alerts, and preserving audit trails for investigations.

## Stack

- Frontend: React, Tailwind CSS, Axios, React Router, Chart.js
- Backend: Django, Django REST Framework, SQLite for local development, JWT authentication

## Project Structure

- `client`: React frontend
- `server`: Django REST API backend

## Backend Setup

```bash
cd server
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Run migrations and seed demo data:

```bash
cd server
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Demo accounts:

- `admin` / `admin12345`
- `officer` / `officer12345`
- `user` / `user12345`

## Frontend Setup

```bash
cd client
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the API defaults to `http://localhost:8000/api`.

## API Modules

- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`
- `/api/users/`
- `/api/roles/`
- `/api/sensitive-files/`
- `/api/activity-logs/`
- `/api/alerts/`
- `/api/reports/`
- `/api/detection-rules/`

## Detection and Prevention Rules

The backend evaluates activity logs for:

- Too many downloads in a short time
- Sensitive access outside working hours
- Repeated failed access attempts
- Sensitive uploads, shares, or transfers
- Access to files outside a user's assigned role
- Sudden unusual activity compared to recent behavior

High-risk activity can mark logs as blocked, require approval, raise alerts, and increase the user's risk score.
