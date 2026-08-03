import re
import nltk
from bs4 import BeautifulSoup

# Ensure NLTK resources are available locally
def download_nltk_resources():
    resources = ['stopwords', 'punkt', 'wordnet', 'omw-1.4']
    for res in resources:
        try:
            nltk.data.find(f"corpora/{res}" if res != 'punkt' else f"tokenizers/{res}")
        except LookupError:
            nltk.download(res, quiet=True)

# Run resource check on import
download_nltk_resources()

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

class EmailTextPreprocessor:
    """Preprocesses raw email body text for machine learning tokenizers."""
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        # Retain critical safety/urgency terms in stopwords mapping
        critical_terms = {'now', 'immediately', 'verify', 'update', 'payment'}
        self.stop_words = self.stop_words - critical_terms
        self.lemmatizer = WordNetLemmatizer()

    def clean_text(self, text):
        """Clean email body text: remove HTML markup, strip urls, normalize casing."""
        if not text:
            return ""

        # 1. HTML Boilerplate removal
        try:
            soup = BeautifulSoup(text, 'html.parser')
            text = soup.get_text()
        except Exception:
            pass

        # 2. Lowercase conversion
        text = text.lower()

        # 3. Strip URLs
        text = re.sub(r'https?://\S+|www\.\S+', ' ', text)

        # 4. Strip email addresses
        text = re.sub(r'\S+@\S+', ' ', text)

        # 5. Remove numbers and special characters (keep alphabet only)
        text = re.sub(r'[^a-zA-Z\s]', ' ', text)

        # 6. Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        # 7. Tokenization and lemmatization
        words = text.split()
        cleaned_words = [
            self.lemmatizer.lemmatize(w) for w in words 
            if w not in self.stop_words and len(w) > 2
        ]

        return " ".join(cleaned_words)
