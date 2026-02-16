#!/usr/bin/env python3
"""Scaffold a RAG or Memory module for an AI agent project.

Generates production-ready cognitive architecture components:
- RAG pipeline (ingestion + retrieval) with Azure AI Search or ChromaDB
- Memory system (short-term Redis + long-term CosmosDB)
- Configuration templates (.env, docker-compose for local deps)
- Unit tests with mocked vector store

Usage:
 python scaffold-cognitive.py --name my-agent --component rag
 python scaffold-cognitive.py --name my-agent --component memory
 python scaffold-cognitive.py --name my-agent --component all
 python scaffold-cognitive.py --name my-agent --component rag --vector-store chroma
"""

import argparse
import os
import sys
from pathlib import Path
from datetime import datetime

def create_file(path: Path, content: str) -> None:
 """Create a file with content, making parent directories as needed."""
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(content, encoding="utf-8")
 print(f" Created: {path}")

# ---------------------------------------------------------------------------
# RAG Pipeline
# ---------------------------------------------------------------------------

def _rag_config(name: str, vector_store: str) -> str:
 if vector_store == "azure-ai-search":
 return f'''"""RAG configuration for {name}."""

import os

# Azure AI Search
SEARCH_ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
SEARCH_API_KEY = os.environ.get("AZURE_SEARCH_API_KEY", "") # Use managed identity in prod
SEARCH_INDEX_NAME = os.environ.get("AZURE_SEARCH_INDEX", "{name.replace("-", "_")}_index")

# Azure OpenAI Embeddings
EMBEDDING_ENDPOINT = os.environ["FOUNDRY_ENDPOINT"]
EMBEDDING_API_KEY = os.environ.get("FOUNDRY_API_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSIONS = 1536

# Chunking
CHUNK_SIZE = 1024
CHUNK_OVERLAP = 100

# Retrieval
TOP_K = 5
USE_RERANKER = True
'''
 else: # chroma
 return f'''"""RAG configuration for {name}."""

import os

# ChromaDB (local development)
CHROMA_PERSIST_DIR = os.environ.get("CHROMA_PERSIST_DIR", "./.chroma_data")
CHROMA_COLLECTION = os.environ.get("CHROMA_COLLECTION", "{name.replace("-", "_")}")

# Embedding (Azure OpenAI or OpenAI)
EMBEDDING_ENDPOINT = os.environ.get("FOUNDRY_ENDPOINT", "")
EMBEDDING_API_KEY = os.environ.get("FOUNDRY_API_KEY", "")
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIMENSIONS = 1536

# Chunking
CHUNK_SIZE = 1024
CHUNK_OVERLAP = 100

# Retrieval
TOP_K = 5
USE_RERANKER = False
'''

def _rag_ingestion(name: str, vector_store: str) -> str:
 module = name.replace("-", "_")
 return f'''"""Document ingestion pipeline for {name}.

Chunks documents, generates embeddings, and upserts into vector store.
"""

from pathlib import Path
from typing import Any

from .config import CHUNK_SIZE, CHUNK_OVERLAP, EMBEDDING_MODEL, TOP_K

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
 """Split text into overlapping chunks.

 Uses a simple character-based splitter. For production,
 consider RecursiveCharacterTextSplitter from langchain or
 semantic chunking based on document structure.

 Args:
 text: Source text to chunk.
 chunk_size: Maximum characters per chunk.
 overlap: Number of overlapping characters between chunks.

 Returns:
 List of text chunks.
 """
 if not text:
 return [""]
 chunks: list[str] = []
 start = 0
 while start < len(text):
 end = start + chunk_size
 chunks.append(text[start:end])
 start += chunk_size - overlap
 return chunks

def load_documents(directory: str | Path) -> list[dict[str, Any]]:
 """Load text files from a directory for ingestion.

 Args:
 directory: Path to folder containing .txt or .md files.

 Returns:
 List of dicts with "content", "source", and "metadata" keys.
 """
 docs: list[dict[str, Any]] = []
 root = Path(directory)
 for filepath in root.rglob("*"):
 if filepath.suffix in (".txt", ".md", ".rst"):
 docs.append({{
 "content": filepath.read_text(encoding="utf-8"),
 "source": str(filepath.relative_to(root)),
 "metadata": {{"file_type": filepath.suffix}},
 }})
 return docs

async def ingest(directory: str | Path, *, embed_fn=None, store=None) -> int:
 """Run the full ingestion pipeline: load -> chunk -> embed -> upsert.

 Args:
 directory: Path to source documents.
 embed_fn: Async callable that takes list[str] and returns list[list[float]].
 store: Vector store client with an `upsert` method.

 Returns:
 Number of chunks ingested.
 """
 documents = load_documents(directory)
 total = 0

 for doc in documents:
 chunks = chunk_text(doc["content"])
 embeddings = await embed_fn(chunks)

 records = [
 {{
 "id": f"{{doc['source']}}_{{i}}",
 "content": chunk,
 "embedding": emb,
 "metadata": {{**doc["metadata"], "source": doc["source"]}},
 }}
 for i, (chunk, emb) in enumerate(zip(chunks, embeddings))
 ]

 await store.upsert(records)
 total += len(records)

 return total
'''

