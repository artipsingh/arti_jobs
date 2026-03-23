#!/bin/bash
set -e

echo "Setting up Python environment..."

# Create venv if it doesn't exist
if [ ! -d "scripts/.venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv scripts/.venv
fi

# Install dependencies
echo "Installing Python dependencies..."
scripts/.venv/bin/pip install -r tests/python/requirements.txt

echo "✓ Python environment ready"

echo "Activating virtual environment..."
source scripts/.venv/bin/activate
echo "✓ Virtual environment activated"