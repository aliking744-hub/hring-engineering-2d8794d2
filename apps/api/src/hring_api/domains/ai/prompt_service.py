from __future__ import annotations

import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from string import Formatter
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from hring_api.domains.admin.repository import add_audit_log
from hring_api.domains.ai.gateway_client import AiGatewayResult, generate_with_ai_gateway
from hring_api.domains.ai.feature_routing import resolve_runtime_feature_route
from hring_api.domains.ai.models import AiPrompt, AiPromptVersion
from hring_api.domains.ai.prompt_repository import (
    get_prompt,
    get_prompt_by_key,
    get_prompt_version,
    get_prompt_version_by_status,
    list_prompt_versions,
    list_prompts,
    next_prompt_version,
)
from hring_api.domains.ai.prompt_schemas import (
    PromptCreateRequest,
    PromptDetailResponse,
    PromptPatchRequest,
    PromptResponse,
    PromptTestResponse,
    PromptVersionDraftRequest,
    PromptVersionPatchRequest,
    PromptVersionResponse,
)


SIMPLE_VARIABLE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,79}$")


class PromptRegistryError(RuntimeError):
    pass


class PromptNotFoundError(PromptRegistryError):
    pass


class PromptConflictError(PromptRegistryError):
    pass


class PromptValidationError(PromptRegistryError):
    pass


@dataclass(frozen=True)
class RenderedPrompt:
    system: str | None
    user: str


def _template_variables(template: str | None) -> set[str]:
    if not template:
        return set()
    variables: set[str] = set()
    try:
        fields = Formatter().parse(template)
        for _literal, field_name, format_spec, conversion in fields:
            if field_name is None:
                continue
            if not SIMPLE_VARIABLE.fullmatch(field_name):
                raise PromptValidationError(
                    "Prompt placeholders must be simple names such as {candidate_name}"
                )
            if format_spec or conversion:
                raise PromptValidationError(
                    "Prompt placeholders cannot use format specifiers or conversions"
                )
            variables.add(field_name)
    except ValueError as exc:
        raise PromptValidationError("Prompt template contains invalid braces") from exc
    return variables


def _validate_output_schema(schema: dict[str, object] | None, response_format: str) -> None:
    if response_format == "text":
        if schema is not None:
            raise PromptValidationError("Text prompts cannot define an output schema")
        return
    if not schema or schema.get("type") != "object":
        raise PromptValidationError("JSON output schema must have object as its root type")
    properties = schema.get("properties")
    if properties is not None and not isinstance(properties, dict):
        raise PromptValidationError("Output schema properties must be an object")
    required = schema.get("required")
    if required is not None:
        if not isinstance(required, list) or not all(isinstance(item, str) for item in required):
            raise PromptValidationError("Output schema required must be a string array")
        if isinstance(properties, dict) and not set(required).issubset(properties):
            raise PromptValidationError("Every required field must exist in schema properties")


def validate_prompt_contract(payload: PromptVersionDraftRequest) -> None:
    declared = set(payload.input_variables)
    discovered = _template_variables(payload.system_template) | _template_variables(
        payload.user_template
    )
    if declared != discovered:
        missing = sorted(discovered - declared)
        unused = sorted(declared - discovered)
        details: list[str] = []
        if missing:
            details.append(f"undeclared placeholders: {', '.join(missing)}")
        if unused:
            details.append(f"unused variables: {', '.join(unused)}")
        raise PromptValidationError("Prompt variable contract mismatch; " + "; ".join(details))
    _validate_output_schema(payload.output_schema, payload.response_format)


def render_prompt(
    version: AiPromptVersion,
    variables: dict[str, str],
) -> RenderedPrompt:
    declared = set(version.input_variables_json)
    supplied = set(variables)
    if declared != supplied:
        missing = sorted(declared - supplied)
        extra = sorted(supplied - declared)
        details: list[str] = []
        if missing:
            details.append(f"missing variables: {', '.join(missing)}")
        if extra:
            details.append(f"unknown variables: {', '.join(extra)}")
        raise PromptValidationError("Prompt test variables do not match; " + "; ".join(details))
    try:
        system = (
            version.system_template.format_map(variables)
            if version.system_template is not None
            else None
        )
        user = version.user_template.format_map(variables)
    except (KeyError, ValueError) as exc:
        raise PromptValidationError("Prompt could not be rendered") from exc
    return RenderedPrompt(system=system, user=user)


