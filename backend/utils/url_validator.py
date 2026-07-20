"""
URL Validation Utility for SSRF Prevention.

Validates URLs before fetching to prevent Server-Side Request Forgery (SSRF) attacks.
Blocks private/internal IP ranges and restricts allowed URL schemes.
"""

import socket
import ipaddress
from urllib.parse import urlparse

# Private/internal IP ranges that should never be fetched
PRIVATE_RANGES = [
    ipaddress.ip_network('127.0.0.0/8'),       # Loopback
    ipaddress.ip_network('10.0.0.0/8'),        # Private
    ipaddress.ip_network('172.16.0.0/12'),     # Private
    ipaddress.ip_network('192.168.0.0/16'),    # Private
    ipaddress.ip_network('169.254.0.0/16'),    # Link-local
    ipaddress.ip_network('::1'),               # IPv6 Loopback
    ipaddress.ip_network('fc00::/7'),          # IPv6 Unique local
    ipaddress.ip_network('fe80::/10'),         # IPv6 Link-local
]

ALLOWED_SCHEMES = {'http', 'https'}


def is_private_ip(ip_str):
    """Check if an IP address is in a private/internal range."""
    try:
        ip = ipaddress.ip_address(ip_str)
        for private_range in PRIVATE_RANGES:
            if ip in private_range:
                return True
        return False
    except ValueError:
        return True  # Invalid IPs are treated as private (block by default)


def validate_url(url):
    """
    Validate a URL before fetching.
    
    Returns:
        (is_valid: bool, error_message: str or None)
    
    Checks performed:
        1. URL scheme must be http or https
        2. Hostname must resolve to a public (non-private) IP address
    """
    if not url:
        return False, "URL is empty"

    # Parse the URL
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"

    # Check scheme
    if parsed.scheme not in ALLOWED_SCHEMES:
        return False, f"URL scheme '{parsed.scheme}' is not allowed. Only http and https are permitted."

    # Check hostname exists
    if not parsed.hostname:
        return False, "URL has no hostname"

    # Resolve hostname to IP address(es)
    try:
        ips = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        return False, f"Could not resolve hostname: {parsed.hostname}"

    # Check each resolved IP against private ranges
    for addr_info in ips:
        ip_str = addr_info[4][0]
        if is_private_ip(ip_str):
            return False, f"URL resolves to a private/internal IP address: {ip_str}"

    return True, None