def _rag_retrieval(name: str) -> str:
 return f'''"""Retrieval module for {name}.

Performs hybrid search (vector + keyword) with optional reranking.
"""

from typing import Any

from .config import TOP_K, USE_RERANKER

async def search(
 query: str,
 *,
 embed_fn=None,
 store=None,
 top_k: int = TOP_K,
) -> list[dict[str, Any]]:
 """Retrieve relevant documents for a query.

 Args:
 query: User question or search text.
 embed_fn: Async callable to embed the query.
 store: Vector store client with a `search` method.
 top_k: Number of results to return.

 Returns:
 List of matching documents with content and metadata.
 """
 query_embedding = (await embed_fn([query]))[0]

 results = await store.search(
 embedding=query_embedding,
 top_k=top_k * 2 if USE_RERANKER else top_k,
 )

 if USE_RERANKER:
 results = _rerank(query, results, top_k)

 return results[:top_k]

def _rerank(query: str, results: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
 """Placeholder reranker using simple keyword overlap scoring.

 Replace with Azure AI Search Semantic Ranker or Cohere Rerank
 for production use.
 """
 query_terms = set(query.lower().split())
 for r in results:
 content_terms = set(r.get("content", "").lower().split())
 r["rerank_score"] = len(query_terms & content_terms) / max(len(query_terms), 1)

 results.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
 return results[:top_k]

def build_context(results: list[dict[str, Any]], max_tokens: int = 3000) -> str:
 """Combine search results into a prompt-ready context string.

 Args:
 results: Retrieved documents from search.
 max_tokens: Approximate max character budget (rough 4 chars/token).

 Returns:
 Formatted context string for LLM prompt injection.
 """
 context_parts: list[str] = []
 budget = max_tokens * 4 # rough char estimate

 for r in results:
 content = r.get("content", "")
 source = r.get("metadata", {{}}).get("source", "unknown")
 entry = f"[Source: {{source}}]\\n{{content}}"
 if len("\\n\\n".join(context_parts + [entry])) > budget:
 break
 context_parts.append(entry)

 return "\\n\\n".join(context_parts)
'''

def _rag_tests(name: str) -> str:
 module = name.replace("-", "_")
 return f'''"""Tests for RAG pipeline components."""

import pytest
from {module}.rag.ingestion import chunk_text, load_documents

class TestChunking:
 """Test the text chunking function."""

 def test_chunk_basic(self):
 text = "a" * 2048
 chunks = chunk_text(text, chunk_size=1024, overlap=100)
 assert len(chunks) >= 2
 assert all(len(c) <= 1024 for c in chunks)

 def test_chunk_overlap(self):
 text = "abcdefghij" * 20 # 200 chars
 chunks = chunk_text(text, chunk_size=50, overlap=10)
 # Verify overlap: end of chunk N should appear at start of chunk N+1
 if len(chunks) >= 2:
 assert chunks[0][-10:] == chunks[1][:10]

 def test_chunk_small_text(self):
 text = "Hello world"
 chunks = chunk_text(text, chunk_size=1024, overlap=100)
 assert len(chunks) == 1
 assert chunks[0] == text

 def test_chunk_empty(self):
 chunks = chunk_text("", chunk_size=1024, overlap=100)
 assert chunks == [""]
'''