async def generate_with_registered_prompt(
    session: AsyncSession,
    *,
    prompt_key: str,
    variables: dict[str, str],
    user_id: UUID | None,
    company_id: UUID | None,
    credits_charged: int = 0,
    modalities: list[str] | None = None,
) -> AiGatewayResult:
    """Resolve the published version and attach immutable prompt provenance.

    Product modules call this entry point instead of embedding prompts or model
    credentials in their own code. Prompt input and output remain outside the
    registry; only version/provider/model usage metadata is persisted.
    """

    prompt = await get_prompt_by_key(session, prompt_key)
    if prompt is None or not prompt.is_active:
        raise PromptNotFoundError("Active prompt was not found")
    version = await get_prompt_version_by_status(
        session,
        prompt_id=prompt.id,
        status="published",
    )
    if version is None:
        raise PromptConflictError("Prompt has no published version")
    validate_prompt_contract(_version_values(version))
    rendered = render_prompt(version, variables)
    route = await resolve_runtime_feature_route(
        feature_key=prompt.feature_key,
        default_provider=version.provider_alias,
        default_model=version.model,
    )
    messages: list[dict[str, str]] = []
    if rendered.system:
        messages.append({"role": "system", "content": rendered.system})
    messages.append({"role": "user", "content": rendered.user})
    result = await generate_with_ai_gateway(
        feature_key=prompt.feature_key,
        user_id=user_id,
        company_id=company_id,
        provider=route.provider,
        model=route.model,
        messages=messages,
        credits_charged=credits_charged,
        temperature=version.temperature,
        max_output_tokens=version.max_output_tokens,
        response_format=version.response_format,
        modalities=modalities,
        metadata_json={
            "prompt_key": prompt.prompt_key,
            "prompt_version_id": str(version.id),
            "prompt_version": version.version,
            "prompt_mode": "runtime",
            "ai_route_source": route.source,
            "prompt_provider_alias": version.provider_alias,
            "prompt_model": version.model,
        },
    )
    if version.response_format == "json_object":
        try:
            parsed = json.loads(result.content)
        except ValueError as exc:
            raise PromptValidationError("AI output is not valid JSON") from exc
        error = _schema_validation_error(parsed, version.output_schema_json or {})
        if error:
            raise PromptValidationError(f"AI output contract failed: {error}")
    return result


async def generate_with_managed_prompt(
    session: AsyncSession | None,
    *,
    prompt_key: str,
    variables: dict[str, str],
    user_id: UUID | None,
    company_id: UUID | None,
    fallback: Callable[[], Awaitable[AiGatewayResult]],
    credits_charged: int = 0,
    modalities: list[str] | None = None,
) -> AiGatewayResult:
    """Use a published registry prompt, or preserve the embedded product prompt.

    The fallback keeps existing product behavior intact while a seeded draft is
    reviewed and tested. Once a Super Admin publishes that draft, the runtime
    switches to the immutable registry version without another deployment.
    Invalid or failing published prompts do not silently fall back: they fail
    closed so an administrator can detect and roll them back.
    """

    if session is None:
        return await fallback()
    try:
        return await generate_with_registered_prompt(
            session,
            prompt_key=prompt_key,
            variables=variables,
            user_id=user_id,
            company_id=company_id,
            credits_charged=credits_charged,
            modalities=modalities,
        )
    except (PromptNotFoundError, PromptConflictError):
        return await fallback()


