import json
import logging
import urllib.request
from typing import Callable, Optional
import eel

logger = logging.getLogger(__name__)


class SyncService:
    """
    Handles synchronization of game state to the Game Master server.
    Passes data directly to the JS frontend which manages the native WebSocket connection.
    """

    def __init__(self):
        self.url = "http://localhost:8000/api/sync"
        self.enabled = True

        # Callbacks for UI updates
        self.on_success: Optional[Callable[[str], None]] = None
        self.on_error: Optional[Callable[[str], None]] = None
        self.on_pending: Optional[Callable[[], None]] = None

    def set_config(self, url: str, enabled: bool):
        self.url = url
        self.enabled = enabled

    def queue_sync(self, payload: dict):
        """
        Pass the payload to the frontend to send over WebSocket.
        """
        if not self.enabled:
            return
            
        if self.on_pending:
            try:
                self.on_pending()
            except Exception:
                pass

        try:
            eel.trigger_js_sync(payload)
        except Exception as e:
            logger.error(f"Failed to trigger JS sync: {e}")

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
        """No longer uses a background worker."""
        pass
