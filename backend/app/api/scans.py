import time
import random
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List
from datetime import datetime

from ..schemas import ScanRequest, ScanResponse, Indicator, FeedbackRequest, FeedbackResponse
from ..services.url_analyzer import url_analyzer
from ..services.indicator_service import indicator_service
from ..services.prediction_service import prediction_service

router = APIRouter()

# In-memory database logs mock store
reports_db = {}
history_db = []

# Pre-populate history with dummy logs matching api.js
def init_history():
    if not history_db:
        history_db.extend([
            { "scan_id": "scan-phishing-003", "timestamp": datetime.utcnow().isoformat(), "subject": "URGENT: Account Limitation Notice", "classification": "phishing", "risk_score": 92, "model_version": "heuristic-xgb-v1.2" },
            { "scan_id": "scan-suspicious-002", "timestamp": datetime.utcnow().isoformat(), "subject": "Action Required: Billing Profile Hold", "classification": "suspicious", "risk_score": 48, "model_version": "heuristic-xgb-v1.2" },
            { "scan_id": "scan-safe-001", "timestamp": datetime.utcnow().isoformat(), "subject": "Weekly Sync Agenda: Marketing Review", "classification": "safe", "risk_score": 12, "model_version": "heuristic-xgb-v1.2" }
        ])
        
        # Save standard reports in db too
        reports_db["scan-safe-001"] = {
            "scan_id": "scan-safe-001",
            "classification": "safe",
            "risk_score": 12,
            "confidence": 94.5,
            "model_version": "heuristic-xgb-v1.2",
            "processing_time_ms": 68,
            "indicators": [
                { "code": "MX_RECORD_VALID", "severity": "low", "title": "Valid mail server records", "message": "The sender domain contains active DNS MX and SPF routing records." },
                { "code": "STANDARD_TYPOGRAPHY", "severity": "low", "title": "Standard formatting", "message": "The email contents contain standard spacing and neutral lexical patterns." }
            ],
            "recommendation": "Safe. This email contains no visible warning flags. Proceed with standard communication.",
            "disclaimer": "This demonstration result is an automated indicator based on heuristic rules, not a guarantee.",
            "sender": "colleague@organization-sandbox.com",
            "recipient": "team@organization-sandbox.com",
            "subject": "Weekly Sync Agenda: Marketing Review",
            "timestamp": datetime.utcnow().isoformat()
        }
        reports_db["scan-suspicious-002"] = {
            "scan_id": "scan-suspicious-002",
            "classification": "suspicious",
            "risk_score": 48,
            "confidence": 82.0,
            "model_version": "heuristic-xgb-v1.2",
            "processing_time_ms": 92,
            "indicators": [
                { "code": "URGENT_LANGUAGE", "severity": "medium", "title": "Urgency signals", "message": "The message pressures the recipient with a 48-hour verification limit." },
                { "code": "EXTERNAL_URL", "severity": "medium", "title": "External hyperlink", "message": "Contains a link to a billing alerts domain requiring verification." }
            ],
            "recommendation": "Caution. Verify the sender identity through a trusted alternative channel before clicking any links.",
            "disclaimer": "This demonstration result is an automated indicator based on heuristic rules, not a guarantee.",
            "sender": "updates@sandbox-billing-alerts.com",
            "recipient": "user@organization-sandbox.com",
            "subject": "Action Required: Billing Profile Hold",
            "timestamp": datetime.utcnow().isoformat()
        }
        reports_db["scan-phishing-003"] = {
            "scan_id": "scan-phishing-003",
            "classification": "phishing",
            "risk_score": 92,
            "confidence": 97.8,
            "model_version": "heuristic-xgb-v1.2",
            "processing_time_ms": 110,
            "indicators": [
                { "code": "URGENT_LIMITATION", "severity": "high", "title": "Social engineering keywords", "message": "Highly urgent warning terms matching password limitations and fund locks." },
                { "code": "BRAND_TYPOSQUAT", "severity": "high", "title": "Brand impersonation signature", "message": "Sender domain mimics a secure banking institution using a lookalike URL configuration." },
                { "code": "HIGH_RISK_TLD", "severity": "high", "title": "Dangerous link TLD", "message": "Includes link destinations hosted on cheap or high-risk top level domains (.xyz)." }
            ],
            "recommendation": "Critical Warning. Do not click links, open attachments, or input bank credentials. Report and delete the message.",
            "disclaimer": "This demonstration result is an automated indicator based on heuristic rules, not a guarantee.",
            "sender": "support@fictional-bank-security.com",
            "recipient": "customer@sandbox-mail.com",
            "subject": "URGENT: Account Limitation Notice",
            "timestamp": datetime.utcnow().isoformat()
        }

