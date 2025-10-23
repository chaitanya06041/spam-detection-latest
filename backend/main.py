import os
import pickle
import nltk
import json
import string
import pandas as pd
import re
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from dotenv import load_dotenv
from twilio.rest import Client
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict
import google.generativeai as genai
from datetime import datetime, timedelta
import imaplib
import email
from email.header import decode_header
import uuid
from typing import Optional


load_dotenv()

app = FastAPI()
ps = PorterStemmer()

# Enable CORS (for React frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JSON_PATH = "./history/history.json"

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

vectorizer = pickle.load(open("./models/vectorizer.pkl", "rb"))
model = pickle.load(open("./models/model.pkl", "rb"))

# ---------- Helper Functions ----------


# ---------- Request Models ----------
class email_data(BaseModel):
    content: str
    sender: Optional[str] = None
    subject: Optional[str] = None

class PredictRequest(BaseModel):
    type: str
    emails: List[email_data]

class fetchEmailRequest(BaseModel):
    filter: str

class deleteHistoryRequest(BaseModel):
    ids: List[str]

# ---------- Routes ----------
@app.post('/predict')
async def predict(request: PredictRequest):
    try: 
        print(request)
        emails = request.emails
        outputs = []
        for email in emails:
            sender = email.sender or ""
            subject = email.subject or ""
            email_content = email.content
            naive_output = predict_spam_naive(email_content)
            gemini_output = predict_spam_gemini(email_content)
            save_to_json(sender, subject, email_content,naive_output, gemini_output, request.type)
            new_output = {
                "sender": sender,
                "subject": subject,
                "naive_output": naive_output,
                "gemini_output": gemini_output
            }
            outputs.append(new_output)

        return outputs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post('/fetch-emails')
async def fetch_emails(request: fetchEmailRequest):
    # Filters will be last 1 day, last 7 days, last 15 days, last 3o days
    user = "spam.detection.viit@gmail.com"
    password = "bntgrrultakflmpe"
    imap_url = "imap.gmail.com"

    today = datetime.now()
    if request.filter == "1d":
        since_date = today - timedelta(days=1)
    elif request.filter == "7d":
        since_date = today - timedelta(days=7)
    elif request.filter == "15d":
        since_date = today - timedelta(days=15)
    elif request.filter == "30d":
        since_date = today - timedelta(days=30)
    else:
        since_date = today - timedelta(days=30)

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
            "id": eid,
            "from": from_,
            "subject": subject,
            "date": date_,
            "preview": body[:600]  # preview first 300 chars
        })

    mail.logout()

    return {"emails": emails}
    


@app.post('/clear-history')
async def clear_history():
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, "w") as f:
            json.dump([], f, indent=4)
        return {"message": "History cleared successfully"}
    else:
        return {"message": "History file not found"}


@app.post('/delete-history')
async def delete_history(request: deleteHistoryRequest):
    ids_to_delete = set(request.ids)

    if not os.path.exists(JSON_PATH):
        return {"error": "history.json file not found."}

    with open(JSON_PATH, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []

    if not isinstance(data, list):
        return {"error": "Invalid JSON format. Expected a list of records."}

    # Filter out entries with matching IDs
    remaining_data = [item for item in data if item.get("id") not in ids_to_delete]

    # Write updated data back
    with open(JSON_PATH, "w") as f:
        json.dump(remaining_data, f, indent=4)

    return {
        "remaining_records": len(remaining_data)
    }


@app.post('/graph')
async def get_graphs():
    if not os.path.exists(JSON_PATH):
        return {"error": "history.json file not found."}

    # Read data safely
    with open(JSON_PATH, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []

    if not isinstance(data, list):
        return {"error": "Invalid JSON structure. Expected a list."}

    # Extract relevant fields
    graph_data = []
    for item in data:
        graph_data.append({
            "id": item.get("id"),
            "label": item.get("result").get("gemini_prediction").get("prediction"),  # or another field if needed
            "time": item.get("timestamp")
        })

    return {"graphs": graph_data}


@app.get('/history')
async def get_history():
    if not os.path.exists(JSON_PATH):
        return {"error": "history.json file not found."}

    with open(JSON_PATH, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []
    return {"history": data}


# ---------- Helper Functions ----------












def predict_spam_gemini(email_content: str):
    """
    Analyzes an email content using Google Gemini to detect spam and provide details.
    """
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    Analyze the following email to determine if it is spam.
    Provide the response in a JSON format with the following keys:
    - "prediction": "spam" or "not spam".
    - "reason": A brief explanation for the classification.
    - "recommendation": A suggested action for the user (e.g., "Delete immediately", "Be cautious", "Safe to reply").
    - "spam_words": An array of words or phrases from the email that indicate it might be spam. If it's not spam, return an empty array.

    Email content: "{email_content}"
    """
    
    response = model.generate_content(prompt)
    
    # Clean up the response to extract the JSON part
    cleaned_response = response.text.strip().replace("```json", "").replace("```", "")
    
    try:
        return json.loads(cleaned_response)
    except json.JSONDecodeError:
        return {"error": "Failed to parse Gemini response", "raw_response": response.text}
    

def transform_text(text: str):
    """Text preprocessing: lowercase, tokenization, stopword removal, stemming"""
    text = text.lower()
    text = nltk.word_tokenize(text)
    y = [i for i in text if i.isalnum()]
    y = [i for i in y if i not in stopwords.words('english') and i not in string.punctuation]
    y = [ps.stem(i) for i in y]
    return " ".join(y)


def predict_spam_naive(email_content: str):
    transformed_text = transform_text(email_content)
    vectorized_text = vectorizer.transform([transformed_text]).toarray()
    prediction = model.predict(vectorized_text)
    label = "spam" if prediction[0] == 1 else "not spam"
    return label

def save_to_json(sender: str, subject: str, email_content: str, model_output: str, gemini_analysis: dict, type: str):
    """Saves the analysis result to a JSON file."""
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    id = str(uuid.uuid4())
    
    new_record = {
        "id": id,
        "type": type,
        "content": {
            "from": sender,
            "subject": subject,
            "message": email_content
        },
        "result": {
            "model_prediction": model_output,
            "gemini_prediction": gemini_analysis
        },
        "timestamp": datetime.now().isoformat()
    }

    records = []
    # Read existing data if file exists and is not empty
    if os.path.exists(JSON_PATH) and os.path.getsize(JSON_PATH) > 0:
        with open(JSON_PATH, "r") as f:
            try:
                records = json.load(f)
            except json.JSONDecodeError:
                records = [] # File is corrupt or empty, start fresh

    records.append(new_record)

    # Write all records back to the file
    with open(JSON_PATH, "w") as f:
        json.dump(records, f, indent=4)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
