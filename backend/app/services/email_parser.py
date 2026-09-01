import base64
import email
import re
from typing import Any, Dict, List, Optional


class EmailParser:
    """
    Sanitizes, extracts, and decodes email content from RFC 822 text or Gmail API JSON representations.
    Operates strictly in memory; never persists complete raw payloads or email bodies.
    """

    MAX_BODY_BYTES = 51200  # Cap memory extraction at 50KB per message to prevent memory bloat

    @staticmethod
    def extract_domain(email_str: str) -> Optional[str]:
        """
        Extracts lowercase domain name from email header string (e.g., 'John Doe <john@example.com>' -> 'example.com').
        """
        if not email_str:
            return None
        # Match standard email address within brackets or plain text
        match = re.search(r"[\w\.-]+@([\w\.-]+\.\w+)", email_str)
        if match:
            return match.group(1).lower().strip()
        return None

    @staticmethod
    def clean_html_to_text(html_content: str) -> str:
        """
        Strips HTML tags safely in memory without external web fetching.
        """
        if not html_content:
            return ""
        # Remove script and style elements
        text = re.sub(r"<(script|style).*?</\1>", " ", html_content, flags=re.DOTALL | re.IGNORECASE)
        # Replace block tags with newline
        text = re.sub(r"<(p|div|br|h[1-6]|tr|li)[^>]*>", "\n", text, flags=re.IGNORECASE)
        # Strip all remaining tags without inserting spaces
        text = re.sub(r"<[^>]+>", "", text)
        # Clean extra whitespace
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n", "\n\n", text)
        return text.strip()

    def parse_eml_content(self, raw_content: str) -> Dict[str, str]:
        """
        Parses raw text body content representing an RFC 822 (.eml) message,
        extracting headers (From, To, Subject) and text body payload.
        """
        try:
            msg = email.message_from_string(raw_content)

            # Extract headers
            sender = msg.get("From", "").strip()
            recipient = msg.get("To", "").strip()
            subject = msg.get("Subject", "").strip()

            # Extract text body payload
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disp = str(part.get("Content-Disposition", ""))

                    if content_type == "text/plain" and "attachment" not in content_disp:
                        try:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body += payload.decode("utf-8", errors="ignore")
                        except Exception:
                            pass
            else:
                try:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        body = payload.decode("utf-8", errors="ignore")
                except Exception:
                    body = msg.get_payload() or ""

            body = body.strip()
            if not body:
                body = raw_content

            return {"sender": sender, "recipient": recipient, "subject": subject, "body": body[: self.MAX_BODY_BYTES]}
        except Exception:
            return {"sender": "", "recipient": "", "subject": "", "body": raw_content[: self.MAX_BODY_BYTES]}

    def _extract_body_from_gmail_payload(self, payload: Dict[str, Any]) -> str:
        """
        Recursively traverses Gmail API payload MIME parts to extract plain text body,
        falling back to sanitized HTML if plain text is absent.
        """
        plain_texts: List[str] = []
        html_texts: List[str] = []

        def _traverse_parts(part: Dict[str, Any]):
            mime_type = part.get("mimeType", "")
            body_data = part.get("body", {}).get("data")

            if body_data:
                try:
                    decoded = base64.urlsafe_b64decode(body_data.encode("ASCII")).decode("utf-8", errors="ignore")
                    if mime_type == "text/plain":
                        plain_texts.append(decoded)
                    elif mime_type == "text/html":
                        html_texts.append(decoded)
                except Exception:
                    pass

            for subpart in part.get("parts", []):
                _traverse_parts(subpart)

        _traverse_parts(payload)

        if plain_texts:
            return "\n".join(plain_texts).strip()
        elif html_texts:
            combined_html = "\n".join(html_texts)
            return self.clean_html_to_text(combined_html)

        return ""

    def parse_gmail_message_payload(self, message_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts normalized message metadata, safe header fields, and temporary plain text body
        from a raw Gmail API message dictionary.
        """
        message_id = message_dict.get("id", "")
        payload = message_dict.get("payload", {})
        headers_list = payload.get("headers", [])

        # Map headers into lookup dictionary
        header_map = {}
        for h in headers_list:
            name = h.get("name", "").lower()
            val = h.get("value", "")
            if name:
                header_map[name] = val

        sender = header_map.get("from", "").strip()
        recipient = header_map.get("to", "").strip()
        subject = header_map.get("subject", "").strip()
        date_str = header_map.get("date", "").strip()

        # Sender & Recipient domains
        sender_domain = self.extract_domain(sender)
        recipient_domain = self.extract_domain(recipient)

        # Subject preview (truncated safely)
        subject_preview = subject[:97] + "..." if len(subject) > 100 else (subject or "(No Subject)")

        # In-memory plain text body extraction
        body_text = self._extract_body_from_gmail_payload(payload)
        # If payload body had direct data
        if not body_text and payload.get("body", {}).get("data"):
            try:
                raw_b64 = payload["body"]["data"]
                body_text = base64.urlsafe_b64decode(raw_b64.encode("ASCII")).decode("utf-8", errors="ignore").strip()
            except Exception:
                body_text = ""

        # Limit memory extraction
        body_text = body_text[: self.MAX_BODY_BYTES].strip()

        return {
            "provider_message_id": message_id,
            "sender": sender,
            "recipient": recipient,
            "subject": subject,
            "date": date_str,
            "sender_domain": sender_domain,
            "recipient_domain": recipient_domain,
            "subject_preview": subject_preview,
            "body": body_text,
        }


email_parser = EmailParser()
