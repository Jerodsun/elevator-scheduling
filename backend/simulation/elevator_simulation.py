"""
Elevator Simulation Engine

This module implements the core simulation engine for an elevator scheduling system
with 6 elevators in a 25-floor apartment building.
"""
import asyncio
import time
import random
import enum
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Tuple, Any
import json


class Direction(enum.Enum):
    """Elevator movement direction."""

    UP = 1
    DOWN = -1
    IDLE = 0


class ElevatorState(enum.Enum):
    """Current state of an elevator."""

    MOVING = "moving"
    STOPPED = "stopped"
    LOADING = "loading"  # When doors are open and passengers are entering/exiting


@dataclass
class Passenger:
    """Represents a passenger in the simulation."""

    id: int
    start_floor: int
    destination_floor: int
    wait_start_time: float = field(default_factory=time.time)
    elevator_id: Optional[int] = None
    boarding_time: Optional[float] = None
    arrival_time: Optional[float] = None

    @property
    def wait_time(self) -> float:
        """Time the passenger has been waiting for an elevator."""
        if self.boarding_time is None:
            return time.time() - self.wait_start_time
        return self.boarding_time - self.wait_start_time

    @property
    def ride_time(self) -> Optional[float]:
        """Time the passenger spent riding in the elevator."""
        if self.boarding_time is None or self.arrival_time is None:
            return None
        return self.arrival_time - self.boarding_time

    @property
    def total_time(self) -> Optional[float]:
        """Total time from waiting to arrival."""
        if self.arrival_time is None:
            return None
        return self.arrival_time - self.wait_start_time

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "start_floor": self.start_floor,
            "destination_floor": self.destination_floor,
            "wait_start_time": self.wait_start_time,
            "elevator_id": self.elevator_id,
            "boarding_time": self.boarding_time,
            "arrival_time": self.arrival_time,
            "wait_time": self.wait_time,
            "ride_time": self.ride_time,
            "total_time": self.total_time,
        }


@dataclass
class Elevator:
    """Represents an elevator in the simulation."""

    id: int
    current_floor: float = (
        1.0  # Float to represent position between floors during movement
    )
    destination_floor: Optional[int] = None
    direction: Direction = Direction.IDLE
    state: ElevatorState = ElevatorState.STOPPED
    passengers: List[Passenger] = field(default_factory=list)
    target_floors: Set[int] = field(default_factory=set)
    capacity: int = 10
    speed: float = 0.5  # Floors per second
    door_time: float = 2.0  # Seconds to open/close doors and load/unload

    @property
    def is_full(self) -> bool:
        """Check if elevator is at capacity."""
        return len(self.passengers) >= self.capacity

    @property
    def next_floor(self) -> Optional[int]:
        """Get the next floor the elevator will stop at."""
        if not self.target_floors:
            return None

        # If moving up, get the next floor above current
        if self.direction == Direction.UP:
            above_floors = [
                f for f in self.target_floors if f > int(self.current_floor)
            ]
            return min(above_floors) if above_floors else max(self.target_floors)

        # If moving down, get the next floor below current
        elif self.direction == Direction.DOWN:
            below_floors = [
                f for f in self.target_floors if f < int(self.current_floor)
            ]
            return max(below_floors) if below_floors else min(self.target_floors)

        # If idle, get the closest floor
        else:
            return min(self.target_floors, key=lambda f: abs(f - self.current_floor))

    def add_target_floor(self, floor: int) -> None:
        """Add a floor to the elevator's targets."""
        self.target_floors.add(floor)

        # Update direction if elevator is idle
        if self.direction == Direction.IDLE and floor != self.current_floor:
            self.direction = (
                Direction.UP if floor > self.current_floor else Direction.DOWN
            )

    def update_direction(self) -> None:
        """Update the elevator's direction based on target floors."""
        if not self.target_floors:
            self.direction = Direction.IDLE
            return

        next_target = self.next_floor
        if next_target is None:
            self.direction = Direction.IDLE
        elif next_target > int(self.current_floor):
            self.direction = Direction.UP
        elif next_target < int(self.current_floor):
            self.direction = Direction.DOWN
        else:
            # We're at a target floor, keep the same direction
            # unless there are no more floors in this direction
            if self.direction == Direction.UP and all(
                f <= self.current_floor for f in self.target_floors
            ):
                self.direction = Direction.DOWN
            elif self.direction == Direction.DOWN and all(
                f >= self.current_floor for f in self.target_floors
            ):
                self.direction = Direction.UP

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "current_floor": self.current_floor,
            "destination_floor": self.destination_floor,
            "direction": self.direction.name,
            "state": self.state.name,
            "passengers": len(self.passengers),
            "target_floors": list(self.target_floors),
            "is_full": self.is_full,
        }


