"""Document upload, metadata, and chunk endpoints."""

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentChunkRead, DocumentRead
from app.services.document_service import process_document_background


router = APIRouter(prefix="/documents", tags=["Documents"])
settings = get_settings()
allowed_extensions = {".pdf", ".docx", ".pptx", ".xlsx"}


@router.get("", response_model=list[DocumentRead])
def list_documents(
    query: str | None = None,
    collection: str | None = None,
    db: Session = Depends(get_db),
) -> list[Document]:
    statement: Select[tuple[Document]] = select(Document).order_by(Document.updated_at.desc())
    if query:
        statement = statement.where(Document.name.ilike(f"%{query.strip()}%"))
    if collection:
        statement = statement.where(Document.collection == collection.strip())
    return list(db.scalars(statement))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Session = Depends(get_db)) -> Document:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkRead])
def get_document_chunks(
    document_id: str,
    db: Session = Depends(get_db),
) -> list[DocumentChunk]:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document.chunks


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection: str = Form("General"),
    db: Session = Depends(get_db),
) -> Document:
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()
    if not filename or extension not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, DOCX, PPTX, and XLSX files are supported")

    payload = await file.read()
    maximum_size = settings.max_upload_size_mb * 1024 * 1024
    if not payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty")
    if len(payload) > maximum_size:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Files must be {settings.max_upload_size_mb} MB or smaller")

    settings.storage_path.mkdir(parents=True, exist_ok=True)
    storage_key = f"{uuid4()}{extension}"
    (settings.storage_path / storage_key).write_bytes(payload)
    document = Document(
        name=filename,
        collection=collection.strip() or "General",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(payload),
        storage_key=storage_key,
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Trigger background text extraction and chunking
    background_tasks.add_task(process_document_background, document.id)
    
    return document

