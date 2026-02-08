"""OpenAI-compatible tool definitions for the function-calling agent."""

from __future__ import annotations

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Compose and send a new email to a recipient.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {
                        "type": "string",
                        "description": "Recipient email address.",
                    },
                    "subject": {
                        "type": "string",
                        "description": "Email subject line.",
                    },
                    "body": {
                        "type": "string",
                        "description": "Email body text.",
                    },
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_emails",
            "description": "Search and fetch recent emails. Returns categorized emails from the user's inbox.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Gmail search query (e.g. 'in:inbox newer_than:7d', 'from:someone@example.com'). Defaults to recent inbox emails.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of emails to return. Defaults to 20.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_email_summary",
            "description": "Get a TLDR digest summary of the user's recent important emails with highlights.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_calendar_event",
            "description": "Create a new event on the user's Google Calendar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Event title.",
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Event start time. Accepts ISO 8601 (e.g. '2026-02-10T14:00:00Z') or natural language (e.g. 'tomorrow at 2pm').",
                    },
                    "end_time": {
                        "type": "string",
                        "description": "Event end time. Accepts ISO 8601 or natural language (e.g. 'tomorrow at 3pm').",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional event description.",
                    },
                    "location": {
                        "type": "string",
                        "description": "Optional event location.",
                    },
                },
                "required": ["summary", "start_time", "end_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_calendar_events",
            "description": "List upcoming calendar events in a time range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start of the time range. ISO 8601 or natural language (e.g. 'today', 'tomorrow'). Defaults to now.",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End of the time range. ISO 8601 or natural language (e.g. 'next Friday'). Defaults to 7 days from start.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum number of events to return. Defaults to 50.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_subscriptions",
            "description": "Detect recurring subscriptions and bills from the user's email history.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_todos",
            "description": "Get the user's to-do list including task text, completion status, priority, and source. Use this to check what tasks the user has, which are completed, and which are still pending.",
            "parameters": {
                "type": "object",
                "properties": {
                    "include_completed": {
                        "type": "boolean",
                        "description": "Whether to include completed todos. Defaults to true.",
                    },
                },
                "required": [],
            },
        },
    },
]

TOOL_NAMES: set[str] = {
    tool["function"]["name"] for tool in TOOL_DEFINITIONS
}
