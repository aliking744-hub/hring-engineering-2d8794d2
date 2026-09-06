from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from hring_api.domains.development.service import (
    _scorable_tasks,
    onboarding_certificate_response,
)


def test_progress_counts_leaf_subtasks_instead_of_parent_groups() -> None:
    parent_id = uuid4()
    parent = SimpleNamespace(id=parent_id, parent_task_id=None, status="in_progress")
    completed = SimpleNamespace(id=uuid4(), parent_task_id=parent_id, status="completed")
    pending = SimpleNamespace(id=uuid4(), parent_task_id=parent_id, status="todo")

    assert _scorable_tasks([parent, completed, pending]) == [completed, pending]


def test_certificate_statement_uses_persisted_final_score() -> None:
    now = datetime.now(UTC)
    plan = SimpleNamespace(
        certificate_number="HRING-90-TEST",
        certificate_recipient_title="ms",
        certificate_issued_at=now,
        completed_at=now,
        employee_name="سارا احمدی",
        job_title="مدیر محصول",
        score=42,
    )

    certificate = onboarding_certificate_response(plan)

    assert certificate.score == 42
    assert certificate.statement.startswith("سرکار خانم سارا احمدی")
    assert "42 از ۱۰۰" in certificate.statement
