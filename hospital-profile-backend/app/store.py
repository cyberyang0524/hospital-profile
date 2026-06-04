"""
Storage abstraction layer – pluggable backend for profiles & memories.

Supported backends (selected via STORAGE_TYPE env var):

  json     – file-based JSON (the original lightweight option, no extra deps)
  sqlite   – local SQLite database (zero-config, works on all platforms)
  postgres – PostgreSQL database (via STORAGE_DATABASE_URL)

Set STORAGE_TYPE before starting the server. If the variable is absent the
backend falls back to JSON.
"""
from __future__ import annotations

import abc
import json
import os
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from .schemas import MemoryInfo, PatientProfile, TagInfo


# --------------------------------------------------------------------------- #
# Abstract base                                                                 #
# --------------------------------------------------------------------------- #

class BaseStore(abc.ABC):
    """Interface that every store implementation must satisfy."""

    # ---- profile ----
    @abc.abstractmethod
    def get_profile(self, user_id: str) -> Optional[PatientProfile]: ...

    @abc.abstractmethod
    def get_or_create_profile(self, user_id: str) -> PatientProfile: ...

    @abc.abstractmethod
    def update_profile(
        self,
        user_id: str,
        tags: List[TagInfo],
        source_conversation_id: Optional[str] = None,
    ) -> PatientProfile: ...

    @abc.abstractmethod
    def delete_tag(self, user_id: str, tag_id: str) -> bool: ...

    @abc.abstractmethod
    def get_tags(self, user_id: str, category: Optional[str] = None) -> List[TagInfo]: ...

    # ---- memories ----
    @abc.abstractmethod
    def add_memory(
        self,
        user_id: str,
        content: str,
        category: Optional[str] = None,
        importance: float = 0.5,
    ) -> MemoryInfo: ...

    @abc.abstractmethod
    def get_memories(self, user_id: str) -> List[MemoryInfo]: ...

    # ---- helpers ----
    @abc.abstractmethod
    def find_similar_patients(self, user_id: str, limit: int = 5) -> List[Dict]: ...

    @abc.abstractmethod
    def list_user_ids(self) -> List[str]: ...

    @abc.abstractmethod
    def list_all_profiles(self) -> Dict[str, PatientProfile]: ...


    @abc.abstractmethod
    def list_all_memories(self) -> Dict[str, List[MemoryInfo]]: ...


    @classmethod
    def from_env(cls) -> "BaseStore":
        storage_type = os.getenv("STORAGE_TYPE", "json").lower()
        if storage_type == "sqlite":
            return SQLiteStore(path=os.getenv("STORAGE_SQLITE_PATH", "./data/profiles.db"))
        elif storage_type == "postgres":
            return PostgresStore(database_url=os.getenv("STORAGE_DATABASE_URL", ""))
        else:
            return JsonStore(path=os.getenv("DATA_PATH", "./data/profiles.json"))


# --------------------------------------------------------------------------- #
# JSON store (legacy)                                                          #
# --------------------------------------------------------------------------- #

