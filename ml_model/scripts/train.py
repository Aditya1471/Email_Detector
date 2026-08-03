import os
import csv
import random
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, accuracy_score, f1_score
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier

from ml_model.scripts.preprocess import EmailTextPreprocessor

# Directory paths
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))
DATASETS_DIR = os.path.join(PROJECT_ROOT, 'datasets')
MODEL_DIR = os.path.join(PROJECT_ROOT, 'ml_model')

def generate_synthetic_dataset(filepath):
    """
    Generate a balanced synthetic dataset of 2,000+ realistic email records
    for local training and syntax/pipeline validation.
    """
    print("[Dataset Seeding] Generating synthetic balanced dataset...")
    
    # 1. Templates for Ham (Legitimate Emails)
    ham_subjects = [
        "Weekly Project Progress Update",
        "Agenda for Tomorrow's Standup Meeting",
        "Quarterly financial report summary",
        "Lunch reservation details",
        "Approved: Expense report #3904",
        "Feedback on code design patterns",
        "New repository pull request merged",
        "Release notes for version 2.4.1",
        "Client presentation slide deck",
        "Annual performance evaluation reminder"
    ]
    
    ham_bodies = [
        "Hi Team, please find attached the weekly spreadsheet covering our key performance indicators.",
        "Let's meet tomorrow at 10 AM to discuss task prioritization and sprint objectives.",
        "Attached is the PDF copy of our Q3 budget allocation analysis. Let me know if you have questions.",
        "I booked a table for 5 at the corner grill for our team lunch tomorrow.",
        "Your request for business travel expenses has been reviewed and approved by management.",
        "The recent refactor of the database layer looks clean. Great job on the transaction alignments.",
        "Merged PR #405: updates user session cookies validation handlers.",
        "We successfully deployed the latest security patches to the production clusters.",
        "Attached are the slides for the client presentation. Please review them before the call.",
        "This is a reminder to submit your self-assessment before the end-of-month review cycle."
    ]

    # 2. Templates for Phishing (Threat Emails)
    phish_subjects = [
        "URGENT: Verify your account activity immediately!",
        "Security Alert: Unauthorized login attempts detected",
        "Update Billing Information: Payment Restrict Alert",
        "PayPal Support: Unauthorized funds transfer request",
        "Netflix: Your subscription has been suspended!",
        "Invoice Notification: Payment outstanding #83940",
        "System Warning: Update password immediately!",
        "Verify your banking details to avoid limitations",
        "Congratulations! You won a $1,000 reward voucher",
        "Microsoft Account: Verify security settings now"
    ]
    
    phish_bodies = [
        "We detected unusual login attempts on your account. Please click the link to verify your identity immediately.",
        "Someone accessed your profile from an unrecognized device in Russia. Verify your credentials below.",
        "Your recent invoice payment was declined. Update your billing credentials now to prevent account suspension.",
        "A transaction of $500.00 is pending verification. If you did not authorize this, log in here to cancel it.",
        "We could not process your monthly membership. Please update your payment card information at the link below.",
        "Your account is past due. To avoid immediate collection actions, pay your outstanding bill at this portal.",
        "Your email security credentials expire in 24 hours. Log in here to synchronize your active password.",
        "We detected security restrictions on your credit card. Update your banking profile details to restore access.",
        "You have been selected to receive a promotional gift card. Claim your reward by logging in here.",
        "To protect your privacy, we require verification of your email account status. Click below to continue."
    ]

    # 3. Urgency and spam triggers list
    urgency_words = ['verify', 'suspended', 'restrict', 'bank', 'payment', 'password', 'urgent', 'action required']

    records = []
    
    # Generate 1,000 Ham and 1,000 Phishing emails
    for i in range(1000):
        # Generate Ham
        subj = random.choice(ham_subjects) + f" (Ref: {random.randint(100, 999)})"
        body = random.choice(ham_bodies) + f" Thanks, {random.choice(['John', 'Alice', 'David', 'Sarah'])}."
        records.append({
            'subject': subj,
            'body_text': body,
            'url_count': random.randint(0, 1),
            'has_urgency': 0,
            'label': 0  # 0 represent Safe
        })
        
        # Generate Phishing
        subj_ph = random.choice(phish_subjects)
        body_ph = random.choice(phish_bodies) + f" Click here: http://verification-{random.choice(['paypal', 'chase', 'netflix', 'amazon'])}-support.net/login"
        records.append({
            'subject': subj_ph,
            'body_text': body_ph,
            'url_count': random.randint(1, 3),
            'has_urgency': 1 if any(w in body_ph.lower() or w in subj_ph.lower() for w in urgency_words) else 0,
            'label': 1  # 1 represent Phishing
        })

    # Save to CSV
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['subject', 'body_text', 'url_count', 'has_urgency', 'label'])
        writer.writeheader()
        writer.writerows(records)
        
    print(f"[Dataset Seeding] Synthetic dataset saved with {len(records)} records at: {filepath}")


