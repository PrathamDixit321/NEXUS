"""Production Vector Database abstraction supporting Qdrant and SQLite with RBAC pre-filtering."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
import json
import logging
from typing import List, Optional
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import SessionLocal
from app.models.document import Document, DocumentChunk
from app.services.ai_service import cosine_similarity

logger = logging.getLogger("nexusai.vector_store")
settings = get_settings()


@dataclass
class VectorChunk:
    """Standardized vector chunk representation for ingestion and indexing."""
    id: int | str
    document_id: str
    chunk_index: int
    content: str
    page_number: Optional[int]
    collection: str
    document_name: str
    vector: List[float]


@dataclass
class VectorSearchResult:
    """Standardized search hit returned from vector database query."""
    chunk_id: int | str
    document_id: str
    document_name: str
    content: str
    page_number: Optional[int]
    similarity: float
    collection: Optional[str] = None


class BaseVectorStore(ABC):
    """Abstract interface defining required vector store operations."""

    @abstractmethod
    def upsert(self, chunks: List[VectorChunk]) -> None:
        """Insert or update embedding points in the vector store."""
        pass

    @abstractmethod
    def search(
        self,
        query_vector: List[float],
        authorized_doc_ids: Optional[List[str]] = None,
        collection: Optional[str] = None,
        limit: int = 5,
        db: Optional[Session] = None,
    ) -> List[VectorSearchResult]:
        """Perform similarity search with role-based document access pre-filtering."""
        pass

    @abstractmethod
    def delete_by_document(self, document_id: str) -> None:
        """Remove all points belonging to a specific document."""
        pass


class SQLiteVectorStore(BaseVectorStore):
    """Local, in-database vector store with zero external dependencies."""

    def upsert(self, chunks: List[VectorChunk]) -> None:
        # Chunks are already stored with embeddings in the database table
        logger.debug(f"SQLite vector store synced {len(chunks)} chunks.")

    def search(
        self,
        query_vector: List[float],
        authorized_doc_ids: Optional[List[str]] = None,
        collection: Optional[str] = None,
        limit: int = 5,
        db: Optional[Session] = None,
    ) -> List[VectorSearchResult]:
        """Search SQLite chunks using pre-filtered queries and cosine similarity."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            stmt = select(DocumentChunk).join(Document)
            
            # 1. Apply strict RBAC pre-filter (never expose chunks of unauthorized docs)
            if authorized_doc_ids is not None:
                if not authorized_doc_ids:
                    return []
                stmt = stmt.where(DocumentChunk.document_id.in_(authorized_doc_ids))

            # 2. Apply collection filter if specified
            if collection:
                stmt = stmt.where(Document.collection == collection)

            chunks = db.scalars(stmt).all()
            scored: List[VectorSearchResult] = []

            for chunk in chunks:
                if not chunk.embedding_json:
                    continue
                try:
                    vec = json.loads(chunk.embedding_json)
                    sim = cosine_similarity(query_vector, vec)
                    if sim > 0.05:
                        scored.append(
                            VectorSearchResult(
                                chunk_id=chunk.id,
                                document_id=chunk.document.id,
                                document_name=chunk.document.name,
                                content=chunk.content,
                                page_number=chunk.page_number,
                                similarity=round(sim, 3),
                                collection=chunk.document.collection,
                            )
                        )
                except Exception as e:
                    logger.error(f"Error parsing SQLite vector chunk {chunk.id}: {e}")

            scored.sort(key=lambda x: x.similarity, reverse=True)
            return scored[:limit]
        finally:
            if should_close:
                db.close()

    def delete_by_document(self, document_id: str) -> None:
        # Managed automatically via SQLite foreign key cascade
        pass