class JsonStore(BaseStore):
    """
    File-backed JSON store – identical behaviour to the original ProfileStore.
    Kept for backwards compatibility and when no Python db drivers are available.
    """

    def __init__(self, path: Optional[str] = None) -> None:
        self._lock = threading.RLock()
        self._path = path
        self._profiles: Dict[str, PatientProfile] = {}
        self._memories: Dict[str, List[MemoryInfo]] = {}
        if path and os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for pid, prof in data.get("profiles", {}).items():
                    self._profiles[pid] = PatientProfile.model_validate(prof)
                for pid, mems in data.get("memories", {}).items():
                    self._memories[pid] = [MemoryInfo.model_validate(m) for m in mems]
            except Exception:
                if path and os.path.exists(path):
                    try:
                        os.rename(path, path + ".bak")
                    except OSError:
                        pass

    def _persist(self) -> None:
        if not self._path:
            return
        tmp = self._path + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "profiles": {
                            pid: p.model_dump() for pid, p in self._profiles.items()
                        },
                        "memories": {
                            pid: [m.model_dump() for m in mems]
                            for pid, mems in self._memories.items()
                        },
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            os.replace(tmp, self._path)
        except Exception:
            pass

    # ---- profile ----
    def get_profile(self, user_id: str) -> Optional[PatientProfile]:
        with self._lock:
            return self._profiles.get(user_id)

    def get_or_create_profile(self, user_id: str) -> PatientProfile:
        with self._lock:
            prof = self._profiles.get(user_id)
            if prof is None:
                prof = PatientProfile(userId=user_id, profileVersion=0, tags=[], tagsByCategory={})
                self._profiles[user_id] = prof
            return prof

    def update_profile(
        self,
        user_id: str,
        tags: List[TagInfo],
        source_conversation_id: Optional[str] = None,
    ) -> PatientProfile:
        with self._lock:
            prof = self.get_or_create_profile(user_id)
            now = datetime.utcnow().isoformat() + "Z"
            existing: Dict[tuple, TagInfo] = {(t.tagCategory, t.tagName): t for t in prof.tags}
            for t in tags:
                key = (t.tagCategory, t.tagName)
                t.id = t.id or str(uuid.uuid4())
                t.updatedAt = now
                existing[key] = t
            prof.tags = list(existing.values())
            prof.tagsByCategory = {}
            for t in prof.tags:
                prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
            prof.profileVersion = (prof.profileVersion or 0) + 1
            prof.lastInteraction = now
            prof.updatedAt = now
            self._persist()
            return prof

    def delete_tag(self, user_id: str, tag_id: str) -> bool:
        with self._lock:
            prof = self._profiles.get(user_id)
            if not prof:
                return False
            new_tags = [t for t in prof.tags if t.id != tag_id]
            if len(new_tags) == len(prof.tags):
                return False
            prof.tags = new_tags
            prof.tagsByCategory = {}
            for t in prof.tags:
                prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
            prof.profileVersion = (prof.profileVersion or 0) + 1
            prof.updatedAt = datetime.utcnow().isoformat() + "Z"
            self._persist()
            return True

    def get_tags(self, user_id: str, category: Optional[str] = None) -> List[TagInfo]:
        with self._lock:
            prof = self._profiles.get(user_id)
            if not prof:
                return []
            if category:
                return list(prof.tagsByCategory.get(category, []))
            return list(prof.tags)

    # ---- memories ----
    def add_memory(
        self,
        user_id: str,
        content: str,
        category: Optional[str] = None,
        importance: float = 0.5,
    ) -> MemoryInfo:
        with self._lock:
            mem = MemoryInfo(
                memoryId=str(uuid.uuid4()),
                content=content,
                category=category,
                importance=importance,
                createdAt=datetime.utcnow().isoformat() + "Z",
            )
            self._memories.setdefault(user_id, []).append(mem)
            if len(self._memories[user_id]) > 200:
                self._memories[user_id] = self._memories[user_id][-200:]
            self._persist()
            return mem

    def get_memories(self, user_id: str) -> List[MemoryInfo]:
        with self._lock:
            return list(self._memories.get(user_id, []))

    # ---- helpers ----
    def find_similar_patients(self, user_id: str, limit: int = 5) -> List[Dict]:
        with self._lock:
            target = self._profiles.get(user_id)
            if not target:
                return []
            target_keys = {(t.tagCategory, t.tagName) for t in target.tags}
            if not target_keys:
                return []
            results: List[Dict] = []
            for pid, prof in self._profiles.items():
                if pid == user_id:
                    continue
                other_keys = {(t.tagCategory, t.tagName) for t in prof.tags}
                common = target_keys & other_keys
                if not common:
                    continue
                score = len(common) / max(len(target_keys), 1)
                results.append({
                    "patientId": pid,
                    "similarityScore": round(score, 4),
                    "commonTags": [f"{c}/{n}" for (c, n) in sorted(common)],
                })
            results.sort(key=lambda r: r["similarityScore"], reverse=True)
            return results[:limit]

    def list_user_ids(self) -> List[str]:
        with self._lock:
            return list(self._profiles.keys())

    def list_all_profiles(self) -> Dict[str, PatientProfile]:
        with self._lock:
            return dict(self._profiles)

    def list_all_memories(self) -> Dict[str, List[MemoryInfo]]:
        with self._lock:
            return {pid: list(mems) for pid, mems in self._memories.items()}


