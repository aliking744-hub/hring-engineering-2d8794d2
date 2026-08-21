from typing import Any, cast

import httpx

from hring_api.config import get_settings
from hring_api.domains.headhunting.schemas import CandidateInput, JobRequirements


class HeadhuntingSourceError(RuntimeError):
    pass


def _text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value).strip() or None


def _skills(value: object) -> str | None:
    if isinstance(value, list):
        values = [_text(item) for item in value]
        return ", ".join(item for item in values if item) or None
    return _text(value)


def _candidate_from_raw(raw: dict[str, Any]) -> CandidateInput:
    return CandidateInput(
        name=_text(raw.get("name") or raw.get("fullName") or raw.get("full_name")),
        email=_text(raw.get("email")),
        phone=_text(raw.get("phone") or raw.get("mobile")),
        skills=_skills(raw.get("skills")),
        experience=_text(raw.get("experience")),
        education=_text(raw.get("education")),
        last_company=_text(raw.get("lastCompany") or raw.get("last_company") or raw.get("company")),
        location=_text(raw.get("location") or raw.get("city")),
        title=_text(raw.get("title") or raw.get("jobTitle") or raw.get("job_title")),
        linkedin=_text(raw.get("linkedin") or raw.get("linkedinUrl") or raw.get("linkedin_url")),
        past_companies=_text(raw.get("pastCompanies") or raw.get("past_companies")),
        about=_text(raw.get("about") or raw.get("summary")),
        raw_data=raw,
    )


def _candidate_array(payload: object) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        values = payload
    elif isinstance(payload, dict):
        nested = payload.get("candidates")
        if not isinstance(nested, list):
            nested = payload.get("data")
        if not isinstance(nested, list):
            nested = payload.get("results")
        if not isinstance(nested, list):
            raise HeadhuntingSourceError("Candidate source returned an unsupported response shape")
        values = nested
    else:
        raise HeadhuntingSourceError("Candidate source returned an unsupported response shape")

    result: list[dict[str, Any]] = []
    for value in values:
        if isinstance(value, dict):
            result.append(cast(dict[str, Any], value))
    return result


async def fetch_candidates_from_source(
    *,
    requirements: JobRequirements,
) -> list[CandidateInput]:
    settings = get_settings()
    if settings.headhunting_source_webhook_url is None:
        raise HeadhuntingSourceError("Automatic headhunting source is not configured")
    url = settings.headhunting_source_webhook_url.get_secret_value().strip()
    if not url.startswith(("https://", "http://")):
        raise HeadhuntingSourceError("Automatic headhunting source URL is invalid")

    headers = {"Content-Type": "application/json"}
    if settings.headhunting_source_webhook_bearer_token is not None:
        token = settings.headhunting_source_webhook_bearer_token.get_secret_value().strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

    body = {
        "jobTitle": requirements.job_title,
        "city": requirements.city,
        "skills": requirements.skills or "",
        "experience": requirements.experience or "",
        "industry": requirements.industry or "",
        "seniorityLevel": requirements.seniority_level or "",
        "description": requirements.description or "",
    }
    timeout = httpx.Timeout(90.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
        raw_payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise HeadhuntingSourceError(
            f"Automatic headhunting source failed with HTTP {exc.response.status_code}"
        ) from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise HeadhuntingSourceError("Automatic headhunting source request failed") from exc

    raw_candidates = _candidate_array(raw_payload)
    if len(raw_candidates) > 100:
        raise HeadhuntingSourceError("Candidate source returned more than the safe limit of 100")

    candidates = [_candidate_from_raw(item) for item in raw_candidates]
    return [candidate for candidate in candidates if candidate.name or candidate.email or candidate.phone]
