import time
import threading
from backend.app.database import db
from backend.app.models.email import MonitoredInbox
from backend.app.services.gmail_service import fetch_new_emails
from backend.app.services.ml_service import scan_and_save_email

# Guard variables to ensure thread is initialized exactly once
_scheduler_lock = threading.Lock()
_scheduler_thread = None
_scheduler_running = False

def poll_inboxes_cycle(app):
    """Execution cycle running inside daemon thread to fetch and scan new emails."""
    global _scheduler_running
    print("[Scheduler] Background inbox monitoring thread initialized.", flush=True)
    
    while _scheduler_running:
        try:
            # Re-initialize application context per polling cycle
            with app.app_context():
                # Query all active monitored inboxes in DB
                active_inboxes = MonitoredInbox.query.filter_by(active=True).all()
                
                for inbox in active_inboxes:
                    print(f"[Scheduler] Checking inbox: {inbox.email_address} (User ID: {inbox.user_id})", flush=True)
                    
                    # Fetch new emails since last historyId or recent unread
                    new_emails = fetch_new_emails(inbox.user_id, inbox.email_address)
                    
                    if new_emails:
                        print(f"[Scheduler] Found {len(new_emails)} new emails for {inbox.email_address}.", flush=True)
                    
                    for email_data in new_emails:
                        try:
                            # Invoke unified threat scanning pipeline
                            scan_res = scan_and_save_email(
                                user_id=inbox.user_id,
                                email_data=email_data,
                                message_id=email_data.get('message_id')
                            )
                            print(f"[Scheduler] Scanned email {email_data.get('message_id')}. Classification: {scan_res.get('classification')}, Score: {scan_res.get('risk_score')}%", flush=True)
                            
                            # Trigger background real-time alerts on phishing detection
                            if scan_res.get('classification') == 'phishing':
                                from backend.app.models.email import Notification
                                from backend.app.models.user import User
                                
                                user = User.query.get(inbox.user_id)
                                sender_val = email_data.get('sender', '(Unknown)')
                                subject_val = email_data.get('subject', '(No Subject)')
                                
                                # 1. Create In-App Security Alert
                                in_app_alert = Notification(
                                    user_id=inbox.user_id,
                                    title="CRITICAL: Phishing Attempt Intercepted",
                                    message=f"A fraudulent email from '{sender_val}' with subject '{subject_val}' was intercepted in your inbox.",
                                    channel="in_app",
                                    recipient_target="Browser SOC Dashboard"
                                )
                                db.session.add(in_app_alert)
                                
                                # 2. Create Simulated Email Warning Alert
                                if user and user.email:
                                    email_alert = Notification(
                                        user_id=inbox.user_id,
                                        title="SECURITY WARNING: Spoof/Fraud email detected",
                                        message=f"[SMTP SIMULATOR] Outgoing security alert email dispatched to {user.email}: Warning! We detected a phishing attempt. Sender: {sender_val}, Subject: {subject_val}.",
                                        channel="email_sim",
                                        recipient_target=user.email
                                    )
                                    db.session.add(email_alert)
                                
                                # 3. Create Simulated SMS Warning Alert
                                if user and user.phone_number:
                                    sms_alert = Notification(
                                        user_id=inbox.user_id,
                                        title="SMS THREAT WARNING TRIGGERED",
                                        message=f"[SMS GATEWAY SIMULATOR] Text sent to {user.phone_number}: CyberGuard Alert! Phishing email detected in your inbox from {sender_val}. Inspect details immediately.",
                                        channel="sms_sim",
                                        recipient_target=user.phone_number
                                    )
                                    db.session.add(sms_alert)

                                db.session.commit()
                        except Exception as scan_err:
                            print(f"[Scheduler Error] Threat scan failed for message ID {email_data.get('message_id')}: {str(scan_err)}", flush=True)
                            continue
                            
                # Commit all updates and release connection back to pool
                db.session.remove()
                
        except Exception as cycle_err:
            print(f"[Scheduler Error] Exception caught in background thread: {str(cycle_err)}", flush=True)
            
        # Poll every 60 seconds
        time.sleep(60)


def start_scheduler(app):
    """Starts the background thread scheduler (invoked from Flask app factory)."""
    global _scheduler_thread, _scheduler_running, _scheduler_lock
    
    with _scheduler_lock:
        if _scheduler_running:
            return
            
        _scheduler_running = True
        
        # Instantiate daemon thread (stops when main parent thread terminates)
        _scheduler_thread = threading.Thread(
            target=poll_inboxes_cycle, 
            args=(app,), 
            name="GmailMonitorThread",
            daemon=True
        )
        _scheduler_thread.start()
        print("[Scheduler] Background daemon thread spawned successfully.", flush=True)


def stop_scheduler():
    """Stops the background thread scheduler cleanly."""
    global _scheduler_running, _scheduler_lock
    with _scheduler_lock:
        _scheduler_running = False
        print("[Scheduler] Signal sent to terminate background polling loop.", flush=True)
