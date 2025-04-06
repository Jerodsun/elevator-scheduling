"""
FastAPI Backend for Elevator Simulation

This module provides a REST API and WebSocket server for the elevator simulation system.
"""
import asyncio
import json
import uvicorn
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

from simulation.elevator_simulation import ElevatorSystem, PassengerGenerator, Direction

# Initialize FastAPI app
app = FastAPI(
    title="Elevator Simulation API",
    description="REST API for an elevator simulation system",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulation objects
elevator_system = ElevatorSystem(num_elevators=6, num_floors=25, time_scale=1.0)
passenger_generator = PassengerGenerator(elevator_system)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Connection might be closed or invalid
                pass


manager = ConnectionManager()

# Tasks and loops
simulation_task = None
generator_task = None
broadcast_task = None


# Models for API endpoints
class SimulationConfig(BaseModel):
    num_elevators: Optional[int] = 6
    num_floors: Optional[int] = 25
    time_scale: Optional[float] = 1.0
    passenger_rate: Optional[float] = 1.0


class PassengerRequest(BaseModel):
    start_floor: int
    destination_floor: int


class ButtonPress(BaseModel):
    floor: int
    direction: str  # "up" or "down"


# Background tasks for simulation
async def run_simulation():
    await elevator_system.run_simulation()


async def run_passenger_generator(rate: float = 1.0):
    await passenger_generator.generate_passengers(rate=rate)


async def broadcast_state():
    while True:
        if elevator_system.running:
            state = elevator_system.get_system_state()
            await manager.broadcast({"type": "state_update", "data": state})
        await asyncio.sleep(0.2)  # Send updates 5 times per second


# Helper to start all tasks
async def start_all_tasks(passenger_rate: float = 1.0):
    global simulation_task, generator_task, broadcast_task

    # Cancel existing tasks if they're running
    if simulation_task:
        simulation_task.cancel()
    if generator_task:
        generator_task.cancel()
    if broadcast_task:
        broadcast_task.cancel()

    # Create new tasks
    simulation_task = asyncio.create_task(run_simulation())
    generator_task = asyncio.create_task(run_passenger_generator(passenger_rate))
    broadcast_task = asyncio.create_task(broadcast_state())


# API endpoints
@app.get("/")
async def root():
    return {"message": "Elevator Simulation API"}


@app.get("/status")
async def get_status():
    return {
        "running": elevator_system.running,
        "time": elevator_system.simulation_time,
        "elevators": len(elevator_system.elevators),
        "floors": elevator_system.num_floors,
        "waiting_passengers": sum(
            len(passengers)
            for passengers in elevator_system.waiting_passengers.values()
        ),
        "completed_trips": len(elevator_system.completed_passengers),
    }


@app.post("/start")
async def start_simulation(config: SimulationConfig, background_tasks: BackgroundTasks):
    global elevator_system, passenger_generator

    if elevator_system.running:
        return {"message": "Simulation is already running"}

    # Reset or create new simulation with config
    if (
        config.num_elevators != elevator_system.num_elevators
        or config.num_floors != elevator_system.num_floors
    ):
        elevator_system = ElevatorSystem(
            num_elevators=config.num_elevators,
            num_floors=config.num_floors,
            time_scale=config.time_scale,
        )
        passenger_generator = PassengerGenerator(elevator_system)
    else:
        elevator_system.time_scale = config.time_scale
        elevator_system.reset()

    # Start tasks
    background_tasks.add_task(start_all_tasks, config.passenger_rate)

    return {"message": "Simulation started", "config": config.dict()}


@app.post("/stop")
async def stop_simulation():
    if not elevator_system.running:
        return {"message": "Simulation is not running"}

    elevator_system.stop_simulation()
    passenger_generator.stop_generation()

    # Cancel tasks
    if simulation_task:
        simulation_task.cancel()
    if generator_task:
        generator_task.cancel()

    return {"message": "Simulation stopped"}


@app.post("/reset")
async def reset_simulation():
    if elevator_system.running:
        elevator_system.stop_simulation()
        passenger_generator.stop_generation()

        # Cancel tasks
        if simulation_task:
            simulation_task.cancel()
        if generator_task:
            generator_task.cancel()

    elevator_system.reset()

    return {"message": "Simulation reset"}


@app.get("/state")
async def get_state():
    return elevator_system.get_system_state()


@app.get("/elevators")
async def get_elevators():
    return [elevator.to_dict() for elevator in elevator_system.elevators]


@app.get("/elevators/{elevator_id}")
async def get_elevator(elevator_id: int):
    if elevator_id < 0 or elevator_id >= len(elevator_system.elevators):
        raise HTTPException(status_code=404, detail="Elevator not found")

    return elevator_system.elevators[elevator_id].to_dict()


@app.get("/passengers/waiting")
async def get_waiting_passengers():
    return {
        floor: [passenger.to_dict() for passenger in passengers]
        for floor, passengers in elevator_system.waiting_passengers.items()
        if passengers
    }


@app.get("/passengers/completed")
async def get_completed_passengers():
    return [passenger.to_dict() for passenger in elevator_system.completed_passengers]


@app.get("/events")
async def get_events(limit: int = 100, skip: int = 0):
    """Get recent simulation events with pagination."""
    events = elevator_system.event_log
    total = len(events)

    # Sort events by time, newest first
    sorted_events = sorted(events, key=lambda e: e["time"], reverse=True)

    # Apply pagination
    paginated_events = sorted_events[skip : skip + limit]

    return {"total": total, "skip": skip, "limit": limit, "events": paginated_events}


@app.post("/passengers")
async def add_passenger(request: PassengerRequest):
    """Manually add a new passenger to the simulation."""
    if not elevator_system.running:
        raise HTTPException(status_code=400, detail="Simulation is not running")

    if request.start_floor == request.destination_floor:
        raise HTTPException(
            status_code=400, detail="Start and destination floors must be different"
        )

    if request.start_floor < 1 or request.start_floor > elevator_system.num_floors:
        raise HTTPException(
            status_code=400,
            detail=f"Start floor must be between 1 and {elevator_system.num_floors}",
        )

    if (
        request.destination_floor < 1
        or request.destination_floor > elevator_system.num_floors
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Destination floor must be between 1 and {elevator_system.num_floors}",
        )

    passenger = elevator_system.add_passenger(
        request.start_floor, request.destination_floor
    )

    return passenger.to_dict()


@app.post("/button")
async def press_button(request: ButtonPress):
    """Simulate pressing an elevator call button on a floor."""
    if not elevator_system.running:
        raise HTTPException(status_code=400, detail="Simulation is not running")

    if request.floor < 1 or request.floor > elevator_system.num_floors:
        raise HTTPException(
            status_code=400,
            detail=f"Floor must be between 1 and {elevator_system.num_floors}",
        )

    if request.direction.lower() not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="Direction must be 'up' or 'down'")

    # Get direction enum
    direction = Direction.UP if request.direction.lower() == "up" else Direction.DOWN

    # Register the request
    if direction == Direction.UP:
        elevator_system.up_requests.add(request.floor)
    else:
        elevator_system.down_requests.add(request.floor)

    # Assign an elevator
    elevator_system.assign_elevator(request.floor, direction)

    # Log the event
    event = elevator_system.log_event(
        "button_press", {"floor": request.floor, "direction": request.direction.lower()}
    )

    return event


