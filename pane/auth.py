"""The single shared auth seam for every pane route.

2026-08-22: spec 001 ships this seam open as a dated interim.  Every route,
including the SPA catch-all, mounts behind ``require_viewer``.  Spec 003 will
close the seam with a bearer token before any deployment.  No second auth path
may be added (FR-017, D-010 §5).
"""

from fastapi import Request


async def require_viewer(request: Request) -> None:
    """Dated open interim: admit every request.

    The 001 implementation intentionally performs no check.  This function is
    the single seam that spec 003's bearer token dependency will occupy.
    """
    return None