def _schema_validation_error(
    value: object, schema: dict[str, object], path: str = "$"
) -> str | None:
    expected = schema.get("type")
    if expected == "object":
        if not isinstance(value, dict):
            return f"{path} must be an object"
        required = schema.get("required")
        if isinstance(required, list):
            for key in required:
                if isinstance(key, str) and key not in value:
                    return f"{path}.{key} is required"
        properties = schema.get("properties")
        if isinstance(properties, dict):
            for key, child_schema in properties.items():
                if key in value and isinstance(child_schema, dict):
                    error = _schema_validation_error(value[key], child_schema, f"{path}.{key}")
                    if error:
                        return error
    elif expected == "array":
        if not isinstance(value, list):
            return f"{path} must be an array"
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                error = _schema_validation_error(item, item_schema, f"{path}[{index}]")
                if error:
                    return error
    elif expected == "string" and not isinstance(value, str):
        return f"{path} must be a string"
    elif expected == "integer" and (isinstance(value, bool) or not isinstance(value, int)):
        return f"{path} must be an integer"
    elif expected == "number" and (isinstance(value, bool) or not isinstance(value, int | float)):
        return f"{path} must be a number"
    elif expected == "boolean" and not isinstance(value, bool):
        return f"{path} must be a boolean"
    elif expected == "null" and value is not None:
        return f"{path} must be null"
    enum = schema.get("enum")
    if isinstance(enum, list) and value not in enum:
        return f"{path} is not one of the allowed values"
    return None


def _version_response(version: AiPromptVersion) -> PromptVersionResponse:
    return PromptVersionResponse(
        id=version.id,
        prompt_id=version.prompt_id,
        version=version.version,
        status=version.status,
        provider_alias=version.provider_alias,
        model=version.model,
        system_template=version.system_template,
        user_template=version.user_template,
        input_variables=version.input_variables_json,
        response_format=version.response_format,
        output_schema=version.output_schema_json,
        temperature=version.temperature,
        max_output_tokens=version.max_output_tokens,
        test_status=version.test_status,
        last_tested_at=version.last_tested_at,
        last_test_error=version.last_test_error,
        created_by=version.created_by,
        published_by=version.published_by,
        created_at=version.created_at,
        published_at=version.published_at,
    )


def _prompt_response(prompt: AiPrompt, versions: list[AiPromptVersion]) -> PromptResponse:
    published = next((item for item in versions if item.status == "published"), None)
    draft = next((item for item in versions if item.status == "draft"), None)
    return PromptResponse(
        id=prompt.id,
        prompt_key=prompt.prompt_key,
        feature_key=prompt.feature_key,
        display_name=prompt.display_name,
        description=prompt.description,
        is_active=prompt.is_active,
        published_version=published.version if published else None,
        published_provider_alias=published.provider_alias if published else None,
        published_model=published.model if published else None,
        draft_version=draft.version if draft else None,
        draft_provider_alias=draft.provider_alias if draft else None,
        draft_model=draft.model if draft else None,
        version_count=len(versions),
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
    )


async def prompt_detail(session: AsyncSession, prompt: AiPrompt) -> PromptDetailResponse:
    versions = await list_prompt_versions(session, prompt.id)
    summary = _prompt_response(prompt, versions)
    return PromptDetailResponse(
        **summary.model_dump(),
        versions=[_version_response(version) for version in versions],
    )


async def list_prompt_responses(session: AsyncSession) -> list[PromptResponse]:
    prompts = await list_prompts(session)
    responses: list[PromptResponse] = []
    for prompt in prompts:
        versions = await list_prompt_versions(session, prompt.id)
        responses.append(_prompt_response(prompt, versions))
    return responses


async def require_prompt(session: AsyncSession, prompt_id: UUID) -> AiPrompt:
    prompt = await get_prompt(session, prompt_id)
    if prompt is None:
        raise PromptNotFoundError("Prompt was not found")
    return prompt


def _apply_version_values(
    version: AiPromptVersion,
    values: PromptVersionDraftRequest,
) -> None:
    version.provider_alias = values.provider_alias
    version.model = values.model
    version.system_template = values.system_template
    version.user_template = values.user_template
    version.input_variables_json = values.input_variables
    version.response_format = values.response_format
    version.output_schema_json = values.output_schema
    version.temperature = values.temperature
    version.max_output_tokens = values.max_output_tokens


