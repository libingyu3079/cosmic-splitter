import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

import server  # noqa: E402


class ResolveLlmConfigTests(unittest.TestCase):
    def test_request_config_overrides_environment(self):
        payload = {
            "llmConfig": {
                "apiKey": "request-key",
                "baseUrl": "https://example.test/v1/chat/completions",
                "model": "request-model",
            }
        }

        with patch.dict(
            os.environ,
            {
                "COSMIC_LLM_API_KEY": "env-key",
                "COSMIC_LLM_BASE_URL": "https://env.test/v1/chat/completions",
                "COSMIC_LLM_MODEL": "env-model",
            },
            clear=False,
        ):
            config = server.resolve_llm_config(payload)

        self.assertEqual(config["api_key"], "request-key")
        self.assertEqual(config["base_url"], "https://example.test/v1/chat/completions")
        self.assertEqual(config["model"], "request-model")

    def test_environment_is_used_when_request_config_is_missing(self):
        with patch.dict(
            os.environ,
            {
                "COSMIC_LLM_API_KEY": "env-key",
                "COSMIC_LLM_BASE_URL": "https://env.test/v1/chat/completions",
                "COSMIC_LLM_MODEL": "env-model",
            },
            clear=False,
        ):
            config = server.resolve_llm_config({})

        self.assertEqual(config["api_key"], "env-key")
        self.assertEqual(config["base_url"], "https://env.test/v1/chat/completions")
        self.assertEqual(config["model"], "env-model")

    def test_base_url_without_chat_completions_is_normalized(self):
        config = server.resolve_llm_config(
            {
                "llmConfig": {
                    "apiKey": "request-key",
                    "baseUrl": "https://example.test/v1",
                    "model": "request-model",
                }
            }
        )

        self.assertEqual(config["base_url"], "https://example.test/v1/chat/completions")

    def test_connection_test_returns_preview(self):
        with patch.object(
            server,
            "post_chat_completion",
            return_value={
                "model": "deepseek-v4-pro",
                "choices": [
                    {"message": {"content": "OK"}},
                ],
            },
        ):
            result = server.test_chat_api(
                {
                    "llmConfig": {
                        "apiKey": "request-key",
                        "baseUrl": "https://api.deepseek.com",
                        "model": "deepseek-v4-pro",
                    }
                }
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["model"], "deepseek-v4-pro")
        self.assertEqual(result["baseUrl"], "https://api.deepseek.com/chat/completions")
        self.assertEqual(result["preview"], "OK")


if __name__ == "__main__":
    unittest.main()
