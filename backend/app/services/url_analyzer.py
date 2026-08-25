import re
from typing import Dict, List
from urllib.parse import urlparse


class URLAnalyzer:
    # URL extraction regex
    URL_REGEX = r"(https?://[^\s]+)"

    def extract_urls(self, text: str) -> List[str]:
        """
        Extracts all unique URLs from raw text content.
        """
        if not text:
            return []
        matches = re.findall(self.URL_REGEX, text)
        return list(set(matches))  # Deduplicate

    def analyze_url(self, url: str) -> Dict[str, str]:
        """
        Grades an individual URL based on structural and hostname keyword signals.
        """
        hostname = "unknown"
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or parsed.netloc or "unknown"
        except Exception:
            pass

        url_lower = url.toLowerCase() if hasattr(url, "toLowerCase") else url.lower()

        # Grading rules matching frontend
        if any(tld in url_lower for tld in [".xyz", ".biz", ".info", ".top", ".click", ".live"]) or any(
            kw in url_lower for kw in ["verify", "update", "banking", "login", "limitation", "billing"]
        ):
            status = "blocked"
        elif any(kw in url_lower for kw in ["hold", "sandbox", "alerts", "temporary"]):
            status = "warning"
        else:
            status = "safe"

        return {"url": url, "hostname": hostname, "status": status}

    def analyze_all_urls(self, text: str) -> List[Dict[str, str]]:
        """
        Extracts and analyzes all URLs from text.
        """
        urls = self.extract_urls(text)
        return [self.analyze_url(url) for url in urls]


url_analyzer = URLAnalyzer()
