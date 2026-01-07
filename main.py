#!/usr/bin/env python3
"""
Main launcher for VocalMaster AI
Run this file to start both frontend and backend
"""

import subprocess
import sys
import os
import time
import webbrowser
from threading import Thread

def start_backend():
    """Start the Flask backend server"""
    print("🚀 Starting Backend Server...")
    os.chdir('backend')
    subprocess.run([sys.executable, 'simple_app.py'])

def start_frontend():
    """Start the React frontend development server"""
    print("🚀 Starting Frontend Development Server...")
    os.chdir('frontend')
    subprocess.run(['npm', 'run', 'dev'])

if __name__ == '__main__':
    print("🎵 VocalMaster AI - Starting Application...")
    
    # Check if frontend dependencies are installed
    if not os.path.exists('frontend/node_modules'):
        print("📦 Installing frontend dependencies...")
        os.chdir('frontend')
        subprocess.run(['npm', 'install'])
        os.chdir('..')
    
    # Start backend in a separate thread
    backend_thread = Thread(target=start_backend)
    backend_thread.daemon = True
    backend_thread.start()
    
    # Wait a moment for backend to start
    time.sleep(3)
    
    # Start frontend
    print("🌐 Frontend will be available at: http://localhost:5173")
    print("🔧 Backend will be available at: http://localhost:5000")
    print("\n📋 Opening browser automatically...")
    
    # Open browser after a delay
    time.sleep(5)
    webbrowser.open('http://localhost:5173')
    
    # Start frontend in main thread
    start_frontend()