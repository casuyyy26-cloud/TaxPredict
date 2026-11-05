import os
import sys

# Add the root 'taxpredict' directory to Python's path so 'from src...' imports work
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from src.python.app import app

# Vercel looks for the 'app' WSGI instance