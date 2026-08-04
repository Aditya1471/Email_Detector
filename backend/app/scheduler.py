import time
import threading
from backend.app.database import db

# Global control parameter to prevent multiple threads running
_daemon_started = False
_lock = threading.Lock()

def start_background_daemon():
    """Spawn the active mailbox monitor daemon thread."""
    global _daemon_started
    with _lock:
        if _daemon_started:
            return
        _daemon_started = True
        
    thread = threading.Thread(target=daemon_monitor_loop, daemon=True)
    thread.start()
    print("[Scheduler] Background threat scanner daemon thread spawned successfully.")

def daemon_monitor_loop():
    """Continuous background loop scanning linked inboxes and dispatching alerts in real-time."""
    time.sleep(5)  # Let Flask boot completely
    
    while True:
        try:
            # Import sync helper dynamically inside loop to prevent circular dependencies
            from backend.app.blueprints.emails import sync_user_gmail_inbox_realtime
            
            users = db.users.find()
            for user in users:
                user_id = str(user['_id'])
                user_email = user.get('email')
                
                # Execute real-time scan on inbox records
                added = sync_user_gmail_inbox_realtime(user_id)
                if added > 0:
                    print(f"[BACKGROUND DAEMON] Synchronized inbox for {user_email}. Scanned {added} new messages.", flush=True)
        except Exception as daemon_err:
            print(f"[Scheduler Error] Background execution failed: {daemon_err}", flush=True)
            
        time.sleep(15)  # Run checks loop every 15 seconds
