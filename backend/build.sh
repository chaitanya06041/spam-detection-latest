#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

python -m nltk.downloader stopwords
python -m nltk.downloader punkt
python -m nltk.downloader punkt_tab # Add this line to fix the error