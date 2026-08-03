-- Phishing Email Detector Database Schema (MySQL)
-- Production Grade DDL with Referential Integrity, Cascades, and Indexes

CREATE DATABASE IF NOT EXISTS phishing_detector DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE phishing_detector;

-- Disable foreign key checks temporarily during setup to ensure clean creation
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if they exist to allow clean migrations during development
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS custom_rules;
DROP TABLE IF EXISTS threat_intelligence_db;
DROP TABLE IF EXISTS email_analysis_details;
DROP TABLE IF EXISTS scanned_emails;
DROP TABLE IF EXISTS monitored_inboxes;
DROP TABLE IF EXISTS oauth_accounts;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. OAuth Accounts Table (Stores Google Refresh Tokens securely)
CREATE TABLE oauth_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT NULL,
    refresh_token TEXT NULL,
    token_expiry TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_provider_user (provider, provider_user_id),
    INDEX idx_oauth_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Monitored Inboxes Table (For background polling state)
CREATE TABLE monitored_inboxes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    watch_expiration VARCHAR(255) NULL,
    last_history_id VARCHAR(100) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_inbox (user_id, email_address),
    INDEX idx_monitored_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Scanned Emails Table (Stores scan results summary)
CREATE TABLE scanned_emails (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message_id VARCHAR(255) NOT NULL UNIQUE,
    thread_id VARCHAR(255) NULL,
    sender VARCHAR(255) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(512) NULL,
    received_date TIMESTAMP NULL,
    body_text LONGTEXT NULL,
    risk_score FLOAT NOT NULL CHECK (risk_score >= 0.0 AND risk_score <= 100.0),
    classification ENUM('safe', 'suspect', 'phishing') NOT NULL DEFAULT 'safe',
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_scanned_user (user_id),
    INDEX idx_scanned_classification (classification),
    INDEX idx_scanned_sender (sender),
    INDEX idx_scan_date (scan_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Email Analysis Details Table (Stores deep analysis metrics)
CREATE TABLE email_analysis_details (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scanned_email_id INT NOT NULL UNIQUE,
    domain_reputation_score FLOAT NOT NULL DEFAULT 100.0,
    spf_alignment BOOLEAN NOT NULL DEFAULT FALSE,
    dkim_alignment BOOLEAN NOT NULL DEFAULT FALSE,
    dmarc_alignment BOOLEAN NOT NULL DEFAULT FALSE,
    url_analysis JSON NULL,
    attachment_analysis JSON NULL,
    nlp_entities JSON NULL,
    explain_reason TEXT NULL,
    FOREIGN KEY (scanned_email_id) REFERENCES scanned_emails(id) ON DELETE CASCADE,
    INDEX idx_details_email (scanned_email_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Threat Intelligence Database Table (Blacklisted domains, IPs, URLs)
CREATE TABLE threat_intelligence_db (
    id INT AUTO_INCREMENT PRIMARY KEY,
    threat_type ENUM('domain', 'ip', 'url') NOT NULL,
    threat_value VARCHAR(512) NOT NULL,
    risk_score INT NOT NULL DEFAULT 100 CHECK (risk_score >= 0 AND risk_score <= 100),
    source VARCHAR(100) NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_threat_type_val (threat_type, threat_value(255)),
    INDEX idx_threat_lookup (threat_type, threat_value(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Custom Rules Table (User-defined Whitelists & Blacklists)
CREATE TABLE custom_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL, -- NULL indicates Global rule managed by admin
    type ENUM('sender', 'domain', 'keyword') NOT NULL,
    pattern VARCHAR(255) NOT NULL,
    classification ENUM('whitelist', 'blacklist') NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rule_lookup (type, pattern)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Audit Logs Table (For tracking logins and security alterations)
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_time (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
