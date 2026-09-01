"""add_outlook_subscription_fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-01 15:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("email_integrations", sa.Column("subscription_id", sa.String(length=255), nullable=True))
    op.add_column("email_integrations", sa.Column("subscription_resource", sa.String(length=255), nullable=True))
    op.add_column("email_integrations", sa.Column("client_state_hash", sa.String(length=255), nullable=True))
    op.add_column("email_integrations", sa.Column("last_renewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("email_integrations", sa.Column("last_notification_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_email_integrations_subscription_id"), "email_integrations", ["subscription_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_integrations_subscription_id"), table_name="email_integrations")
    op.drop_column("email_integrations", "last_notification_at")
    op.drop_column("email_integrations", "last_renewed_at")
    op.drop_column("email_integrations", "client_state_hash")
    op.drop_column("email_integrations", "subscription_resource")
    op.drop_column("email_integrations", "subscription_id")
