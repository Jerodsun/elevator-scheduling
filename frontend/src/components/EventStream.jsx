import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/api';

/**
 * Event Stream Component
 * 
 * Displays a real-time stream of events from the simulation
 */
const EventStream = ({ events = [], maxEvents = 100 }) => {
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const eventContainerRef = useRef(null);
  
  useEffect(() => {
    // Apply filters
    let filtered = events;
    
    // Filter by event type
    if (filter !== 'all') {
      filtered = filtered.filter(event => event.type === filter);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(event => 
        JSON.stringify(event).toLowerCase().includes(term)
      );
    }
    
    // Limit number of events displayed
    filtered = filtered.slice(0, maxEvents);
    
    setFilteredEvents(filtered);
    
    // Auto-scroll to bottom
    if (eventContainerRef.current) {
      eventContainerRef.current.scrollTop = eventContainerRef.current.scrollHeight;
    }
  }, [events, filter, searchTerm, maxEvents]);
  
  // Get unique event types for filter dropdown
  const eventTypes = ['all', ...new Set(events.map(event => event.type))];
  
  // Format time as HH:MM:SS
  const formatTime = (time) => {
    const date = new Date(0);
    date.setSeconds(time);
    return date.toISOString().substr(11, 8);
  };
  
  // Format event details as a readable string
  const formatEventDetails = (event) => {
    switch (event.type) {
      case 'new_passenger':
        return `New passenger ${event.passenger_id} waiting at floor ${event.start_floor}, going to floor ${event.destination_floor}`;
      
      case 'elevator_assigned':
        return `Elevator ${event.elevator_id + 1} assigned to floor ${event.floor}, direction: ${event.direction}`;
      
      case 'elevator_arrived':
        return `Elevator ${event.elevator_id + 1} arrived at floor ${event.floor}`;
      
      case 'elevator_moving':
        return `Elevator ${event.elevator_id + 1} moving from floor ${event.from_floor} to floor ${event.to_floor}`;
      
      case 'elevator_idle':
        return `Elevator ${event.elevator_id + 1} is now idle at floor ${event.floor}`;
      
      case 'passenger_arrived':
        return `Passenger ${event.passenger_id} arrived at floor ${event.floor}. Wait: ${event.wait_time.toFixed(1)}s, Ride: ${event.ride_time.toFixed(1)}s`;
      
      case 'passengers_boarded':
        return `${event.passenger_count} passenger(s) boarded elevator ${event.elevator_id + 1} at floor ${event.floor}`;
      
      case 'button_press':
        return `Button pressed at floor ${event.floor}, direction: ${event.direction}`;
      
      default:
        return JSON.stringify(event);
    }
  };
  
  // Get CSS class for event type
  const getEventTypeClass = (type) => {
    switch (type) {
      case 'new_passenger':
        return 'bg-blue-100 border-blue-500';
      case 'elevator_assigned':
        return 'bg-purple-100 border-purple-500';
      case 'elevator_arrived':
        return 'bg-green-100 border-green-500';
      case 'elevator_moving':
        return 'bg-yellow-100 border-yellow-500';
      case 'passenger_arrived':
        return 'bg-teal-100 border-teal-500';
      case 'passengers_boarded':
        return 'bg-indigo-100 border-indigo-500';
      case 'button_press':
        return 'bg-red-100 border-red-500';
      default:
        return 'bg-gray-100 border-gray-500';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4">Event Stream</h2>
      
      {/* Filters */}
      <div className="flex space-x-4 mb-4">
        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Type
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {eventTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Events' : type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        
        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter events..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
      
      {/* Event list */}
      <div 
        className="flex-1 overflow-y-auto border border-gray-200 rounded-md p-2"
        ref={eventContainerRef}
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No events to display</div>
        ) : (
          <div className="space-y-2">
            {filteredEvents.map((event, index) => (
              <div 
                key={index}
                className={`p-2 border-l-4 rounded-md ${getEventTypeClass(event.type)}`}
              >
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{formatTime(event.time)}</span>
                  <span>{event.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div className="text-sm">{formatEventDetails(event)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventStream;