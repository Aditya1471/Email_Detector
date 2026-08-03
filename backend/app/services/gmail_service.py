import re
import base64
import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from backend.app.database import db
from backend.app.models.user import OAuthAccount
from backend.app.models.email import MonitoredInbox, ScannedEmail
from backend.app.utils.security import log_audit_action

# Regex for extracting clean URLs from text
URL_REGEX = r'https?://[a-zA-Z0-9.\-_~:/?#\[\]@!$&\'()*+,;=%]+'

def get_gmail_credentials(user_id):
    """Retrieve and refresh Google OAuth credentials for a specific user."""
    account = OAuthAccount.query.filter_by(user_id=user_id, provider='google').first()
    if not account:
        raise ValueError("Google OAuth credentials not found for this user.")

    # Instantiate PyGoogle Credentials interface
    creds = Credentials(
        token=account.access_token,
        refresh_token=account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=db.get_app().config['GOOGLE_CLIENT_ID'],
        client_secret=db.get_app().config['GOOGLE_CLIENT_SECRET']
    )

    # Check if access token is expired and refresh it using stored refresh token
    if account.token_expiry and datetime.datetime.utcnow() >= account.token_expiry:
        try:
            creds.refresh(Request())
            # Save refreshed credentials back to database
            account.access_token = creds.token
            if creds.expiry:
                account.token_expiry = creds.expiry
            db.session.commit()
            log_audit_action(action="Successfully refreshed Gmail API access token.", user_id=user_id)
        except Exception as e:
            db.session.rollback()
            raise RuntimeError(f"Failed to refresh Google API access credentials: {str(e)}")

    return creds


def get_gmail_service(user_id):
    """Factory creating an authenticated Gmail API v1 client."""
    creds = get_gmail_credentials(user_id)
    return build('gmail', 'v1', credentials=creds)


def decode_base64_data(encoded_str):
    """Secure url-safe base64 MIME block decoding wrapper."""
    try:
        # Standard base64 decoding for URLsafe packets
        decoded_bytes = base64.urlsafe_b64decode(encoded_str.encode('ASCII'))
        return decoded_bytes.decode('utf-8', errors='ignore')
    except Exception:
        return ""


def recursive_extract_body(payload):
    """Recursively extract plain text and HTML content from complex MIME parts."""
    body = ""
    mime_type = payload.get('mimeType', '')
    
    if 'parts' in payload:
        for part in payload['parts']:
            body += recursive_extract_body(part)
    else:
        # Handle leaves
        data = payload.get('body', {}).get('data', '')
        if (mime_type == 'text/plain' or mime_type == 'text/html') and data:
            body += decode_base64_data(data)
            
    return body


def parse_email_message(message_data):
    """Parse raw Google API message details into a structured data dictionary."""
    headers = message_data.get('payload', {}).get('headers', [])
    
    parsed = {
        'message_id': message_data.get('id'),
        'thread_id': message_data.get('threadId'),
        'history_id': message_data.get('historyId'),
        'sender': '',
        'recipient': '',
        'subject': '',
        'received_date': None,
        'body_text': '',
        'links': []
    }

    # Extract standard fields from headers list
    for header in headers:
        name = header.get('name', '').lower()
        value = header.get('value', '')
        
        if name == 'from':
            parsed['sender'] = value
        elif name == 'to':
            parsed['recipient'] = value
        elif name == 'subject':
            parsed['subject'] = value
        elif name == 'date':
            # Example: "Mon, 3 Aug 2026 23:05:00 +0530"
            try:
                # Basic parsing or standard datetime parsing
                # Strip timezone offsets for database compatibility
                clean_date = re.sub(r'\s\([A-Z]+\)$', '', value) # strip trailing (PST), (IST)
                # Attempt to parse common formats
                parsed['received_date'] = datetime.datetime.strptime(clean_date.split(' +')[0].split(' -')[0], '%a, %d %b %Y %H:%M:%S')
            except Exception:
                parsed['received_date'] = datetime.datetime.utcnow()

    # Default date fallback
    if not parsed['received_date']:
        # Try using internalDate timestamp (milliseconds)
        internal_date = message_data.get('internalDate')
        if internal_date:
            parsed['received_date'] = datetime.datetime.utcfromtimestamp(int(internal_date) / 1000.0)
        else:
            parsed['received_date'] = datetime.datetime.utcnow()

    # Extract email body
    payload = message_data.get('payload', {})
    parsed['body_text'] = recursive_extract_body(payload)

    # Extract links using regex matches
    links = re.findall(URL_REGEX, parsed['body_text'])
    parsed['links'] = list(set(links)) # Deduplicate URLs

    return parsed


def fetch_new_emails(user_id, email_address):
    """Fetch unread/recent email messages from the user's Gmail inbox."""
    try:
        service = get_gmail_service(user_id)
        
        # Determine history sync state
        inbox = MonitoredInbox.query.filter_by(user_id=user_id, email_address=email_address).first()
        if not inbox:
            return []

        messages_list = []
        new_history_id = None

        # 1. High-Scale incremental sync via History API
        if inbox.last_history_id:
            try:
                history_resp = service.users().history().list(
                    userId='me',
                    startHistoryId=inbox.last_history_id,
                    historyTypes=['messageAdded']
                ).execute()
                
                new_history_id = history_resp.get('historyId', inbox.last_history_id)
                histories = history_resp.get('history', [])
                
                for history in histories:
                    added_msgs = history.get('messagesAdded', [])
                    for added in added_msgs:
                        msg = added.get('message', {})
                        # Exclude self-sent emails from monitoring loop
                        if msg.get('id'):
                            messages_list.append(msg.get('id'))
                            
            except Exception:
                # If history has expired (Google keeps logs for ~7 days), reset and fallback to list
                inbox.last_history_id = None
                db.session.commit()

        # 2. Polling Fallback (if first run or history expired)
        if not inbox.last_history_id:
            # Query recent 15 unread inbox messages
            list_resp = service.users().messages().list(
                userId='me',
                q='label:INBOX is:unread',
                maxResults=15
            ).execute()
            
            messages = list_resp.get('messages', [])
            messages_list = [msg['id'] for msg in messages]
            
            # Fetch current profile to record baseline historyId
            profile = service.users().getProfile(userId='me').execute()
            new_history_id = profile.get('historyId')

        # 3. Pull details for gathered message IDs
        processed_emails = []
        
        for msg_id in set(messages_list):
            # Check duplicate database records
            existing = ScannedEmail.query.filter_by(message_id=msg_id).first()
            if existing:
                continue

            try:
                msg_data = service.users().messages().get(
                    userId='me',
                    id=msg_id,
                    format='full'
                ).execute()
                
                email_details = parse_email_message(msg_data)
                processed_emails.append(email_details)
                
            except Exception as e:
                print(f"Error fetching message ID {msg_id}: {str(e)}")
                continue

        # Update monitored inbox history state
        if new_history_id:
            inbox.last_history_id = new_history_id
            db.session.commit()

        return processed_emails

    except Exception as e:
        print(f"Error in fetch_new_emails for user {user_id}: {str(e)}")
        return []


def register_gmail_push_watch(user_id, email_address, topic_name):
    """Register Gmail watch hook on Google Pub/Sub topic to enable real-time notifications."""
    try:
        service = get_gmail_service(user_id)
        
        watch_body = {
            'topicName': topic_name,
            'labelIds': ['INBOX']
        }
        
        watch_resp = service.users().watch(userId='me', body=watch_body).execute()
        
        # Save watch parameters in database MonitoredInbox metadata
        inbox = MonitoredInbox.query.filter_by(user_id=user_id, email_address=email_address).first()
        if inbox:
            inbox.watch_expiration = watch_resp.get('expiration', '')
            inbox.active = True
            db.session.commit()
            
        log_audit_action(action=f"Registered active Gmail Webhook watch on PubSub topic {topic_name}", user_id=user_id)
        return watch_resp
        
    except Exception as e:
        raise RuntimeError(f"Failed to register Gmail watch hook: {str(e)}")