def _version_values(version: AiPromptVersion) -> PromptVersionDraftRequest:
    return PromptVersionDraftRequest(
        provider_alias=version.provider_alias,
        model=version.model,
        system_template=version.system_template,
        user_template=version.user_template,
        input_variables=version.input_variables_json,
        response_format=version.response_format,
        output_schema=version.output_schema_json,
        temperature=version.temperature,
        max_output_tokens=version.max_output_tokens,
    )


async def create_prompt(
    session: AsyncSession,
    *,
    payload: PromptCreateRequest,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiPrompt:
    if await get_prompt_by_key(session, payload.prompt_key) is not None:
        raise PromptConflictError("Prompt key already exists")
    validate_prompt_contract(payload.version)
    prompt = AiPrompt(
        prompt_key=payload.prompt_key,
        feature_key=payload.feature_key,
        display_name=payload.display_name,
        description=payload.description,
        created_by=actor_user_id,
        updated_by=actor_user_id,
    )
    session.add(prompt)
    await session.flush()
    version = AiPromptVersion(
        prompt_id=prompt.id,
        version=1,
        status="draft",
        provider_alias=payload.version.provider_alias,
        model=payload.version.model,
        system_template=payload.version.system_template,
        user_template=payload.version.user_template,
        input_variables_json=payload.version.input_variables,
        response_format=payload.version.response_format,
        output_schema_json=payload.version.output_schema,
        temperature=payload.version.temperature,
        max_output_tokens=payload.version.max_output_tokens,
        test_status="untested",
        created_by=actor_user_id,
    )
    session.add(version)
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.create",
        resource_type="ai_prompt",
        resource_id=str(prompt.id),
        metadata_json={"prompt_key": prompt.prompt_key, "version": 1},
        ip_address=ip_address,
    )
    return prompt


async def update_prompt(
    session: AsyncSession,
    *,
    prompt: AiPrompt,
    payload: PromptPatchRequest,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiPrompt:
    fields = payload.model_fields_set
    if "feature_key" in fields:
        if payload.feature_key is None or not re.fullmatch(
            r"[a-z][a-z0-9_.-]{0,119}", payload.feature_key.strip()
        ):
            raise PromptValidationError("Feature key is invalid")
        prompt.feature_key = payload.feature_key.strip()
    if "display_name" in fields:
        if payload.display_name is None or not payload.display_name.strip():
            raise PromptValidationError("Display name is required")
        prompt.display_name = payload.display_name.strip()
    if "description" in fields:
        prompt.description = payload.description.strip() if payload.description else None
    if "is_active" in fields and payload.is_active is not None:
        prompt.is_active = payload.is_active
    prompt.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.update",
        resource_type="ai_prompt",
        resource_id=str(prompt.id),
        metadata_json={"prompt_key": prompt.prompt_key, "fields": sorted(fields)},
        ip_address=ip_address,
    )
    return prompt


async def create_draft(
    session: AsyncSession,
    *,
    prompt: AiPrompt,
    source_version_id: UUID | None,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiPromptVersion:
    locked_prompt = await get_prompt(session, prompt.id, for_update=True)
    if locked_prompt is None:
        raise PromptNotFoundError("Prompt was not found")
    prompt = locked_prompt
    if await get_prompt_version_by_status(session, prompt_id=prompt.id, status="draft") is not None:
        raise PromptConflictError("This prompt already has a draft")
    source = None
    if source_version_id is not None:
        source = await get_prompt_version(
            session,
            prompt_id=prompt.id,
            version_id=source_version_id,
        )
    else:
        source = await get_prompt_version_by_status(
            session,
            prompt_id=prompt.id,
            status="published",
        )
    if source is None:
        raise PromptNotFoundError("Source prompt version was not found")
    version = AiPromptVersion(
        prompt_id=prompt.id,
        version=await next_prompt_version(session, prompt.id),
        status="draft",
        provider_alias=source.provider_alias,
        model=source.model,
        system_template=source.system_template,
        user_template=source.user_template,
        input_variables_json=list(source.input_variables_json),
        response_format=source.response_format,
        output_schema_json=source.output_schema_json,
        temperature=source.temperature,
        max_output_tokens=source.max_output_tokens,
        test_status="untested",
        created_by=actor_user_id,
    )
    session.add(version)
    prompt.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.draft.create",
        resource_type="ai_prompt_version",
        resource_id=str(version.id),
        metadata_json={
            "prompt_key": prompt.prompt_key,
            "version": version.version,
            "source_version": source.version,
        },
        ip_address=ip_address,
    )
    return version


