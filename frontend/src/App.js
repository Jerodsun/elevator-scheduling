import React, { useState, useEffect, useCallback } from 'react';
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
  const [wsClient, setWsClient] = useState(null);
  
  // Define initWebSocket as a useCallback to avoid dependency issues
  const initWebSocket = useCallback(() => {
    const client = createWebSocketClient(
      (data) => {
        if (data.type === 'state_update') {
          setSimulationState(data.data);
        }
      },
      () => console.log('WebSocket reconnected'),
      () => {
        console.log('WebSocket disconnected');
        setTimeout(initWebSocket, 3000);
      }
    );
    
    setWsClient(client);
  }, []);
  
  // Initialize WebSocket connection on component mount
  useEffect(() => {
    initWebSocket();
    
    // Cleanup function
    return () => {
      if (wsClient) {
        wsClient.close();
      }
    };
  }, [initWebSocket, wsClient]);
  
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
  
  // Fetch events periodically
  useEffect(() => {
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
      fetchEvents();
      const interval = setInterval(fetchEvents, 2000);
      return () => clearInterval(interval);
    }
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