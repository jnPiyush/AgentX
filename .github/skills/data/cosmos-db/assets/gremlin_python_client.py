"""Production-ready Cosmos DB Gremlin client (gremlinpython) with retries and RU logging.

Requires: gremlinpython>=3.7, azure-identity (for AAD).
Use GraphSONSerializersV2d0 -- Cosmos Gremlin does not support v3.
"""
from __future__ import annotations

import logging
import os
import random
import time
from typing import Any, Iterable, Mapping, Optional

from gremlin_python.driver import client, serializer
from gremlin_python.driver.protocol import GremlinServerError

LOG = logging.getLogger("cosmos.gremlin")

DEFAULT_MAX_RETRIES = 6
DEFAULT_BASE_DELAY = 0.2  # seconds
RETRYABLE_STATUS = {408, 429, 449, 500, 503}


class CosmosGremlinClient:
    """Thin wrapper that adds retries and request-charge logging."""

    def __init__(
        self,
        account: str,
        database: str,
        graph: str,
        password: str,
        pool_size: int = 4,
        max_workers: int = 8,
    ) -> None:
        url = f"wss://{account}.gremlin.cosmos.azure.com:443/"
        username = f"/dbs/{database}/colls/{graph}"
        self._client = client.Client(
            url=url,
            traversal_source="g",
            username=username,
            password=password,
            message_serializer=serializer.GraphSONSerializersV2d0(),
            pool_size=pool_size,
            max_workers=max_workers,
        )

    def submit(
        self,
        query: str,
        bindings: Optional[Mapping[str, Any]] = None,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> list[Any]:
        delay = DEFAULT_BASE_DELAY
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries):
            try:
                result_set = self._client.submit(query, dict(bindings or {}))
                items = result_set.all().result()
                ru = result_set.status_attributes.get("x-ms-request-charge")
                LOG.info("gremlin ok query=%r ru=%s items=%d", query, ru, len(items))
                return items
            except GremlinServerError as e:
                code = self._extract_status(e)
                if code in RETRYABLE_STATUS and attempt < max_retries - 1:
                    wait_ms = float(e.status_attributes.get("x-ms-retry-after-ms", delay * 1000))
                    sleep_for = wait_ms / 1000.0 + random.uniform(0, 0.05)
                    LOG.warning(
                        "gremlin retry attempt=%d code=%s sleep=%.3fs query=%r",
                        attempt + 1, code, sleep_for, query,
                    )
                    time.sleep(sleep_for)
                    delay = min(delay * 2, 5.0)
                    last_exc = e
                    continue
                raise
        if last_exc:
            raise last_exc
        raise RuntimeError("gremlin: exhausted retries with no exception captured")

    def stream(self, query: str, bindings: Optional[Mapping[str, Any]] = None) -> Iterable[Any]:
        """Iterate results page by page for large result sets."""
        result_set = self._client.submit(query, dict(bindings or {}))
        for page in iter(result_set):
            for item in page:
                yield item

    def close(self) -> None:
        self._client.close()

    @staticmethod
    def _extract_status(exc: GremlinServerError) -> Optional[int]:
        attrs = getattr(exc, "status_attributes", {}) or {}
        code = attrs.get("x-ms-status-code")
        if code is not None:
            try:
                return int(code)
            except (TypeError, ValueError):
                return None
        return getattr(exc, "status_code", None)


def aad_password() -> str:
    """Acquire an AAD bearer token usable as the Gremlin password."""
    from azure.identity import DefaultAzureCredential

    cred = DefaultAzureCredential()
    token = cred.get_token("https://cosmos.azure.com/.default")
    return token.token


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    account = os.environ["COSMOS_ACCOUNT"]
    database = os.environ.get("COSMOS_DB", "social")
    graph = os.environ.get("COSMOS_GRAPH", "people")
    password = os.environ.get("COSMOS_KEY") or aad_password()

    g = CosmosGremlinClient(account, database, graph, password)
    try:
        rows = g.submit(
            "g.V().has('pk', pk).limit(5).project('id','label').by('id').by(label)",
            bindings={"pk": "tenant-42"},
        )
        for r in rows:
            print(r)
    finally:
        g.close()
