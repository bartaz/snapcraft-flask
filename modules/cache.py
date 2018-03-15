import requests
from modules.exceptions import ApiTimeoutError


def get(
        url,
        headers,
        json=None,
        data=None,
        method=None,
        files=None
):
    """
    WARNING: The cache is disabled due to a bug on our caching system.

    Retrieve the response from the requests cache.
    If the cache has expired then it will attempt to update the cache.
    If it gets an error, it will use the cached response, if it exists.
    """

    if method is None:
        method = "POST" if json else "GET"

    try:
        return requests.request(
            method=method,
            url=url,
            headers=headers,
            json=json,
            files=files,
            data=data,
            timeout=2
        )
    except requests.exceptions.Timeout as exception_response:
        api_error_exception = ApiTimeoutError(
            'The request to {} took longer than 2 seconds'.format(url),
        )
        raise api_error_exception