# --------------------------------------------------------------------------- #
# Tag-categories config (stored alongside profile data, storage-type agnostic)   #
# --------------------------------------------------------------------------- #

import threading

from .schemas_tag import TagCategoriesConfig, TagCategoryItem

_TAG_CONFIG_PATH = os.getenv("TAG_CONFIG_PATH", "./data/tag_categories.json")
_tag_config_lock = threading.RLock()
_tag_config_cache: TagCategoriesConfig | None = None


def load_tag_config() -> TagCategoriesConfig:
    global _tag_config_cache
    with _tag_config_lock:
        if _tag_config_cache is not None:
            return _tag_config_cache
        if os.path.exists(_TAG_CONFIG_PATH):
            try:
                with open(_TAG_CONFIG_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cfg = TagCategoriesConfig.model_validate(data)
                if cfg.categories:
                    _tag_config_cache = cfg
                    return _tag_config_cache
            except Exception:
                pass
        _tag_config_cache = TagCategoriesConfig.default()
        save_tag_config(_tag_config_cache)
        return _tag_config_cache


def save_tag_config(cfg: TagCategoriesConfig) -> TagCategoriesConfig:
    global _tag_config_cache
    os.makedirs(os.path.dirname(_TAG_CONFIG_PATH) or ".", exist_ok=True)
    tmp = _TAG_CONFIG_PATH + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(cfg.model_dump(), f, ensure_ascii=False, indent=2)
        os.replace(tmp, _TAG_CONFIG_PATH)
    except Exception:
        pass
    with _tag_config_lock:
        _tag_config_cache = cfg
    return cfg


def get_tag_config() -> TagCategoriesConfig:
    return load_tag_config()


def update_tag_categories(categories: dict[str, TagCategoryItem]) -> TagCategoriesConfig:
    cfg = load_tag_config()
    cfg.categories = categories
    return save_tag_config(cfg)

import sqlite3
from contextlib import contextmanager


class SQLiteStore(BaseStore):
    """
    SQLite-backed store – zero-config, portable, no external server needed.
    All data lives in a local .db file. Thread-safe via shared cache.
    """

    def __init__(self, path: str = "./data/profiles.db") -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS profiles (
                user_id TEXT PRIMARY KEY,
                profile_json TEXT NOT NULL,
                last_interaction TEXT
            );
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT,
                importance REAL DEFAULT 0.5,
                created_at TEXT NOT NULL,
                last_accessed TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
        """)
        self._conn.commit()

    @contextmanager
    def _cur(self):
        cur = self._conn.cursor()
        try:
            yield cur
        finally:
            cur.close()

    def _row_to_profile(self, row: sqlite3.Row) -> PatientProfile:
        return PatientProfile.model_validate_json(row["profile_json"])

    # ---- profile ----
    def get_profile(self, user_id: str) -> Optional[PatientProfile]:
        with self._cur() as cur:
            cur.execute("SELECT * FROM profiles WHERE user_id = ?", (user_id,))
            row = cur.fetchone()
            if row is None:
                return None
            return self._row_to_profile(row)

    def get_or_create_profile(self, user_id: str) -> PatientProfile:
        prof = self.get_profile(user_id)
        if prof is None:
            prof = PatientProfile(userId=user_id, profileVersion=0, tags=[], tagsByCategory={})
        return prof

    def update_profile(
        self,
        user_id: str,
        tags: List[TagInfo],
        source_conversation_id: Optional[str] = None,
    ) -> PatientProfile:
        now = datetime.utcnow().isoformat() + "Z"
        prof = self.get_or_create_profile(user_id)
        existing: Dict[tuple, TagInfo] = {(t.tagCategory, t.tagName): t for t in prof.tags}
        for t in tags:
            key = (t.tagCategory, t.tagName)
            t.id = t.id or str(uuid.uuid4())
            t.updatedAt = now
            existing[key] = t
        prof.tags = list(existing.values())
        prof.tagsByCategory = {}
        for t in prof.tags:
            prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
        prof.profileVersion = (prof.profileVersion or 0) + 1
        prof.lastInteraction = now
        prof.updatedAt = now
        with self._cur() as cur:
            cur.execute(
                """
                INSERT INTO profiles (user_id, profile_json, last_interaction)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    profile_json = excluded.profile_json,
                    last_interaction = excluded.last_interaction
                """,
                (user_id, prof.model_dump_json(), now),
            )
            self._conn.commit()
        return prof

    def delete_tag(self, user_id: str, tag_id: str) -> bool:
        prof = self.get_profile(user_id)
        if not prof:
            return False
        new_tags = [t for t in prof.tags if t.id != tag_id]
        if len(new_tags) == len(prof.tags):
            return False
        prof.tags = new_tags
        prof.tagsByCategory = {}
        for t in prof.tags:
            prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
        prof.profileVersion = (prof.profileVersion or 0) + 1
        prof.updatedAt = datetime.utcnow().isoformat() + "Z"
        now = datetime.utcnow().isoformat() + "Z"
        with self._cur() as cur:
            cur.execute(
                "UPDATE profiles SET profile_json = ?, last_interaction = ? WHERE user_id = ?",
                (prof.model_dump_json(), now, user_id),
            )
            self._conn.commit()
        return True

    def get_tags(self, user_id: str, category: Optional[str] = None) -> List[TagInfo]:
        prof = self.get_profile(user_id)
        if not prof:
            return []
        if category:
            return list(prof.tagsByCategory.get(category, []))
        return list(prof.tags)

    # ---- memories ----
    def add_memory(
        self,
        user_id: str,
        content: str,
        category: Optional[str] = None,
        importance: float = 0.5,
    ) -> MemoryInfo:
        now = datetime.utcnow().isoformat() + "Z"
        mem = MemoryInfo(
            memoryId=str(uuid.uuid4()),
            content=content,
            category=category,
            importance=importance,
            createdAt=now,
        )
        with self._cur() as cur:
            cur.execute(
                "INSERT INTO memories (id, user_id, content, category, importance, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (mem.memoryId, user_id, content, category, importance, now),
            )
            self._conn.commit()
        return mem

    def get_memories(self, user_id: str) -> List[MemoryInfo]:
        with self._cur() as cur:
            cur.execute(
                "SELECT * FROM memories WHERE user_id = ? ORDER BY created_at ASC",
                (user_id,),
            )
            return [
                MemoryInfo(
                    memoryId=row["id"],
                    content=row["content"],
                    category=row["category"],
                    importance=row["importance"],
                    createdAt=row["created_at"],
                    lastAccessed=row["last_accessed"],
                )
                for row in cur.fetchall()
            ]

    # ---- helpers ----
    def find_similar_patients(self, user_id: str, limit: int = 5) -> List[Dict]:
        target = self.get_profile(user_id)
        if not target:
            return []
        target_keys = {(t.tagCategory, t.tagName) for t in target.tags}
        if not target_keys:
            return []
        results: List[Dict] = []
        with self._cur() as cur:
            cur.execute("SELECT profile_json FROM profiles WHERE user_id != ?", (user_id,))
            for row in cur.fetchall():
                other = self._row_to_profile(row)
                other_keys = {(t.tagCategory, t.tagName) for t in other.tags}
                common = target_keys & other_keys
                if not common:
                    continue
                score = len(common) / max(len(target_keys), 1)
                results.append({
                    "patientId": other.userId,
                    "similarityScore": round(score, 4),
                    "commonTags": [f"{c}/{n}" for (c, n) in sorted(common)],
                })
        results.sort(key=lambda r: r["similarityScore"], reverse=True)
        return results[:limit]

    def list_user_ids(self) -> List[str]:
        with self._cur() as cur:
            cur.execute("SELECT user_id FROM profiles")
            return [row["user_id"] for row in cur.fetchall()]

    def list_all_profiles(self) -> Dict[str, PatientProfile]:
        out: Dict[str, PatientProfile] = {}
        with self._cur() as cur:
            cur.execute("SELECT * FROM profiles")
            for row in cur.fetchall():
                prof = self._row_to_profile(row)
                out[prof.userId] = prof
        return out

    def list_all_memories(self) -> Dict[str, List[MemoryInfo]]:
        out: Dict[str, List[MemoryInfo]] = {}
        with self._cur() as cur:
            cur.execute("SELECT * FROM memories ORDER BY created_at ASC")
            for row in cur.fetchall():
                uid = row["user_id"]
                mem = MemoryInfo(
                    memoryId=row["id"],
                    content=row["content"],
                    category=row["category"],
                    importance=row["importance"],
                    createdAt=row["created_at"],
                    lastAccessed=row["last_accessed"],
                )
                out.setdefault(uid, []).append(mem)
        return out


# --------------------------------------------------------------------------- #
# PostgreSQL store                                                              #
# --------------------------------------------------------------------------- #

try:
    import psycopg2
    import psycopg2.extras
    _postgres_available = True
except ImportError:
    _postgres_available = False


class PostgresStore(BaseStore):
    """
    PostgreSQL-backed store – requires psycopg2 and a running Postgres instance.
    Set STORAGE_DATABASE_URL to a full libpq connection string, e.g.:
        postgresql://user:pass@host:5432/hospital_profile
    """

    def __init__(self, database_url: str = "") -> None:
        if not _postgres_available:
            raise ImportError(
                "psycopg2 is required for PostgresStore. Install it via: pip install psycopg2-binary"
            )
        if not database_url:
            raise ValueError("STORAGE_DATABASE_URL must be set when STORAGE_TYPE=postgres")
        self._conn = psycopg2.connect(database_url)
        self._conn.autocommit = False
        self._init_schema()

    def _init_schema(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS profiles (
                    user_id VARCHAR(255) PRIMARY KEY,
                    profile_json JSONB NOT NULL,
                    last_interaction TIMESTAMPTZ
                );
                CREATE TABLE IF NOT EXISTS memories (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    category VARCHAR(100),
                    importance REAL DEFAULT 0.5,
                    created_at TIMESTAMPTZ NOT NULL,
                    last_accessed TIMESTAMPTZ
                );
                CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
                CREATE INDEX IF NOT EXISTS idx_profiles_last ON profiles(last_interaction);
            """)
        self._conn.commit()

    # ---- profile ----
    def get_profile(self, user_id: str) -> Optional[PatientProfile]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT profile_json FROM profiles WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
            if row is None:
                return None
            return PatientProfile.model_validate_json(row[0])

    def get_or_create_profile(self, user_id: str) -> PatientProfile:
        prof = self.get_profile(user_id)
        if prof is None:
            prof = PatientProfile(userId=user_id, profileVersion=0, tags=[], tagsByCategory={})
        return prof

    def update_profile(
        self,
        user_id: str,
        tags: List[TagInfo],
        source_conversation_id: Optional[str] = None,
    ) -> PatientProfile:
        now = datetime.utcnow().isoformat() + "Z"
        prof = self.get_or_create_profile(user_id)
        existing: Dict[tuple, TagInfo] = {(t.tagCategory, t.tagName): t for t in prof.tags}
        for t in tags:
            key = (t.tagCategory, t.tagName)
            t.id = t.id or str(uuid.uuid4())
            t.updatedAt = now
            existing[key] = t
        prof.tags = list(existing.values())
        prof.tagsByCategory = {}
        for t in prof.tags:
            prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
        prof.profileVersion = (prof.profileVersion or 0) + 1
        prof.lastInteraction = now
        prof.updatedAt = now
        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO profiles (user_id, profile_json, last_interaction)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET
                    profile_json = excluded.profile_json,
                    last_interaction = excluded.last_interaction
                """,
                (user_id, prof.model_dump_json(), now),
            )
        self._conn.commit()
        return prof

    def delete_tag(self, user_id: str, tag_id: str) -> bool:
        prof = self.get_profile(user_id)
        if not prof:
            return False
        new_tags = [t for t in prof.tags if t.id != tag_id]
        if len(new_tags) == len(prof.tags):
            return False
        prof.tags = new_tags
        prof.tagsByCategory = {}
        for t in prof.tags:
            prof.tagsByCategory.setdefault(t.tagCategory, []).append(t)
        prof.profileVersion = (prof.profileVersion or 0) + 1
        prof.updatedAt = datetime.utcnow().isoformat() + "Z"
        now = datetime.utcnow().isoformat() + "Z"
        with self._conn.cursor() as cur:
            cur.execute(
                "UPDATE profiles SET profile_json = %s, last_interaction = %s WHERE user_id = %s",
                (prof.model_dump_json(), now, user_id),
            )
        self._conn.commit()
        return True

    def get_tags(self, user_id: str, category: Optional[str] = None) -> List[TagInfo]:
        prof = self.get_profile(user_id)
        if not prof:
            return []
        if category:
            return list(prof.tagsByCategory.get(category, []))
        return list(prof.tags)

    # ---- memories ----
    def add_memory(
        self,
        user_id: str,
        content: str,
        category: Optional[str] = None,
        importance: float = 0.5,
    ) -> MemoryInfo:
        now = datetime.utcnow().isoformat() + "Z"
        mem = MemoryInfo(
            memoryId=str(uuid.uuid4()),
            content=content,
            category=category,
            importance=importance,
            createdAt=now,
        )
        with self._conn.cursor() as cur:
            cur.execute(
                "INSERT INTO memories (id, user_id, content, category, importance, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                (mem.memoryId, user_id, content, category, importance, now),
            )
        self._conn.commit()
        return mem

    def get_memories(self, user_id: str) -> List[MemoryInfo]:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM memories WHERE user_id = %s ORDER BY created_at ASC",
                (user_id,),
            )
            return [
                MemoryInfo(
                    memoryId=row[0],
                    content=row[2],
                    category=row[3],
                    importance=row[4],
                    createdAt=row[5],
                    lastAccessed=row[6],
                )
                for row in cur.fetchall()
            ]

    # ---- helpers ----
    def find_similar_patients(self, user_id: str, limit: int = 5) -> List[Dict]:
        target = self.get_profile(user_id)
        if not target:
            return []
        target_keys = {(t.tagCategory, t.tagName) for t in target.tags}
        if not target_keys:
            return []
        results: List[Dict] = []
        with self._conn.cursor() as cur:
            cur.execute("SELECT user_id, profile_json FROM profiles WHERE user_id != %s", (user_id,))
            for (uid, prof_json) in cur.fetchall():
                other = PatientProfile.model_validate_json(prof_json)
                other_keys = {(t.tagCategory, t.tagName) for t in other.tags}
                common = target_keys & other_keys
                if not common:
                    continue
                score = len(common) / max(len(target_keys), 1)
                results.append({
                    "patientId": uid,
                    "similarityScore": round(score, 4),
                    "commonTags": [f"{c}/{n}" for (c, n) in sorted(common)],
                })
        results.sort(key=lambda r: r["similarityScore"], reverse=True)
        return results[:limit]

    def list_user_ids(self) -> List[str]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT user_id FROM profiles")
            return [row[0] for row in cur.fetchall()]

    def list_all_profiles(self) -> Dict[str, PatientProfile]:
        out: Dict[str, PatientProfile] = {}
        with self._conn.cursor() as cur:
            cur.execute("SELECT user_id, profile_json FROM profiles")
            for (uid, prof_json) in cur.fetchall():
                out[uid] = PatientProfile.model_validate_json(prof_json)
        return out

    def list_all_memories(self) -> Dict[str, List[MemoryInfo]]:
        out: Dict[str, List[MemoryInfo]] = {}
        with self._conn.cursor() as cur:
            cur.execute("SELECT * FROM memories ORDER BY created_at ASC")
            for row in cur.fetchall():
                uid = row[1]
                mem = MemoryInfo(
                    memoryId=row[0],
                    content=row[2],
                    category=row[3],
                    importance=row[4],
                    createdAt=row[5],
                    lastAccessed=row[6],
                )
                out.setdefault(uid, []).append(mem)
        return out