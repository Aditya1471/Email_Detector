import re

def validate_manual_scan_payload(data):
    """Validate incoming payload parameters for manual scans."""
    errors = []
    
    if not data:
        return ["Request body is missing or is not valid JSON."]
        
    sender = data.get('sender')
    body_text = data.get('body_text')
    
    # Check required fields
    if not sender:
        errors.append("The 'sender' field is required.")
    elif not isinstance(sender, str) or '@' not in sender:
        errors.append("The 'sender' field must be a valid email address.")
        
    if not body_text:
        errors.append("The 'body_text' field is required.")
    elif not isinstance(body_text, str) or len(body_text.strip()) == 0:
        errors.append("The 'body_text' field cannot be blank.")
        
    # Check optional fields if present
    links = data.get('links')
    if links is not None:
        if not isinstance(links, list):
            errors.append("The 'links' field must be a list of strings.")
        else:
            for index, url in enumerate(links):
                if not isinstance(url, str):
                    errors.append(f"Link index {index} must be a string.")
                    
    return errors


def validate_rule_payload(data):
    """Validate incoming payload parameters for Whitelist / Blacklist custom rules."""
    errors = []
    
    if not data:
        return ["Request body is missing or is not valid JSON."]
        
    rule_type = data.get('type')
    pattern = data.get('pattern')
    classification = data.get('classification')
    
    # Validate type
    valid_types = ['sender', 'domain', 'keyword']
    if not rule_type:
        errors.append("The 'type' field is required.")
    elif rule_type not in valid_types:
        errors.append(f"Invalid rule type. Must be one of: {', '.join(valid_types)}")
        
    # Validate pattern
    if not pattern:
        errors.append("The 'pattern' field is required.")
    elif not isinstance(pattern, str) or len(pattern.strip()) == 0:
        errors.append("The 'pattern' field cannot be blank.")
    else:
        # Extra structural validations based on type
        if rule_type == 'sender' and '@' not in pattern:
            errors.append("A sender rule pattern must resemble a valid email address structure (e.g. user@domain.com).")
        elif rule_type == 'domain' and not re.match(r'^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$', pattern.lower()):
            errors.append("A domain rule pattern must be a valid root domain or subdomain (e.g. malicious-site.com).")

    # Validate classification
    valid_classes = ['whitelist', 'blacklist']
    if not classification:
        errors.append("The 'classification' field is required.")
    elif classification not in valid_classes:
        errors.append(f"Invalid classification. Must be one of: {', '.join(valid_classes)}")
        
    return errors


def validate_intel_payload(data):
    """Validate threat intelligence payload inputs."""
    errors = []
    
    if not data:
        return ["Request body is missing or is not valid JSON."]
        
    threat_type = data.get('threat_type')
    threat_value = data.get('threat_value')
    risk_score = data.get('risk_score')
    
    # Validate type
    valid_types = ['domain', 'ip', 'url']
    if not threat_type:
        errors.append("The 'threat_type' field is required.")
    elif threat_type not in valid_types:
        errors.append(f"Invalid threat type. Must be one of: {', '.join(valid_types)}")
        
    # Validate threat value
    if not threat_value:
        errors.append("The 'threat_value' field is required.")
    elif not isinstance(threat_value, str) or len(threat_value.strip()) == 0:
        errors.append("The 'threat_value' field cannot be blank.")
        
    # Validate risk score if present
    if risk_score is not None:
        try:
            score = int(risk_score)
            if score < 0 or score > 100:
                errors.append("The 'risk_score' field must be an integer between 0 and 100.")
        except (ValueError, TypeError):
            errors.append("The 'risk_score' must be a valid integer.")
            
    return errors