# ---------------------------------------------------------------------------
# Memory System
# ---------------------------------------------------------------------------

def _memory_manager(name: str) -> str:
 return f'''"""Memory management for {name}.

Provides short-term (session) and long-term (entity) memory
with configurable backends.
"""

import os
import json
import time
from typing import Any
from pathlib import Path

class ShortTermMemory:
 """Conversation history with sliding window + summarization.

 For production, replace file-based storage with Redis:
 import redis.asyncio as redis
 self.client = redis.from_url(os.environ["REDIS_URL"])
 """

 def __init__(self, session_id: str, max_messages: int = 20):
 self.session_id = session_id
 self.max_messages = max_messages
 self._messages: list[dict[str, str]] = []
 self._summary: str = ""

 def add(self, role: str, content: str) -> None:
 """Add a message to conversation history."""
 self._messages.append({{"role": role, "content": content, "ts": time.time()}})

 # Sliding window: summarize oldest messages when limit exceeded
 if len(self._messages) > self.max_messages:
 self._compact()

 def get_messages(self) -> list[dict[str, str]]:
 """Return current conversation history with optional summary prefix."""
 result: list[dict[str, str]] = []
 if self._summary:
 result.append({{"role": "system", "content": f"Previous conversation summary: {{self._summary}}"}})
 result.extend({{"role": m["role"], "content": m["content"]}} for m in self._messages)
 return result

 def _compact(self) -> None:
 """Summarize oldest half of messages to free context window budget."""
 midpoint = len(self._messages) // 2
 old_msgs = self._messages[:midpoint]
 self._messages = self._messages[midpoint:]

 # Simple concatenation - replace with LLM summarization in production
 old_text = " | ".join(f"{{m['role']}}: {{m['content'][:100]}}" for m in old_msgs)
 self._summary = f"{{self._summary}} {{old_text}}".strip()

 def clear(self) -> None:
 """Reset conversation state."""
 self._messages.clear()
 self._summary = ""

class LongTermMemory:
 """Entity store for user facts and preferences.

 For production, replace with CosmosDB NoSQL:
 from azure.cosmos.aio import CosmosClient
 """

 def __init__(self, user_id: str, persist_dir: str = ".memory"):
 self.user_id = user_id
 self._path = Path(persist_dir) / f"{{user_id}}.json"
 self._data: dict[str, Any] = self._load()

 def _load(self) -> dict[str, Any]:
 if self._path.exists():
 return json.loads(self._path.read_text(encoding="utf-8"))
 return {{"user_id": self.user_id, "facts": [], "preferences": {{}}}}

 def _save(self) -> None:
 self._path.parent.mkdir(parents=True, exist_ok=True)
 self._path.write_text(json.dumps(self._data, indent=2), encoding="utf-8")

 def add_fact(self, key: str, value: str, confidence: float = 1.0) -> None:
 """Upsert a fact about the user."""
 facts = self._data["facts"]
 for f in facts:
 if f["key"] == key:
 f["value"] = value
 f["confidence"] = confidence
 self._save()
 return
 facts.append({{"key": key, "value": value, "confidence": confidence}})
 self._save()

 def get_fact(self, key: str) -> str | None:
 """Retrieve a fact by key."""
 for f in self._data["facts"]:
 if f["key"] == key:
 return f["value"]
 return None

 def get_all_facts(self) -> list[dict[str, Any]]:
 """Return all known facts."""
 return self._data["facts"]

 def set_preference(self, key: str, value: Any) -> None:
 """Set a user preference."""
 self._data["preferences"][key] = value
 self._save()

 def get_preferences(self) -> dict[str, Any]:
 """Return all preferences."""
 return self._data["preferences"]

class MemoryManager:
 """Unified facade for short-term and long-term memory."""

 def __init__(self, session_id: str, user_id: str):
 self.short_term = ShortTermMemory(session_id)
 self.long_term = LongTermMemory(user_id)

 def add_interaction(self, user_msg: str, ai_msg: str) -> None:
 """Record a conversation turn."""
 self.short_term.add("user", user_msg)
 self.short_term.add("assistant", ai_msg)

 def get_context(self) -> dict[str, Any]:
 """Build combined context for LLM prompt."""
 return {{
 "messages": self.short_term.get_messages(),
 "user_facts": self.long_term.get_all_facts(),
 "preferences": self.long_term.get_preferences(),
 }}
'''

