"""Base utilities for agent implementations."""
from __future__ import annotations

import json
import logging
import time
from typing import Any, cast

import httpx

from app.core.env import load_settings

settings = load_settings()
logger = logging.getLogger(__name__)

# Evidence budget limits from spec
MAX_EVIDENCE_IDS_PER_STORY = 120
MAX_THREADS_FOR_DOSSIER = 50
MAX_MEETINGS_FOR_DOSSIER = 30
_OPENAI_TERMINAL_STATUSES = {"completed", "failed", "cancelled", "incomplete"}
# GPT-5 family models can spend a lot of tokens in reasoning before emitting any visible output.
# If max_output_tokens is too low, the Responses API can return status=incomplete with reason=max_output_tokens
# before any message output is produced.
# The original values were intentionally conservative but make small JSON tasks very slow.
# Use a smaller floor and a smaller retry ceiling; if a given account/model still returns
# incomplete, the targeted retry path below will kick in.
_GPT5_JSON_MIN_OUTPUT_TOKENS = 2500
_GPT5_JSON_RETRY_OUTPUT_TOKENS = 8000


def _is_gpt5_family_model(model: str) -> bool:
    normalized_model = model.strip().lower()
    return normalized_model.startswith("gpt-5")


def _extract_openai_text(payload: dict[str, Any]) -> str:
    error = payload.get("error")
    if error:
        raise ValueError(f"OpenAI error: {error}")

    status = payload.get("status")
    if isinstance(status, str) and status and status not in _OPENAI_TERMINAL_STATUSES:
        raise ValueError(f"OpenAI response not ready yet (status={status})")

    output = payload.get("output")
    if not isinstance(output, list):
        raise ValueError("OpenAI response missing 'output'")

    if len(output) == 0:
        incomplete_details = payload.get("incomplete_details")
        raise ValueError(
            "OpenAI response had empty output "
            f"(status={status}, error={error}, incomplete_details={incomplete_details}, payload_keys={sorted(payload.keys())})"
        )

    chunks: list[str] = []
    json_chunks: list[str] = []
    part_types: list[str] = []
    output_item_summaries: list[dict[str, Any]] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if len(output_item_summaries) < 3:
            output_item_summaries.append(
                {
                    "item_type": item.get("type"),
                    "item_keys": sorted(item.keys()),
                    "content_type": type(item.get("content")).__name__,
                }
            )
        content = item.get("content")
        if isinstance(content, str) and content.strip():
            chunks.append(content)
            continue

        content_parts: list[dict[str, Any]] = []
        if isinstance(content, list):
            content_parts = [part for part in content if isinstance(part, dict)]
        elif isinstance(content, dict):
            content_parts = [content]

        for part in content_parts:
            if not isinstance(part, dict):
                continue
            part_type = part.get("type")
            if isinstance(part_type, str):
                part_types.append(part_type)
            if part.get("type") == "output_text" and isinstance(part.get("text"), str):
                chunks.append(cast(str, part.get("text")))
            if part.get("type") == "output_text" and isinstance(part.get("text"), dict):
                text_value = part.get("text", {}).get("value")
                if isinstance(text_value, str):
                    chunks.append(text_value)
            if part.get("type") == "refusal" and isinstance(part.get("refusal"), str):
                chunks.append(cast(str, part.get("refusal")))
            if part.get("type") == "output_json" and isinstance(part.get("json"), (dict, list)):
                json_chunks.append(json.dumps(part.get("json")))

        if item.get("type") == "refusal" and isinstance(item.get("refusal"), str):
            chunks.append(cast(str, item.get("refusal")))
        if item.get("type") == "output_text" and isinstance(item.get("text"), str):
            chunks.append(cast(str, item.get("text")))
        if item.get("type") == "output_json" and isinstance(item.get("json"), (dict, list)):
            json_chunks.append(json.dumps(item.get("json")))

    text = "".join(chunks)
    if not text.strip():
        if json_chunks:
            return "".join(json_chunks)
        incomplete_details = payload.get("incomplete_details")
        raise ValueError(
            "OpenAI response did not contain text "
            f"(status={status}, incomplete_details={incomplete_details}, payload_keys={sorted(payload.keys())}, part_types={sorted(set(part_types))}, output_items={output_item_summaries})"
        )
    return text