class QdrantVectorStore(BaseVectorStore):
    """Production Qdrant vector database store with payload RBAC pre-filtering."""

    def __init__(
        self,
        url: str,
        collection_name: str,
        api_key: Optional[str] = None,
        fallback: Optional[BaseVectorStore] = None,
    ):
        self.url = url.rstrip("/")
        self.collection_name = collection_name
        self.api_key = api_key
        self.fallback = fallback or SQLiteVectorStore()
        self._collection_verified = False

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["api-key"] = self.api_key
        return headers

    def _ensure_collection(self, dimension: int = 768) -> bool:
        """Verify or create collection in Qdrant with Cosine distance metric."""
        if self._collection_verified:
            return True
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(
                    f"{self.url}/collections/{self.collection_name}",
                    headers=self._headers(),
                )
                if res.status_code == 200:
                    self._collection_verified = True
                    return True
                elif res.status_code == 404:
                    # Create collection
                    create_res = client.put(
                        f"{self.url}/collections/{self.collection_name}",
                        headers=self._headers(),
                        json={
                            "vectors": {
                                "size": dimension,
                                "distance": "Cosine",
                            }
                        },
                    )
                    if create_res.status_code in (200, 201):
                        logger.info(f"Created Qdrant collection '{self.collection_name}' with size {dimension}.")
                        self._collection_verified = True
                        return True
        except Exception as e:
            logger.warning(f"Could not connect to Qdrant at {self.url}: {e}. Operating in fallback mode.")
            return False
        return False

    def upsert(self, chunks: List[VectorChunk]) -> None:
        if not chunks:
            return
        dimension = len(chunks[0].vector) if chunks else 768
        if not self._ensure_collection(dimension):
            # Fall back to SQLite store
            self.fallback.upsert(chunks)
            return

        points = []
        for c in chunks:
            # Deterministic point ID from document and chunk index
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{c.document_id}-{c.chunk_index}"))
            points.append({
                "id": point_id,
                "vector": c.vector,
                "payload": {
                    "document_id": c.document_id,
                    "chunk_index": c.chunk_index,
                    "document_name": c.document_name,
                    "page_number": c.page_number,
                    "collection": c.collection,
                    "content": c.content,
                }
            })

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.put(
                    f"{self.url}/collections/{self.collection_name}/points",
                    headers=self._headers(),
                    json={"points": points},
                )
                if res.status_code in (200, 201):
                    logger.info(f"Upserted {len(points)} vectors into Qdrant collection '{self.collection_name}'.")
                else:
                    logger.error(f"Qdrant upsert returned {res.status_code}: {res.text}")
                    self.fallback.upsert(chunks)
        except Exception as e:
            logger.warning(f"Qdrant upsert error: {e}. Falling back to SQLite.")
            self.fallback.upsert(chunks)

    def search(
        self,
        query_vector: List[float],
        authorized_doc_ids: Optional[List[str]] = None,
        collection: Optional[str] = None,
        limit: int = 5,
        db: Optional[Session] = None,
    ) -> List[VectorSearchResult]:
        if not self._ensure_collection(len(query_vector)):
            return self.fallback.search(
                query_vector=query_vector,
                authorized_doc_ids=authorized_doc_ids,
                collection=collection,
                limit=limit,
                db=db,
            )

        # Build Qdrant payload filter for access control
        must_filters = []
        if authorized_doc_ids is not None:
            if not authorized_doc_ids:
                return []
            must_filters.append({
                "key": "document_id",
                "match": {"any": authorized_doc_ids}
            })

        if collection:
            must_filters.append({
                "key": "collection",
                "match": {"value": collection}
            })

        payload = {
            "vector": query_vector,
            "limit": limit,
            "with_payload": True,
            "score_threshold": 0.05,
        }
        if must_filters:
            payload["filter"] = {"must": must_filters}

        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.post(
                    f"{self.url}/collections/{self.collection_name}/points/search",
                    headers=self._headers(),
                    json=payload,
                )
                if res.status_code == 200:
                    data = res.json()
                    results = []
                    for hit in data.get("result", []):
                        pl = hit.get("payload", {})
                        results.append(
                            VectorSearchResult(
                                chunk_id=hit.get("id"),
                                document_id=pl.get("document_id", ""),
                                document_name=pl.get("document_name", "Unknown"),
                                content=pl.get("content", ""),
                                page_number=pl.get("page_number"),
                                similarity=round(float(hit.get("score", 0.0)), 3),
                                collection=pl.get("collection"),
                            )
                        )
                    return results
                else:
                    logger.warning(f"Qdrant search failed with {res.status_code}: {res.text}. Falling back.")
                    return self.fallback.search(
                        query_vector=query_vector,
                        authorized_doc_ids=authorized_doc_ids,
                        collection=collection,
                        limit=limit,
                        db=db,
                    )
        except Exception as e:
            logger.warning(f"Qdrant search exception: {e}. Falling back to SQLite.")
            return self.fallback.search(
                query_vector=query_vector,
                authorized_doc_ids=authorized_doc_ids,
                collection=collection,
                limit=limit,
                db=db,
            )

    def delete_by_document(self, document_id: str) -> None:
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(
                    f"{self.url}/collections/{self.collection_name}/points/delete",
                    headers=self._headers(),
                    json={
                        "filter": {
                            "must": [{"key": "document_id", "match": {"value": document_id}}]
                        }
                    },
                )
        except Exception as e:
            logger.warning(f"Qdrant delete failed for doc {document_id}: {e}")
        self.fallback.delete_by_document(document_id)


_vector_store_instance: Optional[BaseVectorStore] = None


def get_vector_store() -> BaseVectorStore:
    """Return configured vector database store singleton."""
    global _vector_store_instance
    if _vector_store_instance is None:
        if settings.vector_store_type.lower() == "qdrant":
            logger.info(f"Initializing Qdrant Vector Store at {settings.qdrant_url} (collection: {settings.qdrant_collection_name})")
            _vector_store_instance = QdrantVectorStore(
                url=settings.qdrant_url,
                collection_name=settings.qdrant_collection_name,
                api_key=settings.qdrant_api_key,
                fallback=SQLiteVectorStore(),
            )
        else:
            logger.info("Initializing SQLite Local Vector Store")
            _vector_store_instance = SQLiteVectorStore()
    return _vector_store_instance
