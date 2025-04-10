import React, { useState, useEffect, useRef } from 'react';
import Building from './components/Building';
import Controls from './components/Controls';
import EventStream from './components/EventStream';
import Statistics from './components/Statistics';
import { api, createWebSocketClient } from './api/api';
import './App.css';

function App() {
  // Application state
  const [isRunning, setIsRunning] = useState(false);
  const [simulationState, setSimulationState] = useState(null);
  const [events, setEvents] = useState([]);
  const wsClientRef = useRef(null);
  
  // Initialize WebSocket connection only once
  useEffect(() => {
    // Only create a new connection if one doesn't exist
    if (!wsClientRef.current) {
      wsClientRef.current = createWebSocketClient(
        (data) => {
          if (data.type === 'state_update') {
            setSimulationState(data.data);
          }
        },
        () => console.log('WebSocket connected'),
        () => {
          console.log('WebSocket disconnected');
          // Set a timeout to attempt reconnection
          setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            wsClientRef.current = null; // Clear the ref so we can create a new connection
          }, 3000);
        }
      );
    }
    
    // Cleanup function - properly close the connection when component unmounts
    return () => {
      if (wsClientRef.current) {
        console.log('Closing WebSocket connection on unmount');
        wsClientRef.current.close();
        wsClientRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this only runs once on mount
  
  // Fetch initial simulation status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await api.getStatus();
        setIsRunning(response.data.running);
      } catch (error) {
        console.error('Failed to fetch simulation status:', error);
      }
    };
    
    fetchStatus();
  }, []);
  
  // Fetch events periodically - only when simulation is running
  useEffect(() => {
    let interval;
    
    const fetchEvents = async () => {
      try {
        const response = await api.getEvents(100);
        if (response.data && response.data.events) {
          setEvents(response.data.events);
        }
      } catch (error) {
        console.error('Failed to fetch events:', error);
      }
    };
    
    if (isRunning) {
      fetchEvents(); // Fetch immediately when simulation starts
      interval = setInterval(fetchEvents, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);
  
  // Handler for starting the simulation
  const handleStartSimulation = async (config) => {
    try {
      await api.startSimulation(config);
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start simulation:', error);
      alert('Failed to start simulation: ' + error.response?.data?.detail || error.message);
    }
  };
  
  // Handler for stopping the simulation
  const handleStopSimulation = async () => {
    try {
      await api.stopSimulation();
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop simulation:', error);
    }
  };
  
  // Handler for resetting the simulation
  const handleResetSimulation = async () => {
    try {
      await api.resetSimulation();
      setEvents([]);
      setSimulationState(null);
    } catch (error) {
      console.error('Failed to reset simulation:', error);
    }
  };
  
  // Handler for updating simulation configuration
  const handleConfigUpdate = async (config) => {
    try {
      await api.updateConfiguration(config);
    } catch (error) {
      console.error('Failed to update configuration:', error);
    }
  };
  
  // Handler for calling an elevator
  const handleCallElevator = async (floor, direction) => {
    try {
      await api.pressButton(floor, direction);
    } catch (error) {
      console.error('Failed to call elevator:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Elevator Scheduling Visualization</h1>
        <p className="text-gray-600">Visualize and analyze elevator movement patterns in a 25-floor building</p>
      </header>
      
      <div className="grid grid-cols-12 gap-6">
        {/* Left column - Building visualization */}
        <div className="col-span-8 grid grid-rows-[minmax(600px,1fr)] gap-6">
          <Building 
            simulationState={simulationState} 
            onCallElevator={handleCallElevator} 
          />
        </div>
        
        {/* Right column - Controls and data */}
        <div className="col-span-4 grid grid-rows-2 gap-6">
          <Controls 
            isRunning={isRunning}
            onStart={handleStartSimulation}
            onStop={handleStopSimulation}
            onReset={handleResetSimulation}
            onConfigUpdate={handleConfigUpdate}
          />
          
          <Statistics simulationState={simulationState} />
        </div>
        
        {/* Bottom row - Event stream */}
        <div className="col-span-12 h-80">
          <EventStream events={events} />
        </div>
      </div>
      
      <footer className="mt-6 text-center text-gray-500 text-sm">
        Elevator Scheduling Visualization System &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default App;