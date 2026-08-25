from app.services.url_analyzer import url_analyzer
from app.services.indicator_service import indicator_service

def test_url_extractor():
    text = "Check this out: http://example.xyz/login and https://google.com for info."
    urls = url_analyzer.analyze_all_urls(text)
    assert len(urls) == 2
    
    # Check xyz is graded blocked
    xyz_check = next(u for u in urls if "example.xyz" in u["url"])
    assert xyz_check["status"] == "blocked"
    
    google_check = next(u for u in urls if "google.com" in u["url"])
    assert google_check["status"] == "safe"

def test_indicators_checks():
    sender = "security-alert@fictional-domain.xyz"
    subject = "Immediate Account Lock warning"
    body = "Please review updates immediately."
    urls = [{"url": "http://fictional-domain.xyz/login", "hostname": "fictional-domain.xyz", "status": "blocked"}]
    
    indicators = indicator_service.analyze_indicators(sender, subject, body, urls)
    codes = [ind["code"] for ind in indicators]
    assert "SENDER_ALERT" in codes
    assert "URGENT_LANGUAGE" in codes
    assert "HIGH_RISK_TLD" in codes
