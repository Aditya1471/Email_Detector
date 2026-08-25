from typing import List, Dict, Any

class IndicatorService:
    def analyze_indicators(self, sender: str, subject: str, body: str, urls: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        Runs heuristics checks over sender headers, subjects, and text bodies to 
        identify diagnostic risk flags.
        """
        indicators = []
        full_text = f"{sender} {subject} {body}".lower()

        # Rule 1: Administrative spoofing sender address
        if any(kw in sender.lower() for kw in ['admin', 'security', 'alert', 'support', 'billing', 'update']):
            indicators.append({
                "code": "SENDER_ALERT",
                "severity": "medium",
                "title": "Alert Sender Address",
                "message": f"Sender address '{sender}' contains administrative or alert keywords indicating potential authority spoofing."
            })

        # Rule 2: Social Engineering / Urgency language
        if any(kw in full_text for kw in ['urgent', 'immediate', 'action required', 'limitation', 'suspended', 'lock', 'verify within']):
            indicators.append({
                "code": "URGENT_LANGUAGE",
                "severity": "medium",
                "title": "Urgency Warning Markers",
                "message": "The message pressures the recipient to react quickly by warning of account limitations, suspension, or holds."
            })

        # Rule 3: Extracted URLs check
        if urls:
            indicators.append({
                "code": "HYPERLINK_CHECK",
                "severity": "low",
                "title": "Extracted Hyperlinks",
                "message": f"Identified {len(urls)} outgoing hyperlink(s) in email body payload."
            })

            # Check for high-risk URLs
            blocked_urls = [u for u in urls if u['status'] == 'blocked']
            warning_urls = [u for u in urls if u['status'] == 'warning']

            if blocked_urls:
                indicators.append({
                    "code": "HIGH_RISK_TLD",
                    "severity": "high",
                    "title": "Dangerous link Top Level Domain",
                    "message": "Includes destination links hosted on cheap or high-risk TLDs (such as .xyz, .biz) or mimicking online credentials verification portals."
                })
            
            if warning_urls:
                indicators.append({
                    "code": "BRAND_TYPOSQUAT",
                    "severity": "medium",
                    "title": "Unusual Link Structure",
                    "message": "Contains outgoing link destinations pointing to temporary sandbox domain names requiring caution."
                })

        # Fallback if text is clean
        if not indicators:
            indicators.append({
                "code": "CLEAN_TEXT",
                "severity": "low",
                "title": "Clean scan results",
                "message": "No threat indicators or suspicious lexical patterns identified in input headers."
            })

        return indicators

indicator_service = IndicatorService()
