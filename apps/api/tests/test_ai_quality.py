from hring_api.domains.ai.service import _safe_messages


def test_safe_messages_keeps_only_actual_user_prompts() -> None:
    messages = [
        {"role": "system", "content": "private routing instructions"},
        {"role": "user", "content": "  سؤال کاربر  "},
        {"role": "assistant", "content": "پاسخ قبلی"},
    ]

    assert _safe_messages(messages) == [
        {"role": "user", "content": "سؤال کاربر"},
    ]


def test_safe_messages_limits_retained_content() -> None:
    messages = [{"role": "user", "content": "x" * 25_000}]

    safe = _safe_messages(messages)

    assert len(safe) == 1
    assert len(safe[0]["content"]) == 20_000