def _poll_openai_response_until_terminal(
    *,
    client: httpx.Client,
    response_id: str,
    headers: dict[str, str],
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    started_at = time.monotonic()
    delay_seconds = 0.25

    while True:
        if time.monotonic() - started_at > timeout_seconds:
            raise TimeoutError(f"OpenAI response not ready after {timeout_seconds:.0f}s (id={response_id})")

        poll_response = client.get(
            f"https://api.openai.com/v1/responses/{response_id}",
            headers=headers,
        )
        poll_response.raise_for_status()
        payload = poll_response.json()

        status = payload.get("status")
        if isinstance(status, str) and status in _OPENAI_TERMINAL_STATUSES:
            return payload

        time.sleep(delay_seconds)
        delay_seconds = min(delay_seconds * 2, 2.0)

def _format_openai_http_error(response: httpx.Response) -> str:
    """Best-effort extraction of OpenAI error details."""
    try:
        body = response.json()
    except Exception:
        text = response.text
        return text[:2000] if text else "<no response body>"

    if not isinstance(body, dict):
        return str(body)[:2000]

    err = body.get("error")
    if isinstance(err, dict):
        message = err.get("message")
        type_ = err.get("type")
        code = err.get("code")
        param = err.get("param")
        parts = [p for p in [message, type_, code, param] if p]
        return " | ".join(str(p) for p in parts)[:2000]

    return str(body)[:2000]


def _call_openai_chat_completions(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    model: str,
    json_mode: bool,
) -> str:
    request_body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0,
    }

    if json_mode:
        request_body["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=request_body,
        )
        response.raise_for_status()
        payload = response.json()

    try:
        choice = payload["choices"][0]
        message = choice["message"]
        content = message["content"]
        if not isinstance(content, str):
            raise ValueError("Unexpected chat.completions content")
        return content
    except Exception as e:
        raise ValueError(f"Unexpected chat.completions payload: {payload}") from e


def _call_openai(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    model: str,
    json_mode: bool,
) -> str:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")

    if _is_gpt5_family_model(model):
        gpt5_max_output_tokens = max_tokens
        gpt5_reasoning_effort = settings.llm_reasoning_effort
        if json_mode:
            gpt5_max_output_tokens = max(
                gpt5_max_output_tokens, _GPT5_JSON_MIN_OUTPUT_TOKENS
            )
            # Encourage the model to emit JSON quickly rather than spending budget on reasoning.
            gpt5_reasoning_effort = "low"

        request_body: dict[str, Any] = {
            "model": model,
            "instructions": system_prompt,
            "input": user_prompt,
            "max_output_tokens": gpt5_max_output_tokens,
            "reasoning": {"effort": gpt5_reasoning_effort},
        }
    else:
        request_body = {
            "model": model,
            "input": [
                {
                    "role": "system",
                    "content": [{"type": "input_text", "text": system_prompt}],
                },
                {
                    "role": "user",
                    "content": [{"type": "input_text", "text": user_prompt}],
                },
            ],
            "max_output_tokens": max_tokens,
            "temperature": 0,
        }

    if json_mode:
        request_body["text"] = {"format": {"type": "json_object"}}

    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=60) as client:
        response = client.post(
            "https://api.openai.com/v1/responses",
            headers=headers,
            json=request_body,
        )

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            details = _format_openai_http_error(response)
            logger.warning(
                "OpenAI /v1/responses failed (%s) model=%s json_mode=%s request_keys=%s: %s",
                response.status_code,
                model,
                json_mode,
                sorted(request_body.keys()),
                details,
            )

            # Some environments/accounts reject the Responses schema/model.
            # Fall back to Chat Completions for local dev robustness.
            if response.status_code == 400:
                # GPT-5 family models are designed for the Responses API; falling back to
                # chat.completions produces confusing benchmark results and often 400s.
                if _is_gpt5_family_model(model):
                    raise RuntimeError(
                        f"OpenAI API error {response.status_code} calling /v1/responses: {details}"
                    ) from e

                return _call_openai_chat_completions(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_tokens=max_tokens,
                    model=model,
                    json_mode=json_mode,
                )

            raise RuntimeError(
                f"OpenAI API error {response.status_code} calling /v1/responses: {details}"
            ) from e

        payload = response.json()
        status = payload.get("status")
        if isinstance(status, str) and status and status not in _OPENAI_TERMINAL_STATUSES:
            response_id = payload.get("id")
            if isinstance(response_id, str) and response_id:
                payload = _poll_openai_response_until_terminal(
                    client=client,
                    response_id=response_id,
                    headers=headers,
                )

        try:
            return _extract_openai_text(payload)
        except ValueError as e:
            # Targeted retry for GPT-5 JSON: sometimes the response is terminal but contains
            # no output_text (e.g. status=incomplete reason=max_output_tokens).
            if (
                json_mode
                and _is_gpt5_family_model(model)
                and isinstance(payload.get("status"), str)
                and payload.get("status") == "incomplete"
                and isinstance(payload.get("incomplete_details"), dict)
                and payload.get("incomplete_details", {}).get("reason") == "max_output_tokens"
            ):
                retry_body = dict(request_body)
                retry_body["max_output_tokens"] = max(
                    int(retry_body.get("max_output_tokens") or 0),
                    _GPT5_JSON_RETRY_OUTPUT_TOKENS,
                )
                retry_body["reasoning"] = {"effort": "low"}

                retry_response = client.post(
                    "https://api.openai.com/v1/responses",
                    headers=headers,
                    json=retry_body,
                )
                retry_response.raise_for_status()
                retry_payload = retry_response.json()
                return _extract_openai_text(retry_payload)

            raise


