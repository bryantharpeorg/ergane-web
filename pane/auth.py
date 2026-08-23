"""The single shared auth seam for every pane route.

2026-08-23: spec 003 US4 closes the seam 001 shipped open as a dated interim.
Every route mounts behind ``require_viewer`` — the floor document, the attention
list, the answer route, the SSE stream and the SPA catch-all — and there is no
second auth path (plan D-P11, constitution VI).

Two credentials meet here and only here:

* Every route but intake requires the shared token, presented either as
  ``Authorization: Bearer <token>`` (curl, the tests) or as the password half of
  ``Authorization: Basic base64(<any username>:<token>)``.  The Basic form is
  what makes a *browser* possible at all: 001 serves the shell itself through the
  guarded catch-all, so the first navigation must already carry the token, and a
  navigation cannot carry a bearer header.  The refusal advertises both schemes,
  the browser prompts once, and thereafter attaches the header to navigations,
  ``fetch`` and ``EventSource`` alike.
* The intake route is the one enumerated exception (FR-015): the factory POSTs a
  bare body with no header at all, so its credential rides the URL path the
  operator configured in ``ERGANE_WEBHOOK_URL``.  It is an exception to *which*
  credential is required, never to being guarded.

Whatever fails, the answer is one shape produced by one function — ``refusal()``
— so a missing credential and a wrong one cannot differ by a byte (D-P12).
"""

import base64
import binascii
import secrets

from fastapi import Request
from starlette.responses import Response

#: The path prefix whose credential rides the URL rather than a header.
INTAKE_PREFIX = "/intake/"

#: The one refusal, fixed: no route name, no floor data, no echo of what was sent.
REFUSAL_STATUS = 401
REFUSAL_BODY = b'{"error":"unauthorized"}'

#: The two challenges the refusal advertises, as two header *fields*.
#:
#: A client that joins them reads exactly the one string contracts/api.md fixes —
#: ``Basic realm="ergane pane", Bearer`` — and every test asserts that joined
#: value.  They are emitted separately because Chromium will not accept them
#: combined: it reads the trailing ``, Bearer`` as a malformed auth-param of the
#: Basic challenge, discards the whole challenge, and never prompts.  Sending one
#: field per challenge is what RFC 7235 § 4.1 provides for, and it is the
#: difference between a browser that can reach the pane at all and one that
#: cannot — which is the whole of D-P11.  Verified against headless chromium by
#: `web/tests/smoke/answer.spec.ts`.
REFUSAL_CHALLENGES = ('Basic realm="ergane pane"', "Bearer")

#: What a client sees once it has joined them; the byte string D-P12 names.
REFUSAL_CHALLENGE_HEADER = ", ".join(REFUSAL_CHALLENGES)


class Unauthorized(Exception):
    """Raised by ``require_viewer``; rendered by ``refusal()`` and nothing else."""


def refusal() -> Response:
    """The one refusal shape, byte-for-byte, for every reason it is given."""
    response = Response(
        content=REFUSAL_BODY,
        status_code=REFUSAL_STATUS,
        media_type="application/json",
    )
    for challenge in REFUSAL_CHALLENGES:
        response.raw_headers.append((b"www-authenticate", challenge.encode("ascii")))
    return response


def presented_secret(authorization: str | None) -> str | None:
    """The secret an ``Authorization`` header presents, under either scheme.

    ``Bearer <value>`` yields the value; ``Basic base64(user:pass)`` yields the
    password half and ignores the username, because the browser's prompt has a
    username field the pane has no use for.  Anything else yields ``None``, which
    the caller refuses exactly as it refuses a wrong value.
    """
    if not authorization:
        return None

    scheme, _, rest = authorization.partition(" ")
    rest = rest.strip()
    if not rest:
        return None

    if scheme.lower() == "bearer":
        return rest

    if scheme.lower() == "basic":
        try:
            decoded = base64.b64decode(rest, validate=True).decode("utf-8")
        except (binascii.Error, ValueError, UnicodeDecodeError):
            return None
        _username, separator, password = decoded.partition(":")
        return password if separator else None

    return None


def _matches(presented: str | None, configured: str | None) -> bool:
    """Constant-time comparison that never admits an unconfigured credential."""
    if not presented or not configured:
        return False
    return secrets.compare_digest(presented.encode("utf-8"), configured.encode("utf-8"))


async def require_viewer(request: Request) -> None:
    """Admit a request or raise ``Unauthorized``; the one gate, for every route."""
    settings = request.app.state.settings

    if request.url.path.startswith(INTAKE_PREFIX):
        # Everything after the endpoint origin is the secret — the same thing
        # `factory/notify/webhook.py` treats as one when it redacts a webhook URL
        # — so the whole tail is compared, not just its first segment.
        if _matches(request.url.path[len(INTAKE_PREFIX) :], settings.intake_credential):
            return None
        raise Unauthorized()

    if _matches(presented_secret(request.headers.get("authorization")), settings.token):
        return None
    raise Unauthorized()


async def unauthorized_handler(request: Request, exc: Exception) -> Response:
    """Render every ``Unauthorized`` through the one refusal function."""
    del request, exc
    return refusal()
