import React, { useState, useEffect } from 'react';
import { api } from '../api/api';

/**
 * Simulation Controls Component
 * 
 * Provides controls for starting, stopping, and configuring the simulation.
 */
const Controls = ({ isRunning, onStart, onStop, onReset, onConfigUpdate }) => {
  const [config, setConfig] = useState({
    num_elevators: 6,
    num_floors: 25,
    time_scale: 1.0,
    passenger_rate: 1.0
  });
  
  const [customPassenger, setCustomPassenger] = useState({
    start_floor: 1,
    destination_floor: 10
  });
  
  // Load current config when component mounts
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.getConfiguration();
        if (response.data) {
          setConfig(prevConfig => ({
            ...prevConfig,
            num_elevators: response.data.num_elevators,
            num_floors: response.data.num_floors,
            time_scale: response.data.time_scale
          }));
        }
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    
    loadConfig();
  }, []);
  
  // Handle configuration changes
  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;
    
    // Parse numeric inputs
    if (name === 'num_elevators' || name === 'num_floors') {
      parsedValue = parseInt(value, 10);
    } else if (name === 'time_scale' || name === 'passenger_rate') {
      parsedValue = parseFloat(value);
    }
    
    setConfig({
      ...config,
      [name]: parsedValue
    });
  };
  
  // Handle passenger input changes
  const handlePassengerChange = (e) => {
    const { name, value } = e.target;
    setCustomPassenger({
      ...customPassenger,
      [name]: parseInt(value, 10)
    });
  };
  
  // Handle form submissions
  const handleStartSimulation = (e) => {
    e.preventDefault();
    onStart(config);
  };
  
  const handleAddPassenger = async (e) => {
    e.preventDefault();
    if (customPassenger.start_floor === customPassenger.destination_floor) {
      alert('Start and destination floors must be different');
      return;
    }
    
    try {
      await api.addPassenger(customPassenger.start_floor, customPassenger.destination_floor);
    } catch (error) {
      console.error('Failed to add passenger:', error);
      alert('Failed to add passenger: ' + error.response?.data?.detail || error.message);
    }
  };
  
  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    if (onConfigUpdate) {
      onConfigUpdate(config);
    }
  };
  
  // Generate floor options for select inputs
  const floorOptions = Array.from({ length: config.num_floors }, (_, i) => i + 1);
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-xl font-bold mb-4">Simulation Controls</h2>
      
      {/* Simulation state controls */}
      <div className="flex space-x-4 mb-6">
        {!isRunning ? (
          <button
            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded"
            onClick={handleStartSimulation}
          >
            Start Simulation
          </button>
        ) : (
          <button
            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
            onClick={onStop}
          >
            Stop Simulation
          </button>
        )}
        
        <button
          className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded"
          onClick={onReset}
        >
          Reset Simulation
        </button>
      </div>
      
      {/* Configuration form */}
      <form onSubmit={handleUpdateConfig} className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Simulation Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Scale
            </label>
            <input
              type="range"
              name="time_scale"
              min="0.1"
              max="5"
              step="0.1"
              value={config.time_scale}
              onChange={handleConfigChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-sm text-gray-600 mt-1">
              {config.time_scale}x speed
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Passenger Rate
            </label>
            <input
              type="range"
              name="passenger_rate"
              min="0.1"
              max="5"
              step="0.1"
              value={config.passenger_rate}
              onChange={handleConfigChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-sm text-gray-600 mt-1">
              {config.passenger_rate}x rate
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Elevators
            </label>
            <input
              type="number"
              name="num_elevators"
              min="1"
              max="10"
              value={config.num_elevators}
              onChange={handleConfigChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={isRunning}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Floors
            </label>
            <input
              type="number"
              name="num_floors"
              min="5"
              max="50"
              value={config.num_floors}
              onChange={handleConfigChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              disabled={isRunning}
            />
          </div>
        </div>
        
        <button
          type="submit"
          className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded"
          disabled={!isRunning && config.num_elevators === 6 && config.num_floors === 25}
        >
          Update Configuration
        </button>
      </form>
      
      {/* Add passenger form */}
      <form onSubmit={handleAddPassenger}>
        <h3 className="text-lg font-semibold mb-2">Add Custom Passenger</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Floor
            </label>
            <select
              name="start_floor"
              value={customPassenger.start_floor}
              onChange={handlePassengerChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {floorOptions.map(floor => (
                <option key={`start-${floor}`} value={floor}>
                  {floor === 1 ? "1 (Lobby)" : floor === 2 ? "2 (Amenities)" : floor === config.num_floors ? `${floor} (Rooftop)` : floor}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination Floor
            </label>
            <select
              name="destination_floor"
              value={customPassenger.destination_floor}
              onChange={handlePassengerChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              {floorOptions.map(floor => (
                <option key={`dest-${floor}`} value={floor}>
                  {floor === 1 ? "1 (Lobby)" : floor === 2 ? "2 (Amenities)" : floor === config.num_floors ? `${floor} (Rooftop)` : floor}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          type="submit"
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
          disabled={!isRunning || customPassenger.start_floor === customPassenger.destination_floor}
        >
          Add Passenger
        </button>
      </form>
    </div>
  );
};

export default Controls;