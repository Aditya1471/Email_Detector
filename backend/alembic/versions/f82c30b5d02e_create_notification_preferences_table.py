"""create_notification_preferences_table

Revision ID: f82c30b5d02e
Revises: e71b29a4c01d
Create Date: 2026-09-01 14:48:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f82c30b5d02e"
down_revision: Union[str, Sequence[str], None] = "e71b29a4c01d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notification_preferences",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("encrypted_phone_number", sa.Text(), nullable=True),
        sa.Column("masked_phone_number", sa.String(length=30), nullable=True),
        sa.Column("is_phone_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sms_alerts_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("risk_threshold", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("browser_alerts_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("alerts_paused", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("consent_recorded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("consent_ip", sa.String(length=50), nullable=True),
        sa.Column("opt_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_notification_preferences_user_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_user_notification_preferences"),
        sa.UniqueConstraint("user_id", name="uq_user_notification_preferences_user_id"),
    )
    op.create_index(
        op.f("ix_user_notification_preferences_user_id"),
        "user_notification_preferences",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_user_notification_preferences_user_id"), table_name="user_notification_preferences")
    op.drop_table("user_notification_preferences")