async def update_draft(
    session: AsyncSession,
    *,
    prompt: AiPrompt,
    version: AiPromptVersion,
    payload: PromptVersionPatchRequest,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiPromptVersion:
    if version.status != "draft":
        raise PromptConflictError("Published and archived prompt versions are immutable")
    values = _version_values(version).model_dump()
    for field in payload.model_fields_set:
        values[field] = getattr(payload, field)
    try:
        validated = PromptVersionDraftRequest.model_validate(values)
    except ValueError as exc:
        raise PromptValidationError(str(exc)) from exc
    validate_prompt_contract(validated)
    _apply_version_values(version, validated)
    version.test_status = "untested"
    version.last_tested_at = None
    version.last_test_error = None
    prompt.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.draft.update",
        resource_type="ai_prompt_version",
        resource_id=str(version.id),
        metadata_json={
            "prompt_key": prompt.prompt_key,
            "version": version.version,
            "fields": sorted(payload.model_fields_set),
        },
        ip_address=ip_address,
    )
    return version


async def test_prompt_version(
    session: AsyncSession,
    *,
    prompt: AiPrompt,
    version: AiPromptVersion,
    variables: dict[str, str],
    actor_user_id: UUID,
    ip_address: str | None,
) -> PromptTestResponse:
    if version.status != "draft":
        raise PromptConflictError("Only draft prompt versions can be tested")
    values = _version_values(version)
    validate_prompt_contract(values)
    rendered = render_prompt(version, variables)
    messages: list[dict[str, str]] = []
    if rendered.system:
        messages.append({"role": "system", "content": rendered.system})
    messages.append({"role": "user", "content": rendered.user})
    tested_at = datetime.now(UTC)
    try:
        result = await generate_with_ai_gateway(
            feature_key=f"prompt-test.{prompt.prompt_key}"[:120],
            user_id=actor_user_id,
            company_id=None,
            provider=version.provider_alias,
            model=version.model,
            messages=messages,
            credits_charged=0,
            temperature=version.temperature,
            max_output_tokens=version.max_output_tokens,
            response_format=version.response_format,
            metadata_json={
                "prompt_key": prompt.prompt_key,
                "prompt_version_id": str(version.id),
                "prompt_version": version.version,
                "prompt_mode": "admin_test",
            },
        )
    except Exception:
        version.test_status = "failed"
        version.last_tested_at = tested_at
        version.last_test_error = "AI Gateway test failed"
        await add_audit_log(
            session,
            actor_user_id=actor_user_id,
            company_id=None,
            action="ai.prompt.test",
            resource_type="ai_prompt_version",
            resource_id=str(version.id),
            outcome="failure",
            metadata_json={"prompt_key": prompt.prompt_key, "version": version.version},
            ip_address=ip_address,
        )
        await session.flush()
        return PromptTestResponse(
            passed=False,
            schema_valid=None,
            rendered_system=rendered.system,
            rendered_user=rendered.user,
            content=None,
            provider=None,
            model=None,
            usage={},
            error="AI Gateway test failed",
            tested_at=tested_at,
        )

    schema_valid: bool | None = None
    schema_error: str | None = None
    if version.response_format == "json_object":
        schema_valid = False
        try:
            parsed = json.loads(result.content)
        except ValueError:
            schema_error = "Provider output is not valid JSON"
        else:
            schema = version.output_schema_json or {}
            schema_error = _schema_validation_error(parsed, schema)
            schema_valid = schema_error is None
    passed = schema_error is None
    version.test_status = "passed" if passed else "failed"
    version.last_tested_at = tested_at
    version.last_test_error = schema_error
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.test",
        resource_type="ai_prompt_version",
        resource_id=str(version.id),
        outcome="success" if passed else "failure",
        metadata_json={
            "prompt_key": prompt.prompt_key,
            "version": version.version,
            "provider": result.provider,
            "model": result.model,
            "schema_valid": schema_valid,
        },
        ip_address=ip_address,
    )
    await session.flush()
    return PromptTestResponse(
        passed=passed,
        schema_valid=schema_valid,
        rendered_system=rendered.system,
        rendered_user=rendered.user,
        content=result.content,
        provider=result.provider,
        model=result.model,
        usage=result.usage,
        error=schema_error,
        tested_at=tested_at,
    )