def _memory_tests(name: str) -> str:
 module = name.replace("-", "_")
 return f'''"""Tests for Memory system components."""

import pytest
from {module}.memory.manager import ShortTermMemory, LongTermMemory, MemoryManager

class TestShortTermMemory:
 """Test conversation history management."""

 def test_add_and_retrieve(self):
 mem = ShortTermMemory("sess_1", max_messages=10)
 mem.add("user", "Hello")
 mem.add("assistant", "Hi there!")
 msgs = mem.get_messages()
 assert len(msgs) == 2
 assert msgs[0]["role"] == "user"

 def test_sliding_window(self):
 mem = ShortTermMemory("sess_2", max_messages=4)
 for i in range(6):
 mem.add("user", f"Message {{i}}")
 msgs = mem.get_messages()
 # Should have summary + remaining messages
 assert any("summary" in m.get("content", "").lower() for m in msgs if m["role"] == "system")

 def test_clear(self):
 mem = ShortTermMemory("sess_3")
 mem.add("user", "test")
 mem.clear()
 assert mem.get_messages() == []

class TestLongTermMemory:
 """Test entity store."""

 def test_add_and_get_fact(self, tmp_path):
 mem = LongTermMemory("user_1", persist_dir=str(tmp_path))
 mem.add_fact("language", "python", confidence=0.9)
 assert mem.get_fact("language") == "python"

 def test_upsert_fact(self, tmp_path):
 mem = LongTermMemory("user_2", persist_dir=str(tmp_path))
 mem.add_fact("cloud", "aws")
 mem.add_fact("cloud", "azure")
 assert mem.get_fact("cloud") == "azure"
 assert len(mem.get_all_facts()) == 1

 def test_preferences(self, tmp_path):
 mem = LongTermMemory("user_3", persist_dir=str(tmp_path))
 mem.set_preference("tone", "concise")
 assert mem.get_preferences()["tone"] == "concise"

class TestMemoryManager:
 """Test unified memory facade."""

 def test_interaction(self, tmp_path):
 mgr = MemoryManager("sess_1", "user_1")
 mgr.long_term._path = tmp_path / "user_1.json"
 mgr.add_interaction("What is Azure?", "Azure is a cloud platform.")
 ctx = mgr.get_context()
 assert len(ctx["messages"]) == 2
'''

# ---------------------------------------------------------------------------
# Shared files
# ---------------------------------------------------------------------------

def _env_template(name: str, component: str, vector_store: str) -> str:
 lines = [
 "# Cognitive Architecture Environment Variables",
 "# Copy to .env and fill in values",
 "",
 "# Azure OpenAI (Embeddings + LLM)",
 "FOUNDRY_ENDPOINT=https://your-project.services.ai.azure.com",
 "FOUNDRY_API_KEY=your-api-key-here",
 f"EMBEDDING_MODEL=text-embedding-3-small",
 "",
 ]

 if component in ("rag", "all"):
 if vector_store == "azure-ai-search":
 lines += [
 "# Azure AI Search",
 "AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net",
 "AZURE_SEARCH_API_KEY=your-search-key",
 f"AZURE_SEARCH_INDEX={name.replace('-', '_')}_index",
 "",
 ]
 else:
 lines += [
 "# ChromaDB (local development)",
 f"CHROMA_PERSIST_DIR=./.chroma_data",
 f"CHROMA_COLLECTION={name.replace('-', '_')}",
 "",
 ]

 if component in ("memory", "all"):
 lines += [
 "# Redis (short-term memory) - optional, uses in-memory by default",
 "# REDIS_URL=redis://localhost:6379/0",
 "",
 "# CosmosDB (long-term memory) - optional, uses file-based by default",
 "# COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com",
 "# COSMOS_KEY=your-cosmos-key",
 f"# COSMOS_DATABASE={name.replace('-', '_')}_db",
 "",
 ]

 return "\n".join(lines) + "\n"