class ElevatorSystem:
    """Manages the system of elevators and passenger requests."""

    def __init__(
        self, num_elevators: int = 6, num_floors: int = 25, time_scale: float = 1.0
    ):
        self.num_elevators = num_elevators
        self.num_floors = num_floors
        self.time_scale = time_scale
        self.elevators = [Elevator(id=i) for i in range(num_elevators)]
        self.waiting_passengers: Dict[int, List[Passenger]] = {
            floor: [] for floor in range(1, num_floors + 1)
        }
        self.completed_passengers: List[Passenger] = []
        self.passenger_id_counter = 0
        self.event_log: List[Dict[str, Any]] = []
        self.up_requests: Set[int] = set()
        self.down_requests: Set[int] = set()
        self.running = False
        self.simulation_time = 0.0
        self.real_start_time = None

    def reset(self) -> None:
        """Reset the simulation to initial state."""
        self.elevators = [Elevator(id=i) for i in range(self.num_elevators)]
        self.waiting_passengers = {floor: [] for floor in range(1, self.num_floors + 1)}
        self.completed_passengers = []
        self.passenger_id_counter = 0
        self.event_log = []
        self.up_requests = set()
        self.down_requests = set()
        self.simulation_time = 0.0
        self.real_start_time = None

    def log_event(self, event_type: str, details: Dict[str, Any]) -> None:
        """Log an event in the simulation."""
        event = {"time": self.simulation_time, "type": event_type, **details}
        self.event_log.append(event)
        return event

    def add_passenger(self, start_floor: int, destination_floor: int) -> Passenger:
        """Add a new passenger to the simulation."""
        if start_floor == destination_floor:
            raise ValueError("Start and destination floors cannot be the same")

        passenger = Passenger(
            id=self.passenger_id_counter,
            start_floor=start_floor,
            destination_floor=destination_floor,
        )
        self.passenger_id_counter += 1
        self.waiting_passengers[start_floor].append(passenger)

        # Register floor request
        if destination_floor > start_floor:
            self.up_requests.add(start_floor)
        else:
            self.down_requests.add(start_floor)

        event = self.log_event(
            "new_passenger",
            {
                "passenger_id": passenger.id,
                "start_floor": start_floor,
                "destination_floor": destination_floor,
            },
        )

        return passenger

    def get_system_state(self) -> Dict[str, Any]:
        """Get the current state of the entire system."""
        return {
            "time": self.simulation_time,
            "elevators": [elevator.to_dict() for elevator in self.elevators],
            "waiting_passengers": {
                floor: len(passengers)
                for floor, passengers in self.waiting_passengers.items()
                if passengers
            },
            "completed_trips": len(self.completed_passengers),
            "up_requests": list(self.up_requests),
            "down_requests": list(self.down_requests),
        }

    def assign_elevator(self, floor: int, direction: Direction) -> None:
        """Assign the most suitable elevator to a floor request."""
        best_elevator = None
        best_score = float("inf")

        for elevator in self.elevators:
            # Skip full elevators
            if elevator.is_full:
                continue

            # Calculate a score based on distance and direction
            score = abs(elevator.current_floor - floor)

            # Elevators moving in the same direction get priority
            if elevator.direction == direction:
                # If elevator is moving toward the floor, prioritize it
                if (direction == Direction.UP and elevator.current_floor < floor) or (
                    direction == Direction.DOWN and elevator.current_floor > floor
                ):
                    score -= 10  # Significant bonus for elevators already going in the right direction

            # Idle elevators get a slight bonus
            if elevator.direction == Direction.IDLE:
                score -= 5

            # Elevators with fewer stops get priority
            score += len(elevator.target_floors) * 2

            if score < best_score:
                best_score = score
                best_elevator = elevator

        if best_elevator:
            best_elevator.add_target_floor(floor)
            self.log_event(
                "elevator_assigned",
                {
                    "elevator_id": best_elevator.id,
                    "floor": floor,
                    "direction": direction.name,
                },
            )

    async def update_elevators(self) -> List[Dict[str, Any]]:
        """Update the state of all elevators for one time step."""
        events = []
        time_step = 0.1 * self.time_scale  # Base time step adjusted by time scale

        for elevator in self.elevators:
            # Skip elevators that are idle and have no targets
            if elevator.state == ElevatorState.IDLE and not elevator.target_floors:
                continue

            if elevator.state == ElevatorState.MOVING:
                # Calculate new position
                move_distance = elevator.speed * time_step
                if elevator.direction == Direction.UP:
                    elevator.current_floor = min(
                        elevator.current_floor + move_distance,
                        float(elevator.destination_floor),
                    )
                else:
                    elevator.current_floor = max(
                        elevator.current_floor - move_distance,
                        float(elevator.destination_floor),
                    )

                # Check if we've arrived at a destination
                if abs(elevator.current_floor - elevator.destination_floor) < 0.01:
                    elevator.current_floor = float(elevator.destination_floor)
                    elevator.state = ElevatorState.LOADING
                    elevator.target_floors.discard(elevator.destination_floor)

                    # Log arrival event
                    events.append(
                        self.log_event(
                            "elevator_arrived",
                            {
                                "elevator_id": elevator.id,
                                "floor": elevator.destination_floor,
                            },
                        )
                    )

                    # Handle passengers getting off
                    departing_passengers = [
                        p
                        for p in elevator.passengers
                        if p.destination_floor == elevator.destination_floor
                    ]
                    for passenger in departing_passengers:
                        elevator.passengers.remove(passenger)
                        passenger.arrival_time = self.simulation_time
                        self.completed_passengers.append(passenger)

                        events.append(
                            self.log_event(
                                "passenger_arrived",
                                {
                                    "passenger_id": passenger.id,
                                    "elevator_id": elevator.id,
                                    "floor": elevator.destination_floor,
                                    "wait_time": passenger.wait_time,
                                    "ride_time": passenger.ride_time,
                                    "total_time": passenger.total_time,
                                },
                            )
                        )

                    # Handle passengers getting on
                    direction = elevator.direction
                    boarding_passengers = []

                    floor_passengers = self.waiting_passengers[
                        elevator.destination_floor
                    ]

                    # Filter passengers going in the elevator's direction
                    if direction == Direction.UP:
                        potential_passengers = [
                            p
                            for p in floor_passengers
                            if p.destination_floor > elevator.destination_floor
                        ]
                        self.up_requests.discard(elevator.destination_floor)
                    elif direction == Direction.DOWN:
                        potential_passengers = [
                            p
                            for p in floor_passengers
                            if p.destination_floor < elevator.destination_floor
                        ]
                        self.down_requests.discard(elevator.destination_floor)
                    else:
                        # If elevator is now idle, take all waiting passengers
                        potential_passengers = floor_passengers.copy()
                        self.up_requests.discard(elevator.destination_floor)
                        self.down_requests.discard(elevator.destination_floor)

                    # Board as many passengers as capacity allows
                    remaining_capacity = elevator.capacity - len(elevator.passengers)
                    for passenger in potential_passengers[:remaining_capacity]:
                        floor_passengers.remove(passenger)
                        passenger.elevator_id = elevator.id
                        passenger.boarding_time = self.simulation_time
                        elevator.passengers.append(passenger)
                        elevator.add_target_floor(passenger.destination_floor)
                        boarding_passengers.append(passenger)

                    # Log boarding event if passengers boarded
                    if boarding_passengers:
                        events.append(
                            self.log_event(
                                "passengers_boarded",
                                {
                                    "elevator_id": elevator.id,
                                    "floor": elevator.destination_floor,
                                    "passenger_count": len(boarding_passengers),
                                    "passenger_ids": [
                                        p.id for p in boarding_passengers
                                    ],
                                },
                            )
                        )

                    # If floor still has waiting passengers in the same direction, re-add the request
                    if direction == Direction.UP:
                        if any(
                            p.destination_floor > elevator.destination_floor
                            for p in floor_passengers
                        ):
                            self.up_requests.add(elevator.destination_floor)
                    elif direction == Direction.DOWN:
                        if any(
                            p.destination_floor < elevator.destination_floor
                            for p in floor_passengers
                        ):
                            self.down_requests.add(elevator.destination_floor)

                    # Update elevator direction based on remaining targets
                    elevator.update_direction()

            elif elevator.state == ElevatorState.LOADING:
                # After loading time completes, elevator becomes idle or starts moving to next target
                elevator.state = ElevatorState.STOPPED

                # Set next destination if there are target floors
                if elevator.target_floors:
                    next_floor = elevator.next_floor
                    if next_floor is not None:
                        elevator.destination_floor = next_floor
                        elevator.direction = (
                            Direction.UP
                            if next_floor > elevator.current_floor
                            else Direction.DOWN
                        )
                        elevator.state = ElevatorState.MOVING

                        events.append(
                            self.log_event(
                                "elevator_moving",
                                {
                                    "elevator_id": elevator.id,
                                    "from_floor": int(elevator.current_floor),
                                    "to_floor": elevator.destination_floor,
                                    "direction": elevator.direction.name,
                                },
                            )
                        )
                else:
                    elevator.direction = Direction.IDLE
                    elevator.destination_floor = None

                    events.append(
                        self.log_event(
                            "elevator_idle",
                            {
                                "elevator_id": elevator.id,
                                "floor": int(elevator.current_floor),
                            },
                        )
                    )

            elif elevator.state == ElevatorState.STOPPED:
                # Check if there are any new targets
                if elevator.target_floors and elevator.destination_floor is None:
                    next_floor = elevator.next_floor
                    if next_floor is not None:
                        elevator.destination_floor = next_floor
                        elevator.direction = (
                            Direction.UP
                            if next_floor > elevator.current_floor
                            else Direction.DOWN
                        )
                        elevator.state = ElevatorState.MOVING

                        events.append(
                            self.log_event(
                                "elevator_moving",
                                {
                                    "elevator_id": elevator.id,
                                    "from_floor": int(elevator.current_floor),
                                    "to_floor": elevator.destination_floor,
                                    "direction": elevator.direction.name,
                                },
                            )
                        )

        # Process pending requests that haven't been assigned
        for floor in self.up_requests.copy():
            if self.waiting_passengers[floor] and any(
                p.destination_floor > floor for p in self.waiting_passengers[floor]
            ):
                self.assign_elevator(floor, Direction.UP)

        for floor in self.down_requests.copy():
            if self.waiting_passengers[floor] and any(
                p.destination_floor < floor for p in self.waiting_passengers[floor]
            ):
                self.assign_elevator(floor, Direction.DOWN)

        return events

    async def run_simulation(self, max_time: float = None) -> None:
        """Run the simulation until max_time is reached."""
        self.running = True
        self.real_start_time = time.time()

        try:
            while self.running:
                if max_time and self.simulation_time >= max_time:
                    break

                # Update simulation time
                self.simulation_time += 0.1 * self.time_scale

                # Update elevators
                await self.update_elevators()

                # Sleep to control simulation speed
                await asyncio.sleep(0.1)

        except Exception as e:
            self.log_event("simulation_error", {"error": str(e)})
            raise
        finally:
            self.running = False

    def stop_simulation(self) -> None:
        """Stop the running simulation."""
        self.running = False


