"""create_email_monitoring_tables

Revision ID: e71b29a4c01d
Revises: d3b98392601e
Create Date: 2026-09-01 14:30:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e71b29a4c01d"
down_revision: Union[str, Sequence[str], None] = "d3b98392601e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create email_integrations table
    op.create_table(
        "email_integrations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False, server_default="gmail"),
        sa.Column("provider_account_id", sa.String(length=255), nullable=False),
        sa.Column("email_address", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_sync_cursor", sa.String(length=255), nullable=True),
        sa.Column("subscription_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_email_integrations_user_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_email_integrations"),
        sa.UniqueConstraint("user_id", "provider", name="uq_user_provider_integration"),
    )
    op.create_index(op.f("ix_email_integrations_user_id"), "email_integrations", ["user_id"], unique=False)

    # 2. Create oauth_tokens table
    op.create_table(
        "oauth_tokens",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("integration_id", sa.UUID(), nullable=False),
        sa.Column("encrypted_access_token", sa.Text(), nullable=False),
        sa.Column("encrypted_refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["integration_id"], ["email_integrations.id"], name="fk_oauth_tokens_integration_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_oauth_tokens"),
        sa.UniqueConstraint("integration_id", name="uq_oauth_tokens_integration_id"),
    )

    # 3. Create monitored_messages table
    op.create_table(
        "monitored_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("integration_id", sa.UUID(), nullable=False),
        sa.Column("provider_message_id", sa.String(length=255), nullable=False),
        sa.Column("sender_domain", sa.String(length=255), nullable=True),
        sa.Column("subject_preview", sa.String(length=255), nullable=True),
        sa.Column("classification", sa.String(length=50), nullable=False, server_default="safe"),
        sa.Column("risk_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_version", sa.String(length=50), nullable=False, server_default="v1.0.0"),
        sa.Column("url_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("indicator_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notification_sent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["integration_id"], ["email_integrations.id"], name="fk_monitored_messages_integration_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_monitored_messages"),
        sa.UniqueConstraint("integration_id", "provider_message_id", name="uq_integration_provider_message"),
    )
    op.create_index(op.f("ix_monitored_messages_integration_id"), "monitored_messages", ["integration_id"], unique=False)
    op.create_index(op.f("ix_monitored_messages_created_at"), "monitored_messages", ["created_at"], unique=False)

    # 4. Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("monitored_message_id", sa.UUID(), nullable=True),
        sa.Column("channel", sa.String(length=50), nullable=False, server_default="sms"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["monitored_message_id"], ["monitored_messages.id"], name="fk_notifications_monitored_message_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_notifications_user_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_notifications"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_monitored_message_id"), "notifications", ["monitored_message_id"], unique=False)
    op.create_index(op.f("ix_notifications_created_at"), "notifications", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_created_at"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_monitored_message_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    op.drop_index(op.f("ix_monitored_messages_created_at"), table_name="monitored_messages")
    op.drop_index(op.f("ix_monitored_messages_integration_id"), table_name="monitored_messages")
    op.drop_table("monitored_messages")

    op.drop_table("oauth_tokens")

    op.drop_index(op.f("ix_email_integrations_user_id"), table_name="email_integrations")
    op.drop_table("email_integrations")
