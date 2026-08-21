from __future__ import annotations

import importlib
from collections.abc import Iterator
from typing import Any, BinaryIO

from hring_api.config import Settings


PUBLIC_LOGICAL_BUCKETS = frozenset({"avatars", "products", "blog-images", "site-assets"})


class StorageCompatError(RuntimeError):
    pass


def _client(settings: Settings) -> Any:
    boto3 = importlib.import_module("boto3")
    return boto3.client(
        "s3",
        endpoint_url=settings.object_storage_endpoint,
        aws_access_key_id=settings.object_storage_access_key,
        aws_secret_access_key=settings.object_storage_secret_key.get_secret_value(),
        region_name="us-east-1",
    )


def _safe_part(value: str) -> str:
    cleaned = value.strip().lstrip("/")
    if not cleaned or ".." in cleaned.split("/"):
        raise StorageCompatError("Invalid object path")
    return cleaned


def logical_key(logical_bucket: str, path: str) -> str:
    bucket = _safe_part(logical_bucket)
    key = _safe_part(path)
    return f"compat/{bucket}/{key}"


def put_object(
    settings: Settings,
    *,
    logical_bucket: str,
    path: str,
    stream: BinaryIO,
    content_type: str | None,
) -> str:
    key = logical_key(logical_bucket, path)
    client = _client(settings)
    if content_type:
        client.upload_fileobj(
            stream,
            settings.object_storage_bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    else:
        client.upload_fileobj(stream, settings.object_storage_bucket, key)
    return key


def delete_objects(settings: Settings, *, logical_bucket: str, paths: list[str]) -> None:
    client = _client(settings)
    objects = [{"Key": logical_key(logical_bucket, path)} for path in paths]
    if objects:
        client.delete_objects(
            Bucket=settings.object_storage_bucket,
            Delete={"Objects": objects, "Quiet": True},
        )


def read_object(settings: Settings, *, logical_bucket: str, path: str) -> tuple[Iterator[bytes], str]:
    client = _client(settings)
    try:
        response = client.get_object(
            Bucket=settings.object_storage_bucket,
            Key=logical_key(logical_bucket, path),
        )
    except Exception as exc:  # provider SDK exception hierarchy is optional at runtime
        raise StorageCompatError("Object not found") from exc
    body = response["Body"]
    content_type = str(response.get("ContentType") or "application/octet-stream")

    def iterator() -> Iterator[bytes]:
        try:
            while True:
                chunk = body.read(64 * 1024)
                if not chunk:
                    break
                yield bytes(chunk)
        finally:
            body.close()

    return iterator(), content_type


def list_objects(
    settings: Settings,
    *,
    logical_bucket: str,
    prefix: str,
    limit: int,
) -> list[dict[str, object]]:
    client = _client(settings)
    base = logical_key(logical_bucket, prefix) if prefix else f"compat/{_safe_part(logical_bucket)}/"
    response = client.list_objects_v2(
        Bucket=settings.object_storage_bucket,
        Prefix=base,
        MaxKeys=limit,
    )
    logical_prefix = f"compat/{_safe_part(logical_bucket)}/"
    rows: list[dict[str, object]] = []
    for item in response.get("Contents", []):
        key = str(item.get("Key", ""))
        if not key.startswith(logical_prefix):
            continue
        last_modified = item.get("LastModified")
        rows.append(
            {
                "name": key[len(logical_prefix) :],
                "size": int(item.get("Size", 0)),
                "updated_at": last_modified.isoformat() if last_modified is not None else None,
            }
        )
    return rows
