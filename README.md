# Expothesis - Real-time A/B Testing Platform

Expothesis is a high-performance, real-time experimentation platform designed for scale. Built with **Rust**, **React**, and **ClickHouse**, it provides sub-second statistical analysis on millions of events.

![Expothesis Dashboard](https://via.placeholder.com/1000x500?text=Expothesis+Live+Analytics+Dashboard)

## 🚀 Key Features

-   **High-Performance Ingestion**: Leverages ClickHouse's `MergeTree` engine to ingest and aggregate thousands of events per second.
-   **Real-time Statistical Engine**: Live Z-tests (proportions) and Welch's T-tests (continuous) powered by specialized ClickHouse queries.
-   **Advanced Targeting Rules**: Rule-based user group management using a flexible JSON-based editor for complex targeting (regex, hash-based, manual).
-   **Live Dashboard**: Real-time visualization of experiment progress with a 5-second polling interval and "Live" status synchronization.
-   **Experiment Lifecycle**: Full management of experiment states (Draft, Running, Paused, Stopped).
-   **Hypothesis Tracking**: Structured management of null and alternative hypotheses with power analysis and sample size calculators.

## 🏗️ Architecture

-   **Backend**: Rust (Actix-web) - Optimized for safety and speed.
-   **Frontend**: React (Vite, TypeScript, Tailwind) - Rich, responsive UI with live data synchronization.
-   **Database**: ClickHouse - Distributed OLAP database for massive scale analytics.
-   **Infrastructure**: Fully containerized with Docker Compose.

## 🛠️ Quick Start

### Prerequisites
- Docker & Docker Compose

### Running the Platform
1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/expothesis.git
    cd expothesis
    ```
2.  **Start all services**:
    ```bash
    docker-compose up --build
    ```
3.  **Access the Dashboard**:
    -   Frontend: [http://localhost:3000](http://localhost:3000)
    -   Backend API: [http://localhost:8080](http://localhost:8080)
    -   ClickHouse: [http://localhost:8123](http://localhost:8123)
    -   Postgres: [http://localhost:5432](http://localhost:5432)

## 📊 Live Testing & Simulation

We provide a specialized data generator to simulate real-world traffic and verify the statistical engine.

1.  **Create an experiment** via the UI at [http://localhost:3000/create](http://localhost:3000/create).
2.  **Run the generator**:
    ```bash
    python3 scripts/generate_live_data.py [EXPERIMENT_ID]
    ```
    *Note: The script will automatically create test user groups and simulate a 20% conversion lift in the treatment variant.*

## 📖 API Reference

### Experiment Management
-   `POST /api/experiments` - Create new experiment
-   `GET /api/experiments` - List all experiments
-   `POST /api/experiments/:id/start` - Start an experiment
-   `GET /api/experiments/:id/analysis` - Fetch real-time statistical analysis

### Event Ingestion
-   `POST /api/events` - Ingest an event row
    ```json
    {
      "experiment_id": "uuid",
      "user_id": "string",
      "variant": "string",
      "metric_name": "string",
      "metric_value": 1.0
    }
    ```

### User Group Assignment
-   `POST /api/user-groups/assign` - Assign a user to a specific variant and group combination.

## 🔧 Development

### Backend (Rust)
```bash
cd backend
cargo run
```

### Auth + 2FA (TOTP)
Set environment variables for JWT + optional LiteLLM:
```bash
export JWT_SECRET=change-me
export JWT_TTL_MINUTES=60
export ALLOW_DEV_OTP=1
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## 📜 License
MIT
