"""Fetch public HTTPS images without redirects, proxy routing, or DNS rebinding."""

import ipaddress
import socket
from urllib.parse import urlsplit

import certifi
import urllib3

MAX_IMAGE_BYTES = 20 * 1024 * 1024


def download_image_bytes(url, *, probe=False):
    if not isinstance(url, str) or any(ord(char) <= 32 or ord(char) == 127 for char in url):
        raise ValueError("Invalid image URL")
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.port not in (None, 443)):
        raise ValueError("Images must use public HTTPS on port 443 without credentials")
    hostname = parsed.hostname.encode("idna").decode("ascii")
    addresses = sorted({result[4][0] for result in socket.getaddrinfo(
        hostname, 443, type=socket.SOCK_STREAM
    )})
    if not addresses or any(
        not ipaddress.ip_address(ip).is_global or ipaddress.ip_address(ip).is_multicast
        for ip in addresses
    ):
        raise ValueError("Image host resolves to a non-public address")

    # Connect to the checked IP, not another DNS lookup. Retain the original
    # hostname for TLS SNI, certificate validation, and the HTTP Host header.
    pool = urllib3.HTTPSConnectionPool(
        addresses[0], port=443, server_hostname=hostname, assert_hostname=hostname,
        cert_reqs="CERT_REQUIRED", ca_certs=certifi.where(),
        timeout=urllib3.Timeout(connect=8, read=20), retries=False,
    )
    response = None
    try:
        path = parsed.path or "/"
        if parsed.query:
            path += "?" + parsed.query
        headers = {"Host": hostname, "Accept-Encoding": "identity"}
        if probe:
            headers["Range"] = "bytes=0-0"
        response = pool.urlopen("GET", path, headers=headers, redirect=False, preload_content=False)
        if response.status not in (200, 206):
            raise ValueError(f"Image request returned HTTP {response.status}; redirects are disabled")
        data = response.read(1 if probe else MAX_IMAGE_BYTES + 1, decode_content=False)
        if len(data) > MAX_IMAGE_BYTES:
            raise ValueError("Image exceeds the 20 MB download limit")
        return data
    finally:
        if response is not None:
            response.close()
        pool.close()
