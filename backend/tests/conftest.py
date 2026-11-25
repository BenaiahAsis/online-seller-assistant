import pytest


@pytest.fixture(autouse=True)
def no_live_openai(monkeypatch):
    """Keep every test offline, even if a real key is set in the shell or .env."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
