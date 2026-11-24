"""
Centralized Groq AI service — the single AI provider for RhyMic.

Replaces the previous Gemini + legacy Groq Llama stack:
  * gemini-2.5-flash            -> REMOVED (Google dependency dropped)
  * llama-3.3-70b-versatile     -> REMOVED (Enterprise-only on Groq since Aug 2026)
  * llama-3.1-8b-instant        -> REMOVED (deprecated by Groq, shutdown 08/16/26)

Current production models on Groq's free/developer tier:
  * openai/gpt-oss-120b — flagship quality (default primary)
  * openai/gpt-oss-20b  — ~2x faster, cheap fallback

Model IDs can be overridden with GROQ_MODEL / GROQ_SMALL_MODEL env vars
if Groq rotates its lineup again.
"""

import json
import os
import requests

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# gpt-oss models are "reasoning-effort" aware; 'low' keeps responses fast and
# cheap for structured tasks like playlist generation and mood tagging.
REASONING_EFFORT = os.environ.get("GROQ_REASONING_EFFORT", "low")


def _api_key():
    """Read the key at call time so late .env loading is picked up."""
    return os.environ.get("GROQ_API_KEY", "")


def _primary_model():
    return os.environ.get("GROQ_MODEL", "openai/gpt-oss-120b")


def _small_model():
    return os.environ.get("GROQ_SMALL_MODEL", "openai/gpt-oss-20b")


def is_configured():
    return bool(_api_key())


class GroqError(Exception):
    """Raised when the Groq API call fails or returns unusable output."""


def _post_chat(payload, timeout=25):
    key = _api_key()
    if not key:
        raise GroqError("GROQ_API_KEY is not configured")

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": payload.get("model", _primary_model()),
        "messages": payload["messages"],
        "max_tokens": payload.get("max_tokens", 1024),
        "temperature": payload.get("temperature", 0.7),
        "reasoning_effort": payload.get("reasoning_effort", REASONING_EFFORT),
    }
    if payload.get("json_mode"):
        body["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(GROQ_API_URL, json=body, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        raise GroqError(f"Groq request failed: {e}") from e

    remaining = resp.headers.get("x-ratelimit-remaining-requests", "?")
    print(f"[AI] Groq {body['model']} — remaining request quota: {remaining}")

    if resp.status_code != 200:
        try:
            detail = resp.json().get("error", {}).get("message", "")[:200]
        except Exception:
            detail = resp.text[:200]
        raise GroqError(f"Groq HTTP {resp.status_code}: {detail}")

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as e:
        raise GroqError("Malformed Groq response") from e

    if not content or not content.strip():
        raise GroqError("Empty Groq response")
    return content


def chat(prompt, system=None, model=None, max_tokens=1024, temperature=0.7,
         timeout=25, reasoning_effort=None, json_mode=False):
    """Send a prompt and return the raw text completion."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "messages": messages,
        "model": model or _primary_model(),
        "max_tokens": max_tokens,
        "temperature": temperature,
        "timeout": timeout,
        "json_mode": json_mode,
    }
    if reasoning_effort:
        payload["reasoning_effort"] = reasoning_effort
    return _post_chat(payload)


def chat_json(prompt, system=None, model=None, max_tokens=1024,
              temperature=0.7, timeout=25, reasoning_effort=None,
              json_mode=True):
    """
    Send a prompt with JSON response mode and return the parsed object/array.
    Falls back to brace-extraction if the model wraps JSON in prose.
    """
    content = chat(
        prompt,
        system=system,
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        timeout=timeout,
        reasoning_effort=reasoning_effort,
        json_mode=json_mode,
    )

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Fallback: extract the outermost JSON object or array from the text
    import re
    match = re.search(r'[\[{].*[\]}]', content.replace("```json", "").replace("```", ""), re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise GroqError("Groq returned non-JSON content")


def extract_songs_array(parsed):
    """
    Normalizes a parsed Groq JSON reply into a list of {title, artist} dicts.
    Accepts either a bare JSON array or an object containing one.
    """
    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        for key in ("songs", "tracks", "recommendations", "results"):
            if isinstance(parsed.get(key), list):
                return parsed[key]
        # Last resort: first list value in the object
        for value in parsed.values():
            if isinstance(value, list):
                return value
    return []