async def publish_draft(
    session: AsyncSession,
    *,
    prompt: AiPrompt,
    version: AiPromptVersion,
    actor_user_id: UUID,
    ip_address: str | None,
) -> AiPromptVersion:
    locked_prompt = await get_prompt(session, prompt.id, for_update=True)
    if locked_prompt is None:
        raise PromptNotFoundError("Prompt was not found")
    prompt = locked_prompt
    if not prompt.is_active:
        raise PromptConflictError("Inactive prompts cannot be published")
    if version.status != "draft":
        raise PromptConflictError("Only draft prompt versions can be published")
    if version.test_status != "passed":
        raise PromptConflictError("Prompt draft must pass a test before publishing")
    current = await get_prompt_version_by_status(
        session,
        prompt_id=prompt.id,
        status="published",
    )
    if current is not None:
        current.status = "archived"
        await session.flush()
    version.status = "published"
    version.published_by = actor_user_id
    version.published_at = datetime.now(UTC)
    prompt.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.publish",
        resource_type="ai_prompt_version",
        resource_id=str(version.id),
        metadata_json={"prompt_key": prompt.prompt_key, "version": version.version},
        ip_address=ip_address,
    )
    return version


async def rollback_prompt(
    session: AsyncSession,
    *,
    prompt_id: UUID,
    target_version_id: UUID,
    actor_user_id: UUID,
    ip_address: str | None,
) -> tuple[AiPrompt, AiPromptVersion]:
    prompt = await get_prompt(session, prompt_id, for_update=True)
    if prompt is None:
        raise PromptNotFoundError("Prompt was not found")
    if not prompt.is_active:
        raise PromptConflictError("Inactive prompts cannot be rolled back")
    target = await get_prompt_version(
        session,
        prompt_id=prompt.id,
        version_id=target_version_id,
    )
    if target is None or target.status != "archived":
        raise PromptConflictError("Rollback target must be an archived version")
    if await get_prompt_version_by_status(session, prompt_id=prompt.id, status="draft") is not None:
        raise PromptConflictError("Discard or publish the current draft before rollback")
    current = await get_prompt_version_by_status(
        session,
        prompt_id=prompt.id,
        status="published",
    )
    if current is not None:
        current.status = "archived"
        await session.flush()
    now = datetime.now(UTC)
    restored = AiPromptVersion(
        prompt_id=prompt.id,
        version=await next_prompt_version(session, prompt.id),
        status="published",
        provider_alias=target.provider_alias,
        model=target.model,
        system_template=target.system_template,
        user_template=target.user_template,
        input_variables_json=list(target.input_variables_json),
        response_format=target.response_format,
        output_schema_json=target.output_schema_json,
        temperature=target.temperature,
        max_output_tokens=target.max_output_tokens,
        test_status="passed",
        last_tested_at=target.last_tested_at,
        last_test_error=None,
        created_by=actor_user_id,
        published_by=actor_user_id,
        published_at=now,
    )
    session.add(restored)
    prompt.updated_by = actor_user_id
    await session.flush()
    await add_audit_log(
        session,
        actor_user_id=actor_user_id,
        company_id=None,
        action="ai.prompt.rollback",
        resource_type="ai_prompt_version",
        resource_id=str(restored.id),
        metadata_json={
            "prompt_key": prompt.prompt_key,
            "version": restored.version,
            "restored_from_version": target.version,
        },
        ip_address=ip_address,
    )
    return prompt, restored

