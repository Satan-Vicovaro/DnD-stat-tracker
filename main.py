import sys
import logging
import eel

# Configure basic logging for better debugging and structure
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Import API endpoints so Eel registers them
import api

def main():
    """Main application entry point."""
    logger.info("Initializing Eel application...")
    eel.init("web")

    try:
        logger.info("Starting UI window...")
        # Start the app. It opens index.html in a native-looking window.
        eel.start("index.html", size=(800, 600))
    except (SystemExit, KeyboardInterrupt):
        logger.info("Application closing gracefully.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
