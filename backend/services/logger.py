import sys
import os
from loguru import logger

# Remove default handler
logger.remove()

# If running in production (e.g. Render), use JSON formatting for easy searching
if os.environ.get("FLASK_CONFIG") == "production":
    logger.add(sys.stdout, format="{time} | {level} | {message}", serialize=True, level="INFO")
else:
    # Dev: Colored output
    logger.add(sys.stdout, colorize=True, format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>", level="DEBUG")