class PassengerGenerator:
    """Generates passengers with realistic patterns."""

    def __init__(
        self,
        elevator_system: ElevatorSystem,
        time_scale: float = 1.0,
        lobby_floor: int = 1,
        amenity_floor: int = 2,
        rooftop_floor: int = 25,
    ):
        self.elevator_system = elevator_system
        self.time_scale = time_scale
        self.lobby_floor = lobby_floor
        self.amenity_floor = amenity_floor
        self.rooftop_floor = rooftop_floor
        self.running = False

    def get_time_of_day_factor(self, hour: int) -> float:
        """Get multiplier for passenger generation based on time of day."""
        # Morning rush (7-9 AM)
        if 7 <= hour < 9:
            return 2.0
        # Midday (9 AM - 4 PM)
        elif 9 <= hour < 16:
            return 0.7
        # Evening rush (4-7 PM)
        elif 16 <= hour < 19:
            return 1.5
        # Evening (7-11 PM)
        elif 19 <= hour < 23:
            return 1.0
        # Night (11 PM - 7 AM)
        else:
            return 0.3

    def get_destination_floor(self, start_floor: int) -> int:
        """Get a realistic destination floor based on start floor and patterns."""
        num_floors = self.elevator_system.num_floors

        # Probability distributions for different scenarios
        if start_floor == self.lobby_floor:
            # From lobby, people usually go to their apartments
            # Small chance of going to amenity floor or rooftop
            if random.random() < 0.15:
                return self.amenity_floor
            elif random.random() < 0.05:
                return self.rooftop_floor
            else:
                # Distribute evenly among residential floors (3-24)
                return random.randint(3, num_floors - 1)

        elif start_floor == self.amenity_floor:
            # From amenity floor, people usually go to lobby or their apartments
            if random.random() < 0.4:
                return self.lobby_floor
            else:
                # Distribute among residential floors (3-24)
                return random.randint(3, num_floors - 1)

        elif start_floor == self.rooftop_floor:
            # From rooftop, higher chance of going to lobby
            if random.random() < 0.6:
                return self.lobby_floor
            elif random.random() < 0.2:
                return self.amenity_floor
            else:
                # Distribute among residential floors (3-24)
                return random.randint(3, num_floors - 1)

        else:
            # From residential floors, usually go to lobby or amenities
            if random.random() < 0.7:
                return self.lobby_floor
            elif random.random() < 0.2:
                return self.amenity_floor
            elif random.random() < 0.05:
                return self.rooftop_floor
            else:
                # Occasionally go to another residential floor
                dest = random.randint(3, num_floors - 1)
                # Make sure it's not the same floor
                while dest == start_floor:
                    dest = random.randint(3, num_floors - 1)
                return dest

    async def generate_passengers(self, rate: float = 1.0) -> None:
        """Generate passengers based on time of day and floor patterns."""
        self.running = True

        try:
            while self.running:
                # Get current simulation hour (0-23)
                sim_hour = int((self.elevator_system.simulation_time / 60) % 24)

                # Adjust rate based on time of day
                time_factor = self.get_time_of_day_factor(sim_hour)
                adjusted_rate = rate * time_factor

                # Poisson process for passenger arrival
                if random.random() < adjusted_rate * self.time_scale * 0.1:
                    # Choose a random floor for the passenger to start
                    start_floor = random.randint(1, self.elevator_system.num_floors)

                    # Get a realistic destination based on start floor
                    destination_floor = self.get_destination_floor(start_floor)

                    # Make sure destination is different from start
                    while destination_floor == start_floor:
                        destination_floor = self.get_destination_floor(start_floor)

                    # Add the passenger to the system
                    self.elevator_system.add_passenger(start_floor, destination_floor)

                # Sleep to control generation rate
                await asyncio.sleep(0.1)

        except Exception as e:
            print(f"Error in passenger generation: {e}")
        finally:
            self.running = False

    def stop_generation(self) -> None:
        """Stop passenger generation."""
        self.running = False