@app.get("/stats")
async def get_statistics():
    """Get various statistics about the simulation."""
    if len(elevator_system.completed_passengers) == 0:
        return {
            "average_wait_time": 0,
            "average_ride_time": 0,
            "average_total_time": 0,
            "total_completed_trips": 0,
            "total_waiting_passengers": sum(
                len(passengers)
                for passengers in elevator_system.waiting_passengers.values()
            ),
            "elevator_utilization": {
                elevator.id: len(elevator.passengers) / elevator.capacity
                for elevator in elevator_system.elevators
            },
        }

    # Calculate statistics from completed passengers
    wait_times = [p.wait_time for p in elevator_system.completed_passengers]
    ride_times = [
        p.ride_time
        for p in elevator_system.completed_passengers
        if p.ride_time is not None
    ]
    total_times = [
        p.total_time
        for p in elevator_system.completed_passengers
        if p.total_time is not None
    ]

    return {
        "average_wait_time": sum(wait_times) / len(wait_times) if wait_times else 0,
        "average_ride_time": sum(ride_times) / len(ride_times) if ride_times else 0,
        "average_total_time": sum(total_times) / len(total_times) if total_times else 0,
        "total_completed_trips": len(elevator_system.completed_passengers),
        "total_waiting_passengers": sum(
            len(passengers)
            for passengers in elevator_system.waiting_passengers.values()
        ),
        "elevator_utilization": {
            elevator.id: len(elevator.passengers) / elevator.capacity
            for elevator in elevator_system.elevators
        },
    }


@app.get("/config")
async def get_configuration():
    """Get current simulation configuration."""
    return {
        "num_elevators": elevator_system.num_elevators,
        "num_floors": elevator_system.num_floors,
        "time_scale": elevator_system.time_scale,
        "is_running": elevator_system.running,
    }


@app.put("/config")
async def update_configuration(
    config: SimulationConfig, background_tasks: BackgroundTasks
):
    """Update simulation configuration."""
    if elevator_system.running:
        # Stop the simulation first
        elevator_system.stop_simulation()
        passenger_generator.stop_generation()

        # Cancel tasks
        if simulation_task:
            simulation_task.cancel()
        if generator_task:
            generator_task.cancel()

    # Update configuration
    was_running = elevator_system.running
    elevator_system.time_scale = config.time_scale

    # Restart if it was running
    if was_running:
        background_tasks.add_task(start_all_tasks, config.passenger_rate)

    return {
        "message": "Configuration updated",
        "config": {
            "num_elevators": elevator_system.num_elevators,
            "num_floors": elevator_system.num_floors,
            "time_scale": elevator_system.time_scale,
        },
    }


# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        # Send initial state
        state = elevator_system.get_system_state()
        await websocket.send_json({"type": "state_update", "data": state})

        # Process messages from client
        while True:
            try:
                data = await websocket.receive_json()
                # Handle WebSocket commands if needed
                command = data.get("command")

                if command == "get_state":
                    state = elevator_system.get_system_state()
                    await websocket.send_json({"type": "state_update", "data": state})

                elif command == "add_passenger":
                    start_floor = data.get("start_floor")
                    destination_floor = data.get("destination_floor")

                    if start_floor and destination_floor:
                        passenger = elevator_system.add_passenger(
                            start_floor, destination_floor
                        )
                        await websocket.send_json(
                            {"type": "passenger_added", "data": passenger.to_dict()}
                        )

                elif command == "press_button":
                    floor = data.get("floor")
                    direction = data.get("direction")

                    if floor and direction:
                        dir_enum = (
                            Direction.UP
                            if direction.lower() == "up"
                            else Direction.DOWN
                        )

                        if dir_enum == Direction.UP:
                            elevator_system.up_requests.add(floor)
                        else:
                            elevator_system.down_requests.add(floor)

                        elevator_system.assign_elevator(floor, dir_enum)

                        await websocket.send_json(
                            {
                                "type": "button_pressed",
                                "data": {"floor": floor, "direction": direction},
                            }
                        )

            except json.JSONDecodeError:
                # Handle invalid JSON
                continue

    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Entry point
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
