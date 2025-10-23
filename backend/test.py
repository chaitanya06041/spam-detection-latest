from datetime import datetime, timedelta
import imaplib
import email
from email.header import decode_header

def fetch_emails(filter_range: str):
    # Filters will be last 1 day, last 7 days, last 15 days, last 3o days
    user = "spam.detection.viit@gmail.com"
    password = "bntgrrultakflmpe"
    imap_url = "imap.gmail.com"

    today = datetime.now()
    if filter_range == "1d":
        since_date = today - timedelta(days=1)
    elif filter_range == "7d":
        since_date = today - timedelta(days=7)
    elif filter_range == "15d":
        since_date = today - timedelta(days=15)
    elif filter_range == "30d":
        since_date = today - timedelta(days=30)
    else:
        return {"error": "Invalid filter_range. Use '1d', '7d', '15d', or '30d'."}

    since_str = since_date.strftime("%d-%b-%Y")  # IMAP date format

    # --- Connect to Gmail IMAP ---
    mail = imaplib.IMAP4_SSL(imap_url)
    mail.login(user, password)
    mail.select("inbox")

    # --- Search emails within date range ---
    status, data = mail.search(None, f'(SINCE "{since_str}")')

    if status != "OK":
        return {"error": "Failed to fetch emails"}

    email_ids = data[0].split()
    if not email_ids:
        return {"message": "No emails found in this date range"}

    # --- Get latest 10 emails ---
    latest_ids = email_ids[-10:]

    emails = []
    for eid in reversed(latest_ids):  # Reverse to show newest first
        status, msg_data = mail.fetch(eid, "(RFC822)")
        if status != "OK":
            continue

        msg = email.message_from_bytes(msg_data[0][1])

        # Decode subject safely
        subject, encoding = decode_header(msg["Subject"])[0]
        if isinstance(subject, bytes):
            subject = subject.decode(encoding if encoding else "utf-8", errors="ignore")

        from_ = msg.get("From")
        date_ = msg.get("Date")

        # Get message body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                if part.get_content_type() == "text/plain" and not part.get("Content-Disposition"):
                    body = part.get_payload(decode=True).decode(errors="ignore")
                    break
        else:
            body = msg.get_payload(decode=True).decode(errors="ignore")

        emails.append({
            "from": from_,
            "subject": subject,
            "date": date_,
            "body": body[:300]  # preview first 300 chars
        })

    mail.logout()

    return emails


print(fetch_emails("15d"))