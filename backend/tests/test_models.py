import uuid
from app.models import Base, User, Scan, Feedback, ModelVersion

def test_models_import_and_metadata():
    # Verify metadata is loaded with all tables
    tables = Base.metadata.tables
    assert "users" in tables
    assert "scans" in tables
    assert "feedbacks" in tables
    assert "model_versions" in tables

def test_users_table_metadata():
    table = Base.metadata.tables["users"]
    
    # Columns verification
    columns = table.columns
    assert "id" in columns
    assert "email" in columns
    assert "password_hash" in columns
    assert "role" in columns
    assert "is_active" in columns
    assert "created_at" in columns
    assert "updated_at" in columns
    
    # Check constraints and indexes
    assert len(table.indexes) == 1  # Index on email (unique matches index too)
    assert any(idx.name == "ix_users_email" for idx in table.indexes) or table.columns["email"].unique

def test_scans_table_metadata():
    table = Base.metadata.tables["scans"]
    columns = table.columns
    
    # Privacy check: No raw email body or attachment columns
    assert "body" not in columns
    assert "email_body" not in columns
    assert "attachment" not in columns
    assert "attachment_payload" not in columns
    
    # Truncated or Domain-only details check
    assert "sender_domain" in columns
    assert "recipient_domain" in columns
    assert "subject_preview" in columns
    
    # Probability, scores, counters checks
    assert "risk_score" in columns
    assert "confidence" in columns
    assert "legitimate_probability" in columns
    assert "phishing_probability" in columns
    assert "url_count" in columns
    assert "indicator_count" in columns
    assert "high_severity_count" in columns
    
    # Indexes check
    # We indexed user_id and created_at
    indexes_names = {idx.name for idx in table.indexes}
    assert "ix_scans_user_id" in indexes_names
    assert "ix_scans_created_at" in indexes_names

def test_feedbacks_table_metadata():
    table = Base.metadata.tables["feedbacks"]
    columns = table.columns
    
    assert "scan_id" in columns
    assert "user_id" in columns
    assert "actual_label" in columns
    assert "is_helpful" in columns
    assert "comment" in columns
    
    # Indexes
    indexes_names = {idx.name for idx in table.indexes}
    assert "ix_feedbacks_scan_id" in indexes_names
    assert "ix_feedbacks_user_id" in indexes_names

def test_model_versions_table_metadata():
    table = Base.metadata.tables["model_versions"]
    columns = table.columns
    
    assert "version" in columns
    assert "algorithm" in columns
    assert "metrics_json" in columns
    assert "dataset_description" in columns
    assert "is_active" in columns
    
    # Indexes
    indexes_names = {idx.name for idx in table.indexes}
    assert "ix_model_versions_is_active" in indexes_names
