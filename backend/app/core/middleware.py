"""Extracts a tenant *hint* from the ``X-Gym-ID`` header or the request's
subdomain and stashes it on ``request.state`` for the dependency pipeline.

This hint is never used on its own to authorize anything or to set RLS
session variables — a client-supplied header is untrusted input, and trusting
it directly for tenant scoping would let anyone read another gym's data just
by sending a different UUID. Its only two uses are:

1. Login convenience: ``/auth/token`` falls back to the subdomain hint when
   the request body omits ``gym_subdomain``, so a client hitting
   ``acme.subgym.io`` doesn't have to also pass the tenant in the JSON body.
2. Post-authentication cross-check: ``get_current_user`` compares the
   ``X-Gym-ID`` header (when present) against the authenticated user's real
   ``gym_id`` and rejects the request on mismatch — catches a misconfigured
   client/proxy sending requests to the wrong tenant's context, without ever
   letting the header itself decide what data is visible.
"""

import uuid
from dataclasses import dataclass

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

GYM_ID_HEADER = "X-Gym-ID"


@dataclass(frozen=True)
class TenantHint:
    gym_id: uuid.UUID | None
    subdomain: str | None


def _extract_subdomain(host: str) -> str | None:
    host = host.split(":", 1)[0].lower()
    suffix = f".{settings.BASE_DOMAIN}"
    if not host.endswith(suffix):
        return None
    subdomain = host[: -len(suffix)]
    if not subdomain or subdomain == "www":
        return None
    return subdomain


class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        gym_id_header = request.headers.get(GYM_ID_HEADER)
        gym_id_hint: uuid.UUID | None = None
        if gym_id_header:
            try:
                gym_id_hint = uuid.UUID(gym_id_header)
            except ValueError:
                gym_id_hint = None

        subdomain_hint = _extract_subdomain(request.headers.get("host", ""))

        request.state.tenant_hint = TenantHint(gym_id=gym_id_hint, subdomain=subdomain_hint)
        return await call_next(request)


def get_tenant_hint(request: Request) -> TenantHint:
    hint = getattr(request.state, "tenant_hint", None)
    return hint if hint is not None else TenantHint(gym_id=None, subdomain=None)
