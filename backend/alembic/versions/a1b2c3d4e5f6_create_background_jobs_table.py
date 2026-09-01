"""create_background_jobs_table

Revision ID: a1b2c3d4e5f6
Revises: f82c30b5d02e
Create Date: 2026-09-01 15:15:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f82c30b5d02e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "background_jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("job_type", sa.String(length=50), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("integration_id", sa.UUID(), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="queued"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["integration_id"], ["email_integrations.id"], name="fk_background_jobs_integration_id", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_background_jobs_user_id", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_background_jobs"),
    )
    op.create_index(op.f("ix_background_jobs_created_at"), "background_jobs", ["created_at"], unique=False)
    op.create_index(op.f("ix_background_jobs_integration_id"), "background_jobs", ["integration_id"], unique=False)
    op.create_index(op.f("ix_background_jobs_job_type"), "background_jobs", ["job_type"], unique=False)
    op.create_index(op.f("ix_background_jobs_status"), "background_jobs", ["status"], unique=False)
    op.create_index(op.f("ix_background_jobs_user_id"), "background_jobs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_background_jobs_user_id"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_status"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_job_type"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_integration_id"), table_name="background_jobs")
    op.drop_index(op.f("ix_background_jobs_created_at"), table_name="background_jobs")
    op.drop_table("background_jobs")
