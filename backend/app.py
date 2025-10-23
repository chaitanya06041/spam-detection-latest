import os
import pickle
import nltk
import json
import string
import pandas as pd
import imaplib
import email
import csv
import re
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from dotenv import load_dotenv
from twilio.rest import Client
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import google.generativeai as genai

# Load environment variables
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

# Paths
CSV_PATH = "./history/history .csv"

# Google Gemini API Key
genai.configure(api_key=os.getenv("GEMINI_API_KEY") or "AIzaSyBySipMuOdjgds4WqrYyGCv65afZYMH0xg")

# Load trained Naive Bayes models
vectorizer = pickle.load(open("./models/vectorizer.pkl", "rb"))
model = pickle.load(open("./models/model.pkl", "rb"))

# Twilio credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER")
TO_WHATSAPP_NUMBER = os.getenv("TO_WHATSAPP_NUMBER")
client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# ---------- Helper Functions ----------

def send_whatsapp_message(msg: str):
    """Send WhatsApp message using Twilio"""
    client.messages.create(
        from_=TWILIO_WHATSAPP_NUMBER,
        body=msg,
        to=TO_WHATSAPP_NUMBER
    )
    print(f"WhatsApp message sent to {TO_WHATSAPP_NUMBER}")

def format_response(res: str):
    """Format Gemini model response into expected JSON"""
    res = res.replace("```json", "").replace("```", "").strip()
    response_dict = json.loads(res)
    return {
        "classification": response_dict.get("spam") or response_dict.get("spam_or_not"),
        "spam_words": response_dict.get("keywords", "N/A"),
        "suggestion": response_dict.get("action", "N/A"),
        "category": response_dict.get("category", "N/A")
    }

def analyze_text(text: str):
    """Analyze text using Google Gemini"""
    prompt = f"""
    Analyze the following message for spam detection:
    1. Is it spam or not? (Answer 'Spam' or 'Not Spam')
    2. If spam, list key words responsible for classification
    3. If spam, suggest if it is fraud/phishing or suggest to block or reply not interested.
    4. If not spam, categorize it as 'Personal' or 'Work'.
    return response in json format
    Message: "{text}"
    """
    model_gemini = genai.GenerativeModel("gemini-1.5-flash-latest")
    response = model_gemini.generate_content(prompt)
    return format_response(response.text)

def transform_text(text: str):
    """Text preprocessing: lowercase, tokenization, stopword removal, stemming"""
    text = text.lower()
    text = nltk.word_tokenize(text)
    y = [i for i in text if i.isalnum()]
    y = [i for i in y if i not in stopwords.words('english') and i not in string.punctuation]
    y = [ps.stem(i) for i in y]
    return " ".join(y)

def save_to_csv(text: str, label: str, category: str):
    """Append prediction data to CSV"""
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    new_data = pd.DataFrame([[text, label, category]], columns=["message", "label", "category"])

    if os.path.exists(CSV_PATH):
        existing_data = pd.read_csv(CSV_PATH)
        is_duplicate = ((existing_data["message"] == text) &
                        (existing_data["label"] == label) &
                        (existing_data["category"] == category)).any()
        if not is_duplicate:
            new_data.to_csv(CSV_PATH, mode="a", header=False, index=False)
    else:
        new_data.to_csv(CSV_PATH, index=False)

# ---------- Request Models ----------
class PredictRequest(BaseModel):
    text: str

class SignupRequest(BaseModel):
    email: str
    password: str
    app_password: str

class LoginRequest(BaseModel):
    email: str
    password: str

# ---------- Routes ----------

@app.post("/predict")
async def predict(request: PredictRequest):
    text = request.text
    transformed_text = transform_text(text)
    vectorized_text = vectorizer.transform([transformed_text]).toarray()
    prediction = model.predict(vectorized_text)
    label = "spam" if prediction[0] == 1 else "not spam"

    gemini_response = analyze_text(transformed_text)
    category = gemini_response["category"] if gemini_response["category"] != "N/A" else "None"

    # Message formatting for WhatsApp
    if gemini_response["classification"] == "Spam":
        response_message = f"{text}\n🚨 Spam Detected!\nSuggestion: {gemini_response['suggestion']}"
    else:
        response_message = f"{text}\n✅ Not Spam\nMessage Category: {gemini_response['category']}"

    # Optionally send WhatsApp message
    # send_whatsapp_message(response_message)

    # Save prediction
    save_to_csv(text, label, category)

    return {
        "naive": {"spam": bool(prediction[0] == 1)},
        "gemini": gemini_response
    }

@app.post("/fetch-email")
async def fetch_email():
    num_emails = 5
    user = "spam.detection.viit@gmail.com"
    password = "hmsfwdibjfdchvik"
    imap_url = "imap.gmail.com"
    my_mail = imaplib.IMAP4_SSL(imap_url)
    my_mail.login(user, password)
    my_mail.select("Inbox")

    _, data = my_mail.search(None, "ALL")
    mail_id_list = data[0].split()
    latest_mails = reversed(mail_id_list[-num_emails:])

    emails_data = []
    for num in latest_mails:
        _, data = my_mail.fetch(num, "(RFC822)")
        for response_part in data:
            if isinstance(response_part, tuple):
                my_msg = email.message_from_bytes(response_part[1])
                email_info = {
                    "subject": my_msg["subject"],
                    "from": my_msg["from"],
                    "body": ""
                }
                for part in my_msg.walk():
                    if part.get_content_type() == "text/plain":
                        email_info["body"] = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                emails_data.append(email_info)

    my_mail.logout()
    return emails_data

@app.get("/history")
async def get_history():
    try:
        df = pd.read_csv(CSV_PATH)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graphs")
async def get_graphs():
    try:
        df = pd.read_csv(CSV_PATH)
        filtered_df = df[["label", "category"]]
        return filtered_df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/clear-history")
async def clear_history():
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, "w", newline="") as file:
            file.write("message,label,category\n")
    return {"message": "History cleared successfully"}


# ---------- Run ----------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
