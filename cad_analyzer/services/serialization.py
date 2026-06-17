from datetime import datetime
from typing import Any


def serialize_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if document is None:
        return None
    result = {}
    for key, value in document.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        else:
            result[key] = value
    result.pop("passwordHash", None)
    return result


def envelope(data=None, pagination=None, error=None, success=True):
    return {
        "success": success,
        "data": data,
        "pagination": pagination,
        "error": error,
    }