def _docker_compose(name: str, component: str, vector_store: str) -> str:
 services: list[str] = []

 if component in ("rag", "all") and vector_store == "chroma":
 services.append(""" chroma:
 image: chromadb/chroma:latest
 ports:
 - "8000:8000"
 volumes:
 - chroma_data:/chroma/chroma""")

 if component in ("memory", "all"):
 services.append(""" redis:
 image: redis:7-alpine
 ports:
 - "6379:6379"
 volumes:
 - redis_data:/data""")

 if not services:
 return ""

 volumes: list[str] = []
 if "chroma_data" in "\n".join(services):
 volumes.append(" chroma_data:")
 if "redis_data" in "\n".join(services):
 volumes.append(" redis_data:")

 return f"""# Local development dependencies for {name}
# Run: docker compose up -d

services:
{chr(10).join(services)}

volumes:
{chr(10).join(volumes)}
"""

# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def scaffold(name: str, component: str, vector_store: str) -> None:
 """Generate cognitive architecture module."""
 root = Path(name)
 module = name.replace("-", "_")

 if root.exists():
 print(f"Error: Directory '{name}' already exists.", file=sys.stderr)
 sys.exit(1)

 print(f"\nScaffolding cognitive architecture for '{name}'")
 print(f" Component: {component}")
 print(f" Vector store: {vector_store}")
 print(f" Output: ./{name}/\n")

 # Shared files
 create_file(root / ".env.template", _env_template(name, component, vector_store))

 compose = _docker_compose(name, component, vector_store)
 if compose:
 create_file(root / "docker-compose.yml", compose)

 # RAG module
 if component in ("rag", "all"):
 create_file(root / "src" / module / "rag" / "__init__.py", "")
 create_file(root / "src" / module / "rag" / "config.py", _rag_config(name, vector_store))
 create_file(root / "src" / module / "rag" / "ingestion.py", _rag_ingestion(name, vector_store))
 create_file(root / "src" / module / "rag" / "retrieval.py", _rag_retrieval(name))
 create_file(root / "tests" / "test_rag.py", _rag_tests(name))

 # Memory module
 if component in ("memory", "all"):
 create_file(root / "src" / module / "memory" / "__init__.py", "")
 create_file(root / "src" / module / "memory" / "manager.py", _memory_manager(name))
 create_file(root / "tests" / "test_memory.py", _memory_tests(name))

 # Summary
 files_created = sum(1 for _ in root.rglob("*") if _.is_file())
 print(f"\n[OK] Scaffolded {files_created} files in ./{name}/")
 print(f"\nNext steps:")
 print(f" 1. cp {name}/.env.template {name}/.env (fill in keys)")
 if compose:
 print(f" 2. cd {name} && docker compose up -d (start local deps)")
 print(f" 3. Integrate with your agent (import {module}.rag or {module}.memory)")
 print()

def main() -> None:
 parser = argparse.ArgumentParser(
 description="Scaffold RAG and Memory modules for AI agents.",
 formatter_class=argparse.RawDescriptionHelpFormatter,
 epilog="""Examples:
 python scaffold-cognitive.py --name my-agent --component rag
 python scaffold-cognitive.py --name my-agent --component memory
 python scaffold-cognitive.py --name my-agent --component all --vector-store azure-ai-search
""",
 )
 parser.add_argument("--name", required=True, help="Project name (kebab-case)")
 parser.add_argument(
 "--component",
 choices=["rag", "memory", "all"],
 default="all",
 help="Which cognitive component to scaffold (default: all)",
 )
 parser.add_argument(
 "--vector-store",
 choices=["azure-ai-search", "chroma"],
 default="chroma",
 help="Vector store backend (default: chroma for local dev)",
 )

 args = parser.parse_args()
 scaffold(args.name, args.component, args.vector_store)

if __name__ == "__main__":
 main()