def train_models():
    """Load dataset, extract features, compare ML classifiers and package best model."""
    dataset_path = os.path.join(DATASETS_DIR, 'phishing_dataset.csv')
    
    if not os.path.exists(dataset_path):
        generate_synthetic_dataset(dataset_path)

    # 1. Load Data
    df = pd.read_csv(dataset_path)
    df.fillna('', inplace=True)

    # 2. Text Preprocessing
    print("\n[Preprocessing] Cleaning and tokenizing email corpus text...")
    preprocessor = EmailTextPreprocessor()
    df['cleaned_text'] = df['body_text'].apply(preprocessor.clean_text)

    # 3. Feature Extraction (TF-IDF)
    print("[Vectorizer] Transforming email text into TF-IDF features matrix...")
    vectorizer = TfidfVectorizer(max_features=1500)
    tfidf_matrix = vectorizer.fit_transform(df['cleaned_text']).toarray()

    # 4. Merge text features with engineered meta-features
    meta_features = df[['url_count', 'has_urgency']].values
    X = np.hstack((tfidf_matrix, meta_features))
    y = df['label'].values

    # 5. Train / Test Split (80/20)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"Training features shape: {X_train.shape}")
    print(f"Testing features shape: {X_test.shape}")

    # 6. Model Training & Comparison
    print("\n==================================================")
    print("MODEL COMPARISON & EVALUATION")
    print("==================================================")

    # Model A: Random Forest
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train, y_train)
    rf_preds = rf.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_f1 = f1_score(y_test, rf_preds)
    print(f"Random Forest - Accuracy: {rf_acc * 100:.2f}%, F1-Score: {rf_f1 * 100:.2f}%")

    # Model B: XGBoost
    xgb = XGBClassifier(use_label_encoder=False, eval_metric='logloss', random_state=42)
    xgb.fit(X_train, y_train)
    xgb_preds = xgb.predict(X_test)
    xgb_acc = accuracy_score(y_test, xgb_preds)
    xgb_f1 = f1_score(y_test, xgb_preds)
    print(f"XGBoost Classifier - Accuracy: {xgb_acc * 100:.2f}%, F1-Score: {xgb_f1 * 100:.2f}%")

    # Choose Best Model (XGBoost typically outperforms Random Forest in gradient booster weights)
    best_classifier = None
    if xgb_acc >= rf_acc:
        best_classifier = xgb
        chosen_name = "XGBoost Classifier"
    else:
        best_classifier = rf
        chosen_name = "Random Forest Classifier"

    print(f"\n[OK] Selected Model: {chosen_name} (Best Accuracy)")

    # 7. Package and Serialize joblib files
    os.makedirs(MODEL_DIR, exist_ok=True)
    vectorizer_path = os.path.join(MODEL_DIR, 'vectorizer.joblib')
    classifier_path = os.path.join(MODEL_DIR, 'classifier.joblib')

    joblib.dump(vectorizer, vectorizer_path)
    joblib.dump(best_classifier, classifier_path)

    print("\n==================================================")
    print("MODEL SERIALIZATION SUCCESSFUL")
    print(f"Vectorizer saved to: {vectorizer_path}")
    print(f"Classifier saved to: {classifier_path}")
    print("==================================================")

if __name__ == '__main__':
    train_models()