def _call_openrouter(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    model: str,
    json_mode: bool,
) -> str:
    """Call OpenRouter API (OpenAI-compatible)."""
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    request_body: dict[str, Any] = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0,
    }

    if json_mode:
        request_body["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://sandbox.dynamis.dev",  # Optional: for OpenRouter analytics
        "X-Title": "Sandbox Demo",  # Optional: for OpenRouter analytics
    }

    with httpx.Client(timeout=120) as client:  # Longer timeout for slower models
        response = client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=request_body,
        )

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"OpenRouter API error: {response.status_code} - {response.text[:500]}")
            raise RuntimeError(f"OpenRouter API error {response.status_code}") from e

        payload = response.json()

    try:
        choice = payload["choices"][0]
        message = choice["message"]
        content = message["content"]
        if not isinstance(content, str):
            raise ValueError("Unexpected OpenRouter response content")
        return content
    except Exception as e:
        raise ValueError(f"Unexpected OpenRouter payload: {payload}") from e


def _call_llm_text(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int,
    model: str,
    json_mode: bool,
) -> str:
    provider = (settings.llm_provider or "openai").lower()

    if provider == "openai":
        return _call_openai(system_prompt, user_prompt, max_tokens, model, json_mode)

    if provider == "openrouter":
        return _call_openrouter(system_prompt, user_prompt, max_tokens, model, json_mode)

    raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")


def parse_json_response(content: str) -> dict[str, Any]:
    """Parse JSON from LLM response, handling markdown code blocks."""
    # Some models still wrap JSON in markdown fences; strip them defensively.
    if "```json" in content:
        content = content.split("```json", 1)[1].split("```", 1)[0]
    elif "```" in content:
        content = content.split("```", 1)[1].split("```", 1)[0]

    raw = content.strip()

    def extract_first_json_object(text: str) -> str | None:
        start_index = text.find("{")
        if start_index < 0:
            return None

        depth = 0
        in_string = False
        escape = False
        for index in range(start_index, len(text)):
            ch = text[index]
            if in_string:
                if escape:
                    escape = False
                    continue
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue
            if ch == "{":
                depth += 1
                continue
            if ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start_index : index + 1]

        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        extracted = extract_first_json_object(raw)
        if not extracted:
            raise
        parsed = json.loads(extracted)

    if not isinstance(parsed, dict):
        raise ValueError("Expected a JSON object")
    return parsed


def call_llm(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1000,
    model: str | None = None,
) -> str:
    """Make a call to the LLM and return the text response."""
    resolved_model = model or settings.llm_model
    return _call_llm_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=max_tokens,
        model=resolved_model,
        json_mode=False,
    )


def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 1000,
    model: str | None = None,
) -> dict[str, Any]:
    """Make a call to the LLM and parse JSON response."""
    resolved_model = model or settings.llm_model
    content = _call_llm_text(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=max_tokens,
        model=resolved_model,
        json_mode=True,
    )
    try:
        return parse_json_response(content)
    except Exception:
        # One retry with stronger formatting instructions (helps occasional broken JSON).
        retry_prompt = (
            user_prompt
            + "\n\nIMPORTANT: Output ONLY valid JSON. Do not include markdown fences. "
            + "Escape any quotes inside strings. Never include trailing commas."
        )
        retry_content = _call_llm_text(
            system_prompt=system_prompt,
            user_prompt=retry_prompt,
            max_tokens=max_tokens,
            model=resolved_model,
            json_mode=True,
        )
        return parse_json_response(retry_content)
