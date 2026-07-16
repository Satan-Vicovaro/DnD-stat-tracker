import sys
import logging
import eel

# Configure basic logging for better debugging and structure
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Import API endpoints so Eel registers the @eel.expose decorators.
# This must happen before eel.start(), but game_engine is not yet set.
import api


def main():
    """Main application entry point."""
    from engine import GameEngine
    from sync import SyncService

    # Instantiate SyncService and configure callbacks
    sync_service = SyncService()

    def on_sync_success(msg):
        try:
            eel.updateSyncStatus(True, msg)()
        except Exception:
            pass

    def on_sync_error(msg):
        try:
            eel.updateSyncStatus(False, msg)()
        except Exception:
            pass

    def on_sync_pending():
        try:
            eel.updateSyncStatus(None, "Oczekuje...")()
        except Exception:
            pass

    sync_service.on_success = on_sync_success
    sync_service.on_error = on_sync_error
    sync_service.on_pending = on_sync_pending

    # Create the engine (reads autosave from disk) and inject it into the
    # api module BEFORE eel.start() opens the browser window.
    # Any JS -> Python call can only arrive after the browser connects,
    # which is after eel.start(), so the engine is guaranteed to be ready.
    api.game_engine = GameEngine()
    api.game_engine.sync_service = sync_service
    logger.info(f"Engine ready: {api.game_engine.hero.name} level {api.game_engine.hero.level}")

    logger.info("Initializing Eel application...")
    eel.init("web")

    try:
        logger.info("Starting UI window on a random available port...")
        eel.start("index.html", size=(1920, 1080), port=0)
    except (SystemExit, KeyboardInterrupt):
        logger.info("Application closing gracefully.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
