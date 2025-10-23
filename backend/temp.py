from dotenv import load_dotenv
import google.generativeai as genai
import os
import json
import nltk
import string
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
import pickle
import pandas as pd
from datetime import datetime

JSON_PATH = "./history/history.json"
ps = PorterStemmer()

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

vectorizer = pickle.load(open("./models/vectorizer.pkl", "rb"))
model = pickle.load(open("./models/model.pkl", "rb"))

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

def save_to_json(sender: str, subject: str, email_content: str, gemini_analysis: dict):
    """Saves the analysis result to a JSON file."""
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    
    new_record = {
        "sender": sender,
        "subject": subject,
        "content": email_content,
        "gemini_prediction": gemini_analysis.get("prediction"),
        "reason": gemini_analysis.get("reason"),
        "recommendation": gemini_analysis.get("recommendation"),
        "spam_words": gemini_analysis.get("spam_words", []),
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
    sender = "chaitanya@gmail.com"
    subject = "Temp mail"
    print("--- Analyzing a non-spam message ---")
    non_spam_email = "Hi Bob, just checking in on the project status. Can we have a quick meeting tomorrow at 10 AM? Let me know. Thanks, Alice"
    naive_output = predict_spam_naive(non_spam_email)
    gemini_output_non_spam = predict_spam_gemini(non_spam_email)
    save_to_json(sender, subject, non_spam_email, gemini_output_non_spam)
    print("Saved non-spam analysis to history.json")

    print("\n--- Analyzing a spam message ---")
    spam_email = "Congratulations! You've won a $1,000,000 lottery. Click here to claim your prize now! This is a limited time offer, act fast!"
    naive_output = predict_spam_naive(spam_email)
    gemini_output_spam = predict_spam_gemini(spam_email)
    save_to_json(sender, subject, spam_email, gemini_output_spam)
    print("Saved spam analysis to history.json")
