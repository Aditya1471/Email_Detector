import time
import random
import threading
from datetime import datetime

from backend.app.database import db
from backend.app.blueprints.emails import perform_forensic_scan

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
    """Continuous background loop scanning linked inboxes and dispatching alerts."""
    # Demo templates for background simulation
    incoming_templates = [
        {
            'sender': 'security-update@paypal-fraud-protection.com',
            'subject': 'WARNING: Suspicious login transaction intercepted - verify identity',
            'body': 'A login from an unrecognized device in Russia was detected on your account. If this was not you, please verify your credentials immediately at http://paypa1-identity-verification.net/secure/login to avoid permanent suspension.'
        },
        {
            'sender': 'membership-renew@netflix-billing.com',
            'subject': 'Action Required: Update card payment method',
            'body': 'Dear Subscriber, your monthly billing cycle failed. Click here http://netflix-billing-renew.com to update your details and restore video streams.'
        },
        {
            'sender': 'hr-benefits@university-portal.edu',
            'subject': 'Updated Q3 health benefits packages document list',
            'body': 'Dear Faculty, the benefits documentation has been updated. Please inspect the attached portal checklist for the revised policy parameters.'
        }
    ]
    
    time.sleep(5)  # Let Flask boot completely
    
    while True:
        try:
            users = db.users.find()
            for user in users:
                user_id = str(user['_id'])
                user_email = user.get('email')
                
                # Check for mock active inbox simulation (30% chance per loop cycle)
                if random.random() < 0.35:
                    template = random.choice(incoming_templates)
                    
                    # Check if this specific email template was already received by this user
                    exists = db.emails.find_one({
                        'user_id': user_id,
                        'sender': template['sender'],
                        'subject': template['subject']
                    })
                    if exists:
                        continue
                        
                    # Process email scan
                    score, classification, reasons, trace = perform_forensic_scan(
                        template['sender'], template['subject'], template['body']
                    )
                    
                    # Store scan result document
                    email_doc = {
                        'user_id': user_id,
                        'sender': template['sender'],
                        'subject': template['subject'],
                        'body': template['body'],
                        'risk_score': score,
                        'classification': classification,
                        'reasons': reasons,
                        'forensic_trace': trace,
                        'scanned_at': datetime.utcnow()
                    }
                    res = db.emails.insert_one(email_doc)
                    email_id = str(res.inserted_id)
                    
                    print(f"\n[DAEMON INTERCEPT] Intercepted incoming email for {user_email}.\nSender: {template['sender']}\nScore: {score}% ({classification.upper()})\n", flush=True)
                    
                    # If threat detected, dispatch warning alerts
                    if classification == 'phishing':
                        # 1. Twilio SMS Relay simulation
                        db.notifications.insert_one({
                            'user_id': user_id,
                            'email_id': email_id,
                            'title': "SMS SECURITY DISPATCH",
                            'message': f"[PHISHGUARD] Critical alert: Spoofed email intercepted from '{template['sender']}'. Verdict: PHISHING ({score}%). Action required.",
                            'channel': 'sms_sim',
                            'recipient_target': '+1 (555) 019-2834',
                            'dispatched_at': datetime.utcnow()
                        })
                        
                        # 2. SMTP Security Email Relay simulation
                        db.notifications.insert_one({
                            'user_id': user_id,
                            'email_id': email_id,
                            'title': "SMTP WARNING RELAY",
                            'message': f"[PHISHGUARD NOTICE] Threat warning: Suspected phishing activity intercepted from '{template['sender']}'. Check dashboard for trace details.",
                            'channel': 'email_sim',
                            'recipient_target': user_email,
                            'dispatched_at': datetime.utcnow()
                        })
                        
                        # 3. In-App Warning Notification
                        db.notifications.insert_one({
                            'user_id': user_id,
                            'email_id': email_id,
                            'title': "BACKGROUND MONITOR: Intercepted Phish Attempt",
                            'message': f"Blocked threat from '{template['sender']}'. Score: {score}%.",
                            'channel': 'in_app',
                            'read': False,
                            'dispatched_at': datetime.utcnow()
                        })
                        
        except Exception as daemon_err:
            print(f"[Scheduler Error] Background execution failed: {daemon_err}", flush=True)
            
        time.sleep(15)  # Run checks loop every 15 seconds
