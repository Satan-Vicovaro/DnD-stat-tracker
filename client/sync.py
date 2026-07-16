import json
import logging
import threading
import time
import urllib.request
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class SyncService:
    """
    Handles debounced synchronization of game state to the Game Master server.
    Extracts network operations from the core game engine.
    """

    def __init__(self):
        self.url = "http://localhost:8000/api/sync"
        self.enabled = True

        # Callbacks for UI updates
        self.on_success: Optional[Callable[[str], None]] = None
        self.on_error: Optional[Callable[[str], None]] = None
        self.on_pending: Optional[Callable[[], None]] = None

        self._latest_payload = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

        # Start the background worker thread
        self._worker_thread = threading.Thread(target=self._worker, daemon=True)
        self._worker_thread.start()

    def set_config(self, url: str, enabled: bool):
        with self._lock:
            self.url = url
            self.enabled = enabled

    def queue_sync(self, payload: dict):
        """
        Queue a payload for synchronization. Repeated calls will overwrite
        the previous payload. The worker will pick it up on its next 5s tick.
        """
        with self._lock:
            if not self.enabled:
                return
            self._latest_payload = payload
            if self.on_pending:
                try:
                    self.on_pending()
                except Exception:
                    pass

    def _worker(self):
        """Background thread that periodically sends changes to the server every 5 seconds."""
        while not self._stop_event.is_set():
            # Wait 5 seconds before the next sync check
            self._stop_event.wait(5.0)

            if self._stop_event.is_set():
                break

            with self._lock:
                payload = self._latest_payload
                url = self.url
                enabled = self.enabled
                self._latest_payload = None  # Clear it so we don't send it again

            if not enabled or not payload:
                continue

            try:
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    url, data=data, headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    logger.debug("Successfully synced to GM server")
                    if self.on_success:
                        try:
                            self.on_success("Zsynchronizowano")
                        except Exception:
                            pass
            except Exception as e:
                logger.debug(f"Failed to sync to GM server: {e}")
                if self.on_error:
                    try:
                        self.on_error("Błąd serwera")
                    except Exception:
                        pass

    def test_connection(self, url: str) -> bool:
        """Synchronously test the connection to a given URL."""
        try:
            data = json.dumps({"name": "test_ping"}).encode("utf-8")
            req = urllib.request.Request(
                url, data=data, headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as response:
                return response.status == 200
        except Exception as e:
            logger.error(f"Test sync connection failed: {e}")
            return False

    def stop(self):
        """Stop the background worker."""
        self._stop_event.set()
