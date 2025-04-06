/**
 * API Client for Elevator Simulation
 * 
 * This module provides functions to interact with the backend API
 * and establishes a WebSocket connection for real-time updates.
 */
import axios from 'axios';

// Base API URL - configurable for different environments
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

// Create Axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API functions
export const api = {
  // Simulation control
  startSimulation: async (config) => {
    return apiClient.post('/start', config);
  },
  
  stopSimulation: async () => {
    return apiClient.post('/stop');
  },
  
  resetSimulation: async () => {
    return apiClient.post('/reset');
  },
  
  getStatus: async () => {
    return apiClient.get('/status');
  },

  // State and data
  getState: async () => {
    return apiClient.get('/state');
  },
  
  getElevators: async () => {
    return apiClient.get('/elevators');
  },
  
  getElevator: async (id) => {
    return apiClient.get(`/elevators/${id}`);
  },
  
  getWaitingPassengers: async () => {
    return apiClient.get('/passengers/waiting');
  },
  
  getCompletedPassengers: async () => {
    return apiClient.get('/passengers/completed');
  },
  
  // Events and interactions
  getEvents: async (limit = 100, skip = 0) => {
    return apiClient.get(`/events?limit=${limit}&skip=${skip}`);
  },
  
  addPassenger: async (startFloor, destinationFloor) => {
    return apiClient.post('/passengers', {
      start_floor: startFloor,
      destination_floor: destinationFloor
    });
  },
  
  pressButton: async (floor, direction) => {
    return apiClient.post('/button', {
      floor,
      direction
    });
  },
  
  // Statistics and configuration
  getStatistics: async () => {
    return apiClient.get('/stats');
  },
  
  getConfiguration: async () => {
    return apiClient.get('/config');
  },
  
  updateConfiguration: async (config) => {
    return apiClient.put('/config', config);
  }
};

// Keep track of the active WebSocket connection
let activeWebSocket = null;

/**
 * WebSocket client for real-time updates
 * @param {Function} onMessage - Callback function for incoming messages
 * @param {Function} onConnect - Callback function when connection is established
 * @param {Function} onDisconnect - Callback function when connection is closed
 * @returns {Object} WebSocket client with send and close methods
 */
export const createWebSocketClient = (onMessage, onConnect, onDisconnect) => {
  // If there's already an active connection, return it instead of creating a new one
  if (activeWebSocket && activeWebSocket.readyState === WebSocket.OPEN) {
    console.log('Reusing existing WebSocket connection');
    return activeWebSocket;
  }
  
  // Close any existing connections that might be in a closing or connecting state
  if (activeWebSocket) {
    console.log('Closing existing WebSocket connection before creating a new one');
    activeWebSocket.close();
    activeWebSocket = null;
  }
  
  console.log('Creating new WebSocket connection');
  const ws = new WebSocket(`${WS_BASE_URL}/ws`);
  
  ws.onopen = () => {
    console.log('WebSocket connection established');
    if (onConnect) onConnect();
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onclose = (event) => {
    console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
    activeWebSocket = null; // Clear the reference
    if (onDisconnect) onDisconnect();
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  // Create client interface
  const client = {
    send: (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      } else {
        console.warn('WebSocket not connected, message not sent');
      }
    },
    close: () => {
      ws.close();
      activeWebSocket = null;
    },
    getState: () => ws.readyState
  };
  
  // Store the active connection
  activeWebSocket = client;
  
  return client;
};

export default api;