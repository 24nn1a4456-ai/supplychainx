"""
Supply Chain X - Agentic AI Crisis Manager
Configuration Module
Author: Member 1 (Agentic AI Engineer)

Reads configuration safely from environment variables with sensible defaults.
Enforces strict simulation-only execution guards to prevent accidental real-world side effects.
"""

import os
from functools import lru_cache
from typing import Optional
from pydantic import BaseModel, Field


class AgentConfig(BaseModel):
    """
    Central runtime configuration for the Agentic AI Crisis Manager.
    All properties are loaded from environment variables or safe defaults.
    """
    # Environment & Logging
    environment: str = Field(default_factory=lambda: os.getenv("APP_ENV", "development"))
    log_level: str = Field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    
    # Safety & Execution Rules
    simulation_only_mode: bool = Field(
        default_factory=lambda: os.getenv("SIMULATION_ONLY_MODE", "true").lower() in ("true", "1", "yes"),
        description="Strict safety guard: When True, prevents any real order creation or external writes"
    )
    mock_data_mode: bool = Field(
        default_factory=lambda: os.getenv("MOCK_DATA_MODE", "true").lower() in ("true", "1", "yes"),
        description="Isolated development mode using clearly labeled mock data"
    )

    # Autonomous Governance Thresholds
    autonomous_approval_cost_limit: float = Field(
        default_factory=lambda: float(os.getenv("AUTONOMOUS_APPROVAL_COST_LIMIT", "50000.0")),
        description="Dollar limit above which recovery plans MUST undergo human approval"
    )
    autonomous_max_lead_time_days: int = Field(
        default_factory=lambda: int(os.getenv("AUTONOMOUS_MAX_LEAD_TIME_DAYS", "14")),
        description="Lead-time threshold (days) above which recovery plans require human sign-off"
    )
    supplier_min_reliability_score: float = Field(
        default_factory=lambda: float(os.getenv("SUPPLIER_MIN_RELIABILITY_SCORE", "0.75")),
        description="Minimum vendor reliability score acceptable for automated plan generation"
    )

    # Upstream / Downstream Team Integrations
    # Member 2: Backend Database & Core API Services
    member_2_backend_url: str = Field(
        default_factory=lambda: os.getenv("MEMBER_2_BACKEND_URL", "http://localhost:8000/api/v1")
    )
    member_2_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("MEMBER_2_API_KEY", None)
    )

    # Member 4: Optimization Engine / Mathematical Solver
    member_4_optimizer_url: str = Field(
        default_factory=lambda: os.getenv("MEMBER_4_OPTIMIZER_URL", "http://localhost:8002/api/v1/optimize")
    )
    member_4_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("MEMBER_4_API_KEY", None)
    )

    # AI Reasoning Provider (Optional Gemini LLM key)
    gemini_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", None)
    )
    ai_model_name: str = Field(
        default_factory=lambda: os.getenv("AI_MODEL_NAME", "gemini-2.5-flash")
    )

    def is_autonomous_executable(self, total_cost: float, lead_time_days: int) -> bool:
        """Helper to check if plan figures qualify for zero-touch autonomous execution."""
        return (
            total_cost <= self.autonomous_approval_cost_limit
            and lead_time_days <= self.autonomous_max_lead_time_days
        )


@lru_cache(maxsize=1)
def get_agent_config() -> AgentConfig:
    """Return cached instance of AgentConfig."""
    return AgentConfig()
