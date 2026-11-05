import os
import sys
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(current_dir, ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

load_dotenv(os.path.join(root_dir, ".env"))

from src.model.train import train_and_save_model
from src.model.predict import run_predictions


def main():
    print("🚀 Training model and generating predictions...")
    train_and_save_model()
    run_predictions()


if __name__ == "__main__":
    main()