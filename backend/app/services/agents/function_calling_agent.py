"""Function-calling agent that uses OpenRouter/OpenAI tool calling."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.services.agents.base import call_llm_with_tools
from app.services.agents.tool_definitions import TOOL_DEFINITIONS
from app.services.agents.tool_executor import execute_tool

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = (
    "You are SaturdAI, a friendly and helpful personal assistant. "
    "You help users manage their email, calendar, and subscriptions.\n\n"
    "Current date and time: {current_datetime}\n\n"
    "You have access to tools for:\n"
    "- Sending emails\n"
    "- Searching and reading emails\n"
    "- Getting email summaries (TLDR)\n"
    "- Creating calendar events\n"
    "- Listing upcoming calendar events\n"
    "- Detecting subscriptions and bills\n\n"
    "Guidelines:\n"
    "- Use the tools when the user asks to perform an action or retrieve information.\n"
    "- For calendar events, always resolve relative dates (like 'tomorrow') to actual dates.\n"
    "- When creating events, if the user doesn't specify an end time, default to 1 hour after the start.\n"
    "- After executing a tool, summarize the result in a natural, conversational way.\n"
    "- Keep responses concise and helpful.\n"
    "- If you're unsure about something, ask the user for clarification rather than guessing."
)

VOICE_SYSTEM_PROMPT_TEMPLATE = (
    "You are SaturdAI, a friendly and concise voice assistant. "
    "The user is speaking to you through a voice interface.\n\n"
    "Current date and time: {current_datetime}\n\n"
    "You have access to tools for managing email, calendar, and subscriptions.\n\n"
    "Guidelines:\n"
    "- Keep responses brief (1-3 sentences) and conversational.\n"
    "- Do not use markdown, bullet points, or formatting since your response will be spoken aloud.\n"
    "- Be warm, helpful, and natural.\n"
    "- Use the tools when the user asks to perform an action."
)


@dataclass
class AgentResponse:
    response_text: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    conversation: list[dict[str, Any]] = field(default_factory=list)


async def run_agent(
    user_message: str,
    access_token: str,
    conversation_history: list[dict[str, Any]] | None = None,
    voice_mode: bool = False,
) -> AgentResponse:
    """Run the function-calling agent with the given user message.

    Returns an AgentResponse with the final text, tool call log, and updated conversation.
    """
    now = datetime.now(timezone.utc)
    current_datetime = now.strftime("%A, %B %d, %Y at %I:%M %p UTC")

    template = VOICE_SYSTEM_PROMPT_TEMPLATE if voice_mode else SYSTEM_PROMPT_TEMPLATE
    system_prompt = template.format(current_datetime=current_datetime)

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
    ]

    if conversation_history:
        trimmed_history = conversation_history[-20:]
        messages.extend(trimmed_history)

    messages.append({"role": "user", "content": user_message})

    async def bound_tool_executor(tool_name: str, arguments: dict) -> dict:
        return await execute_tool(tool_name, arguments, access_token)

    try:
        response_text, tool_call_log = await call_llm_with_tools(
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_executor=bound_tool_executor,
            max_tokens=1000,
        )
    except Exception:
        logger.exception("Function-calling agent failed")
        return AgentResponse(
            response_text="I'm sorry, I encountered an error processing your request. Please try again.",
            tool_calls=[],
            conversation=[],
        )

    updated_conversation = []
    if conversation_history:
        updated_conversation.extend(conversation_history[-20:])
    updated_conversation.append({"role": "user", "content": user_message})
    updated_conversation.append({"role": "assistant", "content": response_text})

    return AgentResponse(
        response_text=response_text,
        tool_calls=tool_call_log,
        conversation=updated_conversation,
    )
