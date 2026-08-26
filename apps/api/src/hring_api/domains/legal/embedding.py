from __future__ import annotations

import math
import re
import unicodedata
from hashlib import blake2b

from hring_api.domains.legal.models import EMBEDDING_DIMENSIONS


EMBEDDING_MODEL = "hring-fa-hash-v1"
_DIACRITICS = re.compile(r"[\u064b-\u065f\u0670\u06d6-\u06ed]")
_NON_WORD = re.compile(r"[^0-9a-z\u0600-\u06ff]+")


def normalize_persian_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).lower()
    text = text.replace("ي", "ی").replace("ك", "ک").replace("ۀ", "ه")
    text = _DIACRITICS.sub("", text)
    return " ".join(_NON_WORD.sub(" ", text).split())


def _features(value: str) -> list[tuple[str, float]]:
    normalized = normalize_persian_text(value)
    words = normalized.split()
    result: list[tuple[str, float]] = []
    for word in words:
        result.append((f"w:{word}", 2.0))
        padded = f"^{word}$"
        for size, weight in ((2, 0.7), (3, 1.0), (4, 0.8)):
            result.extend(
                (f"c{size}:{padded[index:index + size]}", weight)
                for index in range(max(0, len(padded) - size + 1))
            )
    for left, right in zip(words, words[1:]):
        result.append((f"b:{left}_{right}", 1.5))
    return result


def embed_text(value: str) -> list[float]:
    """Create a deterministic, local Persian-aware retrieval vector.

    The model is intentionally lightweight so ingestion and search work with no
    provider key or outbound network. Character n-grams handle Persian spelling
    variants while the hybrid PostgreSQL rank supplies exact lexical evidence.
    """

    vector = [0.0] * EMBEDDING_DIMENSIONS
    for feature, weight in _features(value):
        digest = blake2b(feature.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[index] += sign * weight
    magnitude = math.sqrt(sum(item * item for item in vector))
    if magnitude == 0:
        return vector
    return [item / magnitude for item in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right, strict=True))
