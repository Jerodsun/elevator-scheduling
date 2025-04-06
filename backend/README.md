# Elevator Simulation Backend

A FastAPI-based backend with an elevator simulation engine.

## Features

- Configurable elevator system simulation
- Real-time elevator scheduling algorithms
- WebSocket for live updates
- RESTful API for simulation control
- Realistic passenger generation patterns

## Setup

### Prerequisites

- Python 3.11+
- pip or pipenv

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```

### Docker

```bash
# Build and run with Docker
docker build -t elevator-backend .
docker run -p 8000:8000 elevator-backend
```

## API Endpoints

- `POST /start` - Start the simulation
- `POST /stop` - Stop the simulation
- `POST /reset` - Reset the simulation
- `GET /state` - Get current system state
- `GET /statistics` - Get performance statistics
- `POST /passengers` - Add a new passenger
- `POST /button` - Simulate button press
- `GET /events` - Get simulation events
- `WS /ws` - WebSocket for real-time updates

## Simulation Parameters

- `num_elevators` - Number of elevators (default: 6)
- `num_floors` - Number of floors (default: 25)
- `time_scale` - Simulation speed (default: 1.0)
- `passenger_rate` - Rate of passenger generation (default: 1.0)

## Architecture

The simulation core is in `simulation/elevator_simulation.py`, which implements:

- `ElevatorSystem` - Central simulation controller
- `Elevator` - Individual elevator logic
- `PassengerGenerator` - Creates passengers with realistic patterns