init_history()

@router.post("/scans", response_model=ScanResponse)
async def create_scan(request: ScanRequest):
    start_time = time.time()
    
    sender_val = request.sender or "undisclosed-sender@example.com"
    recipient_val = request.recipient or "recipient@example.com"
    subject_val = request.subject or "(No Subject)"

    # 1. Analyze URLs
    urls = url_analyzer.analyze_all_urls(request.body)
    
    # 2. Extract indicators
    indicators_raw = indicator_service.analyze_indicators(sender_val, subject_val, request.body, urls)
    indicators = [Indicator(**ind) for ind in indicators_raw]

    # 3. Classify ML Model risk
    classification, risk_score, confidence = prediction_service.predict_risk(sender_val, subject_val, request.body, indicators_raw)

    # 4. Generate recommendations matching classifications
    if classification == 'safe':
        rec = "Safe. This email contains no visible warning flags. Proceed with standard communication."
    elif classification == 'suspicious':
        rec = "Caution. Verify the sender identity through a trusted alternative channel before clicking any links."
    else:
        rec = "Critical Warning. Do not click links, open attachments, or input bank credentials. Report and delete the message."

    duration_ms = int((time.time() - start_time) * 1000) + 15  # Add layout parse offset padding

    scan_id = f"scan-{random.randint(100000, 999999)}"
    timestamp_str = datetime.utcnow().isoformat()

    response = ScanResponse(
        scan_id=scan_id,
        classification=classification,
        risk_score=risk_score,
        confidence=confidence,
        model_version="heuristic-xgb-v1.2",
        processing_time_ms=duration_ms,
        indicators=indicators,
        recommendation=rec,
        disclaimer="This result is generated by the machine learning model analysis, not a guarantee.",
        sender=sender_val,
        recipient=recipient_val,
        subject=subject_val,
        timestamp=timestamp_str
    )

    # Cache report and append history logs
    reports_db[scan_id] = response.model_dump() if hasattr(response, 'model_dump') else response.dict()
    history_db.insert(0, {
        "scan_id": scan_id,
        "timestamp": timestamp_str,
        "subject": subject_val,
        "classification": classification,
        "risk_score": risk_score,
        "model_version": "heuristic-xgb-v1.2"
    })

    return response

@router.get("/scans/{scan_id}", response_model=ScanResponse)
async def get_scan_report(scan_id: str):
    if scan_id not in reports_db:
        raise HTTPException(status_code=404, detail=f"Analysis report not found for ID: {scan_id}")
    return reports_db[scan_id]

@router.post("/scans/{scan_id}/feedback", response_model=FeedbackResponse)
async def submit_scan_feedback(scan_id: str, request: FeedbackRequest):
    print(f"[PhishGuard API] Feedback for {scan_id} received. Rating: {request.rating}, Comment: {request.comment}")
    return FeedbackResponse(success=True, message="Feedback submitted successfully.")

@router.get("/scans", response_model=List[dict])
async def get_scans_history():
    return history_db[:50]  # Cap at 50 logs

@router.get("/dashboard/stats")
async def get_dashboard_summary():
    total = len(history_db)
    safe = sum(1 for item in history_db if item['classification'] == 'safe')
    suspicious = sum(1 for item in history_db if item['classification'] == 'suspicious')
    phishing = sum(1 for item in history_db if item['classification'] == 'phishing')
    
    score_sum = sum(item['risk_score'] for item in history_db)
    avg_score = round(score_sum / total) if total > 0 else 0

    return {
        "total_scans": total,
        "safe_results": safe,
        "suspicious_results": suspicious,
        "phishing_results": phishing,
        "average_risk_score": avg_score
    }

# Mock Authentication Routes removed in favor of real security router app/api/auth.py
