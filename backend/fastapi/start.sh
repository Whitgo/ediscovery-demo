#!/bin/bash

# Start FastAPI service for eDiscovery
echo "Starting eDiscovery FastAPI service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create exports directory
mkdir -p exports

# Start the server
echo "Starting server on http://0.0.0.0:8000"
echo "API Documentation: http://localhost:8000/docs"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
