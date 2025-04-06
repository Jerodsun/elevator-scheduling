# Elevator Simulation Frontend

A React application for visualizing an elevator scheduling system.

## Features

- Real-time visualization of elevators and passenger movement
- Simulation controls (start, stop, reset)
- Configurable parameters (number of elevators, floors, speed)
- Statistics dashboard with key metrics
- Event log with filtering

## Setup

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Environment Variables

Create a `.env` file with:

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

## Troubleshooting

- If elevators aren't visible, check console for WebSocket errors
- Ensure backend API is running at the correct URL
- Check browser console for any connection issues

## Component Structure

- `Building.jsx` - Visual representation of elevators and floors
- `Controls.jsx` - Simulation control panel
- `EventStream.jsx` - Real-time event logging
- `Statistics.jsx` - Performance metrics and charts
