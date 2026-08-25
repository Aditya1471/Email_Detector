import email
from typing import Dict


class EmailParser:
    def parse_eml_content(self, raw_content: str) -> Dict[str, str]:
        """
        Parses raw text body content representing an RFC 822 (.eml) message,
        extracting headers (From, To, Subject) and text body payload.
        """
        try:
            msg = email.message_from_string(raw_content)

            # Extract headers
            sender = msg.get("From", "")
            recipient = msg.get("To", "")
            subject = msg.get("Subject", "")

            # Clean header values
            sender = sender.strip()
            recipient = recipient.strip()
            subject = subject.strip()

            # Extract text body payload
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disp = str(part.get("Content-Disposition"))

                    if content_type == "text/plain" and "attachment" not in content_disp:
                        try:
                            payload = part.get_payload(decode=True)
                            body += payload.decode("utf-8", errors="ignore")
                        except Exception:
                            pass
            else:
                try:
                    payload = msg.get_payload(decode=True)
                    body = payload.decode("utf-8", errors="ignore")
                except Exception:
                    body = msg.get_payload() or ""

            body = body.strip()

            # Fallback if body parsing failed but headers were loaded
            if not body:
                body = raw_content

            return {"sender": sender, "recipient": recipient, "subject": subject, "body": body}
        except Exception:
            # Fallback standard plain text return
            return {"sender": "", "recipient": "", "subject": "", "body": raw_content}


email_parser = EmailParser()
