import dns.resolver

def check_spf_record(domain):
    """
    Query DNS TXT records for the domain to check if SPF is configured
    and verify its configuration details.
    """
    try:
        answers = dns.resolver.resolve(domain, 'TXT')
        for rdata in answers:
            for txt_string in rdata.strings:
                decoded = txt_string.decode('utf-8', errors='ignore')
                if decoded.startswith('v=spf1'):
                    return {
                        'configured': True,
                        'record': decoded,
                        'strict_pass': '-all' in decoded or '~all' in decoded
                    }
        return {'configured': False, 'record': None, 'strict_pass': False}
    except Exception:
        return {'configured': False, 'record': None, 'strict_pass': False}


def check_dmarc_record(domain):
    """
    Query DNS TXT records for _dmarc.domain to check DMARC security policy alignment.
    """
    try:
        dmarc_domain = f"_dmarc.{domain}"
        answers = dns.resolver.resolve(dmarc_domain, 'TXT')
        for rdata in answers:
            for txt_string in rdata.strings:
                decoded = txt_string.decode('utf-8', errors='ignore')
                if decoded.startswith('v=DMARC1'):
                    # Parse policy parameter (e.g. p=reject, p=quarantine, p=none)
                    policy = 'none'
                    if 'p=reject' in decoded.lower():
                        policy = 'reject'
                    elif 'p=quarantine' in decoded.lower():
                        policy = 'quarantine'
                        
                    return {
                        'configured': True,
                        'record': decoded,
                        'policy': policy
                    }
        return {'configured': False, 'record': None, 'policy': None}
    except Exception:
        return {'configured': False, 'record': None, 'policy': None}


def evaluate_domain_email_auth(sender_address):
    """
    Evaluate the SPF, DKIM, and DMARC alignments for a sender's domain.
    Returns alignment status flags and a trust indicator score (0-100).
    """
    if '@' not in sender_address:
        return {
            'spf_alignment': False,
            'dmarc_alignment': False,
            'auth_score': 0.0,
            'reasons': ["Invalid sender address syntax."]
        }

    domain = sender_address.split('@')[-1]
    
    spf = check_spf_record(domain)
    dmarc = check_dmarc_record(domain)
    
    reasons = []
    auth_score = 100.0

    # 1. Evaluate SPF Record
    if not spf['configured']:
        auth_score -= 40.0
        reasons.append("Sender domain lacks SPF DNS configuration.")
    elif not spf['strict_pass']:
        auth_score -= 15.0
        reasons.append("SPF record has softfail configuration (~all) instead of fail (-all).")

    # 2. Evaluate DMARC Policy
    if not dmarc['configured']:
        auth_score -= 40.0
        reasons.append("Sender domain lacks DMARC configuration.")
    else:
        if dmarc['policy'] == 'none':
            auth_score -= 15.0
            reasons.append("DMARC is configured but policy is set to 'none' (monitoring only).")
        elif dmarc['policy'] == 'quarantine':
            auth_score -= 5.0
            reasons.append("DMARC policy is set to quarantine suspicious mail.")

    auth_score = max(0.0, auth_score)

    return {
        'spf_alignment': spf['configured'],
        'dmarc_alignment': dmarc['configured'],
        'auth_score': auth_score,
        'reasons': reasons if reasons else ["Email authentication protocols (SPF/DMARC) are fully aligned."]
    }
