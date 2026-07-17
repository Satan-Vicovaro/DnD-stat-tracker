Simpe helper for tracking user statistics for DnD game made for me and my friends.
Stack: 
- Python with eel.
- Javascript with tailwindcss.


> [!WARNING]
Totally  vibecoded.

## Reverse Proxy Configuration
If you run the GM server behind an Nginx reverse proxy, you MUST configure it to support WebSocket `Upgrade` headers for real-time synchronization to work.

Example Nginx configuration:
```nginx
location /ws/ {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
