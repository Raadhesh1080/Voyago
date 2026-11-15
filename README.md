# Voyago

> Plan, manage and book trips — all from one dashboard.

**Voyago** is a production-grade, microservices-based trip planning platform with a React admin dashboard, JWT authentication, dual-database architecture, and full DevOps pipeline support.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Services](#services)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Docker (Recommended)](#option-1-docker-recommended)
  - [Local Development](#option-2-local-development)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Admin Dashboard](#admin-dashboard)
- [CI/CD Pipeline](#cicd-pipeline)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Testing](#testing)
- [Service URLs](#service-urls)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                          ┌─────────────────┐
                          │   Nginx (SSL)    │
                          │  :80 / :443      │
                          └────────┬────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
           ┌────────▼────────┐         ┌──────────▼────────┐
           │  Admin Dashboard │         │    API Gateway     │
           │  React + MUI    │         │  Express + JWT     │
           │  :3005 (Docker) │         │  :3009 (local)     │
           └─────────────────┘         └──────────┬─────────┘
                                                  │
              ┌───────────────┬──────────────┬───┴──────────────┐
              │               │              │                   │
    ┌─────────▼──┐  ┌─────────▼──┐  ┌───────▼────┐  ┌──────────▼──┐
    │Auth Service│  │User Service│  │Trip Svc    │  │Payment Svc  │
    │  :3001     │  │  :3002     │  │  :3003     │  │  :3004      │
    └─────┬──────┘  └─────┬──────┘  └──────┬─────┘  └──────┬──────┘
          │               │                │               │
          └───────────────┴────────────────┴───────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
           ┌────────▼────────┐         ┌──────────▼────────┐
           │   PostgreSQL    │         │      Neo4j         │
           │  Relational DB  │         │    Graph DB        │
           └─────────────────┘         └───────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Material-UI v5, React Router v6, Axios |
| **API Gateway** | Node.js, Express, JWT, express-rate-limit |
| **Microservices** | Node.js, Express, Joi validation, Winston logging |
| **Databases** | PostgreSQL 15 (relational), Neo4j 5 (graph) |
| **Auth** | JWT (jsonwebtoken), bcrypt |
| **Payments** | Stripe, PayPal Checkout SDK |
| **Observability** | Jaeger (distributed tracing), Winston (structured logging) |
| **Secret Management** | HashiCorp Vault |
| **Containerization** | Docker, Docker Compose |
| **Orchestration** | Kubernetes |
| **CI/CD** | Jenkins, Ansible |
| **Code Quality** | SonarQube, Jest |
| **Reverse Proxy** | Nginx (SSL/TLS termination) |

---

## Services

| Service | Port | Responsibility |
|---|---|---|
| **API Gateway** | 3009 (local) / 3000 (Docker) | Request routing, JWT verification, rate limiting |
| **Auth Service** | 3001 | Registration, login, token verification |
| **User Service** | 3002 | User CRUD, role management |
| **Trip Service** | 3003 | Trip packages, destinations, accommodations |
| **Payment Service** | 3004 | Stripe & PayPal integration, payment methods |
| **Admin Dashboard** | 3005 (Docker) | React SPA served via Nginx |

---

## Prerequisites

- **Node.js** v18+ and **npm** v9+
- **Docker** and **Docker Compose** v2+
- **PostgreSQL** 15 (for local dev without Docker)
- **Git**

---

## Quick Start

### Option 1: Docker (Recommended)

**1. Clone and configure**

```bash
git clone <repository-url>
cd voyago
cp .env.example .env
# Edit .env and set strong passwords for production
```

**2. Fix Docker permissions (Linux)**

```bash
sudo usermod -aG docker $USER && newgrp docker
```

**3. Generate SSL certificates**

```bash
./generate-ssl.sh
```

**4. Start all services**

```bash
docker compose up -d --build
```

**5. Wait for initialization (~2–3 minutes), then verify**

```bash
docker compose ps
# All services should show "healthy"
```

**6. Access the application**

| | |
|---|---|
| **URL** | https://localhost |
| **Email** | admin@voyago.com |
| **Password** | Admin@123 |

> Accept the self-signed SSL certificate warning in your browser.

---

### Option 2: Local Development

Run backend services and the React dev server separately.

**Terminal 1 — Start databases** (requires Docker for PostgreSQL and Neo4j)

```bash
docker compose -f docker-compose-simple.yml up -d
```

**Terminal 2 — Start backend services**

```bash
./start-backend.sh
# Wait for "=== Backend Ready ===" message
```

**Terminal 3 — Start the admin dashboard**

```bash
./start-frontend.sh
# Opens automatically at http://localhost:3000
```

**Login**

| | |
|---|---|
| **URL** | http://localhost:3000 |
| **Email** | admin@voyago.com |
| **Password** | Admin@123 |

**Stop all services**

```bash
pkill -f 'node src/index.js'   # Stop backend
pkill -f react-scripts          # Stop frontend
docker compose -f docker-compose-simple.yml down  # Stop databases
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all values before running.

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_USER` | PostgreSQL username | `voyago_admin` |
| `POSTGRES_PASSWORD` | PostgreSQL password | — |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | — |
| `JWT_SECRET` | Secret key for signing JWTs | — |
| `VAULT_TOKEN` | HashiCorp Vault root token | `dev-root-token` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_...` |
| `PAYPAL_CLIENT_ID` | PayPal app client ID | — |
| `PAYPAL_CLIENT_SECRET` | PayPal app client secret | — |

> **Security**: Never commit `.env` to version control. Generate a strong `JWT_SECRET` with `openssl rand -hex 32`.

---

## API Reference

All API requests go through the **API Gateway**. Authenticated routes require a `Bearer` token in the `Authorization` header.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a new user |
| `POST` | `/api/auth/login` | Public | Login and receive JWT |
| `POST` | `/api/auth/verify` | Bearer | Verify token and return user |

**Login example**

```bash
curl -X POST http://localhost:3009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voyago.com","password":"Admin@123"}'
```

```json
{
  "user": { "id": "...", "email": "admin@voyago.com", "role": "admin" },
  "token": "<jwt>"
}
```

### Users _(Admin only)_

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List users (paginated) |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create user |
| `PUT` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |

### Trips

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/trips` | Public | List trip packages |
| `GET` | `/api/trips/:id` | Public | Get trip details |
| `POST` | `/api/trips` | Admin | Create trip package |
| `PUT` | `/api/trips/:id` | Admin | Update trip package |
| `DELETE` | `/api/trips/:id` | Admin | Delete trip package |

### Destinations _(Admin only)_

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/destinations` | List all destinations |
| `POST` | `/api/destinations` | Create destination |
| `PUT` | `/api/destinations/:id` | Update destination |
| `DELETE` | `/api/destinations/:id` | Delete destination |

### Payment Methods _(Admin only)_

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payment-methods` | List payment methods |
| `POST` | `/api/payment-methods` | Add payment method |
| `PUT` | `/api/payment-methods/:id` | Update payment method |
| `DELETE` | `/api/payment-methods/:id` | Delete payment method |

### Health Checks

```bash
curl http://localhost:3009/health   # API Gateway
curl http://localhost:3001/health   # Auth Service
curl http://localhost:3002/health   # User Service
curl http://localhost:3003/health   # Trip Service
curl http://localhost:3004/health   # Payment Service
```

---

## Database Schema

### PostgreSQL (Relational)

```
users
├── id (UUID, PK)
├── email (unique)
├── password_hash
├── first_name / last_name
├── role  ('admin' | 'user')
├── phone, is_active
└── created_at / updated_at

trips
├── id (UUID, PK)
├── title, description
├── price, duration_days
├── start_date / end_date
├── max_participants / current_participants
└── status  ('active' | 'inactive' | 'cancelled' | 'completed')

destinations       → trip_destinations (many-to-many join)
accommodations     → belongs to trip
transportation     → belongs to trip
activities         → belongs to trip
bookings           → user × trip
payments           → booking × payment_method
payment_methods    → Stripe / PayPal config
```

### Neo4j (Graph)

Used for graph-based relationship queries between trip destinations, routes, and recommendations.

---

## Admin Dashboard

Built with **React 18** and **Material-UI v5**.

**Features**

- JWT-based authentication with protected routes
- Users — full CRUD with role and status management
- Trips — full CRUD with date pickers and status control
- Payment Methods — Stripe & PayPal configuration management
- Toast notifications for all actions
- Responsive layout with collapsible sidebar
- Confirmation dialogs on destructive actions

---

## CI/CD Pipeline

The Jenkins pipeline (`Jenkinsfile`) runs the following stages:

```
Checkout
  └─ Install Dependencies (parallel across all services)
       └─ Run Tests (parallel)
            └─ SonarQube Analysis
                 └─ Quality Gate
                      └─ Build Docker Images (parallel)
                           └─ Deploy via Ansible (main branch only)
```

**SonarQube** is configured via `sonar-project.properties` with a minimum **70% coverage** quality gate.

**Ansible** deploys using `ansible/deploy.yml` with inventory defined in `ansible/inventory/hosts`.

---

## Kubernetes Deployment

Manifests are located in `kubernetes/deployment.yml`. The setup includes:

- `Namespace`: `voyago-system`
- `ConfigMap` for non-sensitive configuration
- `Secret` for credentials (PostgreSQL, Neo4j, JWT)
- `Deployment` + `Service` for PostgreSQL, Auth Service, and API Gateway
- `LoadBalancer` service for the API Gateway

**Apply**

```bash
# Create namespace and secrets
kubectl apply -f kubernetes/deployment.yml

# Verify
kubectl get all -n voyago-system
```

---

## Testing

**Run tests for a specific service**

```bash
cd services/auth-service && npm test
cd services/user-service && npm test
cd services/trip-service && npm test
cd services/payment-service && npm test
```

**Run with coverage**

```bash
npm test -- --coverage
```

Coverage threshold is set at **70%** (enforced by SonarQube quality gate).

**Manual API test after login**

```bash
TOKEN=$(curl -s -X POST http://localhost:3009/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@voyago.com","password":"Admin@123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

curl http://localhost:3009/api/users \
  -H "Authorization: Bearer $TOKEN"
```

---

## Service URLs

### Docker

| Service | URL |
|---|---|
| Admin Dashboard | https://localhost |
| API Gateway | https://localhost/api |
| Jaeger Tracing UI | http://localhost:16686 |
| Neo4j Browser | http://localhost:7474 |
| HashiCorp Vault | http://localhost:8200 |

### Local Development

| Service | URL |
|---|---|
| Admin Dashboard (CRA) | http://localhost:3000 |
| API Gateway | http://localhost:3009 |
| Auth Service | http://localhost:3001 |
| User Service | http://localhost:3002 |
| Trip Service | http://localhost:3003 |
| Payment Service | http://localhost:3004 |

---

## Troubleshooting

**Docker permission denied**
```bash
sudo usermod -aG docker $USER && newgrp docker
```

**Services not healthy after `docker compose up`**
```bash
docker compose logs        # View all logs
docker compose logs auth-service   # View specific service
docker compose restart postgres    # Restart a service
```

**Port already in use (local dev)**
```bash
pkill -f 'node src/index.js'    # Kill all Node services
pkill -f react-scripts           # Kill CRA dev server
```

**Database connection errors**
```bash
# Verify PostgreSQL is running
docker compose ps postgres
# Inspect logs
docker compose logs postgres
```

**Login fails with CORS error**

Ensure the API Gateway is running and the frontend's `REACT_APP_API_URL` matches the gateway port. The gateway dynamically allows all `localhost` origins for local development.

**"id is not allowed" on edit**

This was a Joi validation bug fixed in v1.0.1 — ensure you're on the latest code.

**Reset everything and start fresh**
```bash
docker compose down -v
docker compose up -d --build
```

---

## Docker Commands Reference

```bash
docker compose up -d --build        # Start all services (build images)
docker compose ps                   # Check service status
docker compose logs -f              # Stream all logs
docker compose logs -f auth-service # Stream specific service logs
docker compose restart user-service # Restart a service
docker compose down                 # Stop all services
docker compose down -v              # Stop and remove volumes
docker compose up -d --scale trip-service=3  # Scale a service
```

---

## Project Structure

```
voyago/
├── admin-dashboard/          # React + MUI frontend
│   └── src/
│       ├── components/       # Dashboard, Login, Users, Trips, PaymentMethods
│       └── context/          # AuthContext (JWT management)
├── services/
│   ├── api-gateway/          # Request routing & JWT auth
│   ├── auth-service/         # Login, register, token verify
│   ├── user-service/         # User CRUD
│   ├── trip-service/         # Trip & destination CRUD
│   └── payment-service/      # Stripe & PayPal
├── database/
│   └── postgres/init.sql     # Schema + seed data
├── nginx/                    # Reverse proxy + SSL config
├── ansible/                  # Deployment playbooks
├── kubernetes/               # K8s manifests
├── docker-compose.yml        # Full production stack
├── docker-compose-simple.yml # Databases only (for local dev)
├── start-backend.sh          # Local backend launcher
├── start-frontend.sh         # Local frontend launcher
├── Jenkinsfile               # CI/CD pipeline
└── .env.example              # Environment variable template
```

---

## License

This project is licensed under the MIT License.
