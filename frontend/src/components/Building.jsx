import React, { useEffect, useState } from 'react';
// import { api } from '../api/api';

// Special floor types
const SPECIAL_FLOORS = {
  LOBBY: 1,
  AMENITIES: 2,
  ROOFTOP: 25
};

// Floor colors
const FLOOR_COLORS = {
  [SPECIAL_FLOORS.LOBBY]: 'bg-blue-100',
  [SPECIAL_FLOORS.AMENITIES]: 'bg-green-100',
  [SPECIAL_FLOORS.ROOFTOP]: 'bg-purple-100',
  DEFAULT: 'bg-gray-100'
};

// Elevator colors by state
const ELEVATOR_COLORS = {
  MOVING: 'bg-yellow-500',
  STOPPED: 'bg-gray-500',
  LOADING: 'bg-green-500',
  IDLE: 'bg-gray-400'
};

// Direction indicators
const DirectionIndicator = ({ direction }) => {
  if (direction === 'UP') {
    return <div className="text-green-600">▲</div>;
  } else if (direction === 'DOWN') {
    return <div className="text-red-600">▼</div>;
  }
  return <div className="text-gray-600">■</div>;
};

// Floor component
const Floor = ({ floorNumber, totalFloors, waitingPassengers, onCallElevator }) => {
  // const isSpecialFloor = Object.values(SPECIAL_FLOORS).includes(floorNumber);
  const floorColor = FLOOR_COLORS[floorNumber] || FLOOR_COLORS.DEFAULT;
  const floorLabel = (() => {
    if (floorNumber === SPECIAL_FLOORS.LOBBY) return 'L';
    if (floorNumber === SPECIAL_FLOORS.AMENITIES) return 'A';
    if (floorNumber === SPECIAL_FLOORS.ROOFTOP) return 'R';
    return floorNumber.toString();
  })();
  
  // Determine which buttons should be visible
  // Top floor only has down button, first floor only has up button
  const showUpButton = floorNumber < totalFloors;
  const showDownButton = floorNumber > 1;
  
  return (
    <div className={`flex items-center h-12 ${floorColor} border-b border-gray-300`}>
      {/* Floor label */}
      <div className="w-10 text-center font-bold">
        {floorLabel}
      </div>
      
      {/* Floor buttons */}
      <div className="flex space-x-2 ml-4">
        {showUpButton && (
          <button 
            className="w-8 h-8 bg-gray-200 hover:bg-green-200 rounded-full flex items-center justify-center"
            onClick={() => onCallElevator(floorNumber, 'up')}
          >
            ▲
          </button>
        )}
        {showDownButton && (
          <button 
            className="w-8 h-8 bg-gray-200 hover:bg-red-200 rounded-full flex items-center justify-center"
            onClick={() => onCallElevator(floorNumber, 'down')}
          >
            ▼
          </button>
        )}
      </div>
      
      {/* Waiting passengers indicator */}
      {waitingPassengers > 0 && (
        <div className="ml-4 bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
          {waitingPassengers}
        </div>
      )}
    </div>
  );
};

// Elevator component
const Elevator = ({ elevator, floorHeight, totalFloors }) => {
  // Calculate elevator position based on current floor
  const topPosition = (totalFloors - elevator.current_floor) * floorHeight;
  const state = elevator.state || 'IDLE';
  const elevatorColor = ELEVATOR_COLORS[state];
  
  // Determine if elevator is in transition (between floors)
  const isMoving = state === 'MOVING';
  // const isBetweenFloors = elevator.current_floor !== Math.floor(elevator.current_floor);
  
  return (
    <div 
      className={`absolute w-12 h-10 ${elevatorColor} border border-gray-700 rounded transition-all duration-100`}
      style={{ 
        top: `${topPosition}px`,
        transition: isMoving ? 'top 0.5s linear' : 'none'
      }}
    >
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-xs font-bold text-white">{elevator.id + 1}</div>
        <DirectionIndicator direction={elevator.direction} />
        
        {/* Passenger count */}
        {elevator.passengers > 0 && (
          <div className="text-xs text-white">
            {elevator.passengers}
          </div>
        )}
      </div>
    </div>
  );
};

// Building component - main visualization
const Building = ({ simulationState, onCallElevator }) => {
  const [elevators, setElevators] = useState([]);
  const [waitingPassengers, setWaitingPassengers] = useState({});
  const [totalFloors, setTotalFloors] = useState(25);
  
  // Update simulation data when state changes
  useEffect(() => {
    if (simulationState) {
      setElevators(simulationState.elevators || []);
      setWaitingPassengers(simulationState.waiting_passengers || {});
      setTotalFloors(simulationState.floors || 25);
    }
  }, [simulationState]);

  // Generate floors array in reverse order (top to bottom)
  const floors = Array.from({ length: totalFloors }, (_, i) => totalFloors - i);
  const floorHeight = 48; // Height of each floor in pixels
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <h2 className="text-xl font-bold mb-4">Building Visualization</h2>
      
      <div className="relative">
        {/* Floors */}
        <div className="relative">
          {floors.map(floorNumber => (
            <Floor 
              key={floorNumber}
              floorNumber={floorNumber}
              totalFloors={totalFloors}
              waitingPassengers={waitingPassengers[floorNumber] || 0}
              onCallElevator={onCallElevator}
            />
          ))}
        </div>
        
        {/* Elevator shafts */}
        <div className="absolute inset-0 flex justify-center space-x-16">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative w-12 h-full bg-gray-200">
              {/* Elevator position indicator lines */}
              {floors.map(floorNumber => (
                <div 
                  key={floorNumber}
                  className="absolute w-full border-t border-dashed border-gray-300"
                  style={{ top: `${(totalFloors - floorNumber) * floorHeight}px` }}
                />
              ))}
            </div>
          ))}
        </div>
        
        {/* Elevators */}
        <div className="absolute inset-0">
          {elevators.map((elevator, i) => (
            <div key={i} className="absolute" style={{ left: `${70 + i * 64}px` }}>
              <Elevator 
                elevator={elevator}
                floorHeight={floorHeight}
                totalFloors={totalFloors}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Building;