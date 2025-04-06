import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { api } from '../api/api';

/**
 * Statistics Component
 * 
 * Displays statistics and metrics about the simulation
 */
const Statistics = ({ simulationState }) => {
  const [stats, setStats] = useState({
    average_wait_time: 0,
    average_ride_time: 0,
    average_total_time: 0,
    total_completed_trips: 0,
    total_waiting_passengers: 0,
    elevator_utilization: {}
  });
  
  const [historicalData, setHistoricalData] = useState([]);
  const [waitTimeData, setWaitTimeData] = useState([]);
  
  // Fetch statistics periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.getStatistics();
        if (response.data) {
          setStats(response.data);
          
          // Add data point to historical data
          const timestamp = new Date().toLocaleTimeString();
          setHistoricalData(prev => {
            const newData = [...prev, {
              time: timestamp,
              waitTime: response.data.average_wait_time,
              rideTime: response.data.average_ride_time,
              totalTime: response.data.average_total_time,
              completedTrips: response.data.total_completed_trips,
              waitingPassengers: response.data.total_waiting_passengers
            }];
            
            // Keep only the last 20 data points
            return newData.slice(-20);
          });
        }
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      }
    };
    
    // Only fetch stats if simulation is running
    if (simulationState && simulationState.time > 0) {
      fetchStats();
      
      // Set up periodic polling
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [simulationState]);
  
  // Format time values in seconds
  const formatTime = (seconds) => {
    return seconds.toFixed(1) + 's';
  };
  
  // Prepare elevator utilization data for bar chart
  const elevatorUtilizationData = Object.entries(stats.elevator_utilization || {}).map(
    ([elevatorId, utilization]) => ({
      name: `Elevator ${parseInt(elevatorId) + 1}`,
      utilization: Math.round(utilization * 100)
    })
  );
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <h2 className="text-xl font-bold mb-4">Simulation Statistics</h2>
      
      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <MetricCard 
          title="Avg. Wait Time" 
          value={formatTime(stats.average_wait_time)} 
          icon="⏱️"
        />
        <MetricCard 
          title="Avg. Ride Time" 
          value={formatTime(stats.average_ride_time)} 
          icon="🏢"
        />
        <MetricCard 
          title="Avg. Total Time" 
          value={formatTime(stats.average_total_time)} 
          icon="⌛"
        />
        <MetricCard 
          title="Completed Trips" 
          value={stats.total_completed_trips} 
          icon="✅"
        />
        <MetricCard 
          title="Waiting Passengers" 
          value={stats.total_waiting_passengers} 
          icon="👥"
        />
        <MetricCard 
          title="Simulation Time" 
          value={formatTime(simulationState?.time || 0)} 
          icon="🕒"
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Time metrics over time */}
        <div className="h-60">
          <h3 className="text-lg font-semibold mb-2">Time Metrics</h3>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{fontSize: 10}} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="waitTime" 
                name="Wait Time" 
                stroke="#8884d8" 
                activeDot={{ r: 8 }} 
              />
              <Line 
                type="monotone" 
                dataKey="rideTime" 
                name="Ride Time" 
                stroke="#82ca9d" 
              />
              <Line 
                type="monotone" 
                dataKey="totalTime" 
                name="Total Time" 
                stroke="#ff7300" 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Elevator utilization */}
        <div className="h-60">
          <h3 className="text-lg font-semibold mb-2">Elevator Utilization (%)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={elevatorUtilizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="utilization" fill="#8884d8" name="Utilization %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Metric card component for displaying individual statistics
const MetricCard = ({ title, value, icon }) => {
  return (
    <div className="bg-gray-100 p-3 rounded-lg flex items-center">
      <div className="text-2xl mr-3">{icon}</div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
};

export default Statistics;