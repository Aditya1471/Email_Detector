import re
import whois
from datetime import datetime
from urllib.parse import urlparse

# Standard Levenshtein distance implementation for brand similarity checks
def levenshtein_distance(s1, s2):
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
        
    return previous_row[-1]


# Brands frequently targeted by typosquatting/homoglyph attacks
TARGET_BRANDS = [
    'paypal', 'google', 'microsoft', 'netflix', 'amazon', 'apple', 
    'facebook', 'instagram', 'linkedin', 'github', 'chase', 'bankofamerica', 
    'wellsfargo', 'stripe', 'coinbase', 'binance', 'adobe', 'dropbox'
]

def check_typosquatting(domain_name):
    """
    Check if the domain is a close spelling match (typosquat) 
    to high-profile target brands.
    """
    # Strip TLD and extract base name (e.g., paypa1.com -> paypa1)
    base_name = domain_name.split('.')[0].lower()
    
    for brand in TARGET_BRANDS:
        if base_name == brand:
            # Exact match: legitimate URL to target brand
            return False, None
            
        # Edit distance of 1 or 2 represents typosquatting
        dist = levenshtein_distance(base_name, brand)
        if 0 < dist <= 2:
            return True, brand
            
    return False, None


def get_domain_registration_age(domain_name):
    """
    Query WHOIS records to check the age of the domain in days.
    Newly registered domains represent a significant phishing indicator.
    """
    try:
        # Strip subdomain if present to look up root domain
        parts = domain_name.split('.')
        if len(parts) > 2:
            root_domain = '.'.join(parts[-2:])
        else:
            root_domain = domain_name

        w = whois.whois(root_domain)
        creation_date = w.creation_date
        
        # Handle cases where creation_date is returned as list of dates
        if isinstance(creation_date, list):
            creation_date = creation_date[0]
            
        if isinstance(creation_date, datetime):
            age_days = (datetime.utcnow() - creation_date).days
            return max(0, age_days)
            
        return 365 # Fallback to benign age if unparseable
    except Exception:
        # Graceful fallback in case of firewall blocks, rate limiting, or offline mode
        return 365


def analyze_extracted_urls(urls):
    """
    Scans a list of URLs and evaluates threat indicators.
    Returns: URL risk metrics and reasons.
    """
    url_results = []
    has_typosquatting = False
    new_domain_detected = False
    flagged_urls = []
    
    for url in urls:
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower().split(':')[0] # strip port
            if not domain:
                continue

            # 1. Spelling similarity checks
            is_typo, brand_matched = check_typosquatting(domain)
            
            # 2. Check domain age
            age_days = get_domain_registration_age(domain)
            
            # 3. Check suspicious keywords in path
            path = parsed.path.lower()
            suspicious_path = any(kw in path for kw in ['login', 'verify', 'update', 'banking', 'secure', 'account'])
            
            # Risk triggers
            is_flagged = is_typo or (age_days < 30) or suspicious_path
            
            url_results.append({
                'url': url,
                'domain': domain,
                'typosquatting_detected': is_typo,
                'target_brand': brand_matched,
                'domain_age_days': age_days,
                'suspicious_path': suspicious_path,
                'flagged': is_flagged
            })

            if is_typo:
                has_typosquatting = True
                flagged_urls.append(url)
            if age_days < 30:
                new_domain_detected = True
                flagged_urls.append(url)
                
        except Exception:
            continue

    reasons = []
    if has_typosquatting:
        reasons.append("Typosquatting/brand homoglyph domain spelling similarity matching detected.")
    if new_domain_detected:
        reasons.append("Email contains links pointing to domains registered less than 30 days ago.")

    return {
        'url_records': url_results,
        'has_typosquatting': has_typosquatting,
        'new_domain_detected': new_domain_detected,
        'flagged_urls': flagged_urls,
        'reasons': reasons
    }
