#!/bin/bash
set -e

echo "Running Python tests..."

# Check if venv exists
if [ ! -d "scripts/.venv" ]; then
    echo "Python venv not found. Run 'npm run setup:py' first."
    exit 1
fi

# Run pytest
scripts/.venv/bin/pytest tests/python/ "$@"