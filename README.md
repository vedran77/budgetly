# Budgetly - Personal Finance Dashboard

A modern personal finance management application built with Next.js and Express.js.

## Quick Start with Docker

### Prerequisites
- Docker and Docker Compose installed

### Setup
1. Clone the repository
2. Start the database services:
   ```bash
   npm run docker:up
   ```

3. Run database migrations:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

4. Start the development servers:
   ```bash
   # Backend (runs on port 3001)
   npm run dev

   # Frontend (in another terminal)
   cd frontend
   npm run dev
   ```

### Services
- **PostgreSQL Database**: http://localhost:5432
  - Database: `budgetly`
  - Username: `budgetly_user`
  - Password: `budgetly_password`

- **pgAdmin**: http://localhost:8080
  - Email: `admin@budgetly.com`
  - Password: `admin123`

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Docker Commands
```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# Restart services
npm run docker:restart

# Complete setup (start Docker + migrate + generate)
npm run setup
```

### Database Management
```bash
# Generate Prisma client
npm run db:generate

# Push schema changes (for development)
npm run db:push

# Create and run migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

## Development
- Backend runs on port 3001
- Frontend runs on port 3000
- Hot reload enabled for both frontend and backend