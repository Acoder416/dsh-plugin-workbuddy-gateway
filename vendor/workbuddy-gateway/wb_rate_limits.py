"""WorkBuddy rate-limit response parsing; deadlines are UTC epoch seconds."""

import datetime
import email.utils
import json
import math
import re
import time


RESET_TIME = re.compile(
    r"(?:reset at|将在)\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})"
    r"\s+UTC([+-])(\d{1,2})(?::(\d{2}))?", re.IGNORECASE,
)


def _payload(body):
    try:
        parsed = json.loads(body)
    except (ValueError, UnicodeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def is_model_rate_limit(status, body):
    """Recognize HTTP 429 and the vendor's 6004 business error (also sent as 400)."""
    return status == 429 or _payload(body).get("code") in (6004, "6004")


def rate_limit_reset(body, headers=None, now=None, fallback_seconds=300):
    """Use a future vendor deadline, then Retry-After, then the configured fallback."""
    now = time.time() if now is None else now
    message = _payload(body).get("msg", "")
    match = RESET_TIME.search(message) if isinstance(message, str) else None
    if match:
        stamp, sign, hours, minutes = match.groups()
        try:
            hours, minutes = int(hours), int(minutes or 0)
            if hours > 23 or minutes > 59:
                raise ValueError("invalid UTC offset")
            offset = datetime.timedelta(hours=hours, minutes=minutes)
            zone = datetime.timezone(offset if sign == "+" else -offset)
            reset = datetime.datetime.strptime(stamp.replace("T", " "), "%Y-%m-%d %H:%M:%S").replace(tzinfo=zone).timestamp()
            if reset > now:
                return reset
        except (ValueError, OverflowError):
            pass  # Invalid vendor timestamps fall through to standard retry metadata.
    retry = next((str(v).strip() for k, v in (headers or {}).items() if k.lower() == "retry-after"), "")
    if retry.isdigit():
        delay = int(retry)
        if 0 < delay < 10**10:
            return now + delay
    elif retry:
        try:
            reset = email.utils.parsedate_to_datetime(retry).timestamp()
            if math.isfinite(reset) and reset > now:
                return reset
        except (ValueError, TypeError, OverflowError):
            pass  # Malformed Retry-After uses the bounded fallback duration.
    return now + fallback_seconds
