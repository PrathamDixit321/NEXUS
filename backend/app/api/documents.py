"""Document upload, metadata, chunk, download, and access permissions endpoints."""

from pathlib import Path
from uuid import uuid4
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import Select, select, or_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.auth import User
from app.models.document import Document, DocumentChunk, DocumentPermission
from app.schemas.document import (
    DocumentChunkRead,
    DocumentRead,
    DocumentPermissionsRead,
    DocumentPermissionsUpdate,
    PermissionGrant
)
from app.services.document_service import process_document_background
from app.services.access_control import (
    can_view_document,
    can_download_document,
    can_edit_document,
    get_allowed_sharing_options,
    validate_sharing_authority
)

router = APIRouter(prefix="/documents", tags=["Documents"])
settings = get_settings()
allowed_extensions = {".pdf", ".docx", ".pptx", ".xlsx"}


@router.get("/sharing-options")
def get_sharing_options(current_user: User = Depends(get_current_user)) -> list[dict]:
    """Exposes visibility sharing setting values allowed for the authenticated user's role."""
    return get_allowed_sharing_options(current_user)


@router.get("", response_model=list[DocumentRead])
def list_documents(
    query: str | None = None,
    collection: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Document]:
    """Lists only the documents the authenticated user is authorized to read."""
    # Build secure query filters
    if current_user.role.name in ("Admin", "CEO"):
        # System-wide managers query all records
        statement = select(Document)
    else:
        # standard users retrieve:
        # 1. Documents they own
        owner_cond = (Document.owner_id == current_user.id)
        # 2. Documents shared with organization
        org_cond = (Document.default_access == "ORGANIZATION")
        # 3. Documents shared with department
        dept_cond = (Document.default_access == "DEPARTMENT") & (Document.department_id == current_user.department_id) if current_user.department_id else False
        # 4. Documents shared with team
        team_cond = (Document.default_access == "TEAM") & (Document.team_id == current_user.team_id) if current_user.team_id else False

        # Gather target overrides matching user properties
        subjects = [("USER", current_user.id), ("ROLE", str(current_user.role_id))]
        if current_user.department_id:
            subjects.append(("DEPARTMENT", str(current_user.department_id)))
        if current_user.team_id:
            subjects.append(("TEAM", str(current_user.team_id)))

        clauses = [
            (DocumentPermission.subject_type == s_type) & (DocumentPermission.subject_id == s_id)
            for s_type, s_id in subjects
        ]

        filter_conds = [owner_cond, org_cond, dept_cond, team_cond]

        if clauses:
            explicit_ids = select(DocumentPermission.document_id).where(
                or_(*clauses)
            )
            filter_conds.append(Document.id.in_(explicit_ids))

        statement = select(Document).where(or_(*filter_conds))

    # Apply search filters
    if query:
        statement = statement.where(Document.name.ilike(f"%{query.strip()}%"))
    if collection:
        statement = statement.where(Document.collection == collection.strip())

    statement = statement.order_by(Document.updated_at.desc())
    return list(db.scalars(statement))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Document:
    """Retrieves document details after validating view rights (returns 404 on breach to prevent discovery leaks)."""
    document = db.get(Document, document_id)
    if not document or not can_view_document(current_user, document, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.get("/{document_id}/chunks", response_model=list[DocumentChunkRead])
def get_document_chunks(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentChunk]:
    """Retrieves document text chunks after validating view rights."""
    document = db.get(Document, document_id)
    if not document or not can_view_document(current_user, document, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document.chunks


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    collection: str = Form("General"),
    classification: str = Form("INTERNAL"),
    default_access: str = Form("ORGANIZATION"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Document:
    """Uploads and registers a new document after validating uploader sharing authority limits."""
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()
    if not filename or extension not in allowed_extensions:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF, DOCX, PPTX, and XLSX files are supported")

    # Enforce sharing authority settings limits
    if not validate_sharing_authority(current_user, default_access, [], db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your organizational role does not possess authority to publish at this visibility level."
        )

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
        owner_id=current_user.id,
        department_id=current_user.department_id,
        team_id=current_user.team_id,
        classification=classification,
        default_access=default_access,
        status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Trigger background text extraction and chunking
    background_tasks.add_task(process_document_background, document.id)
    
    return document


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enforces download authorization policies before returning file content."""
    document = db.get(Document, document_id)
    if not document or not can_download_document(current_user, document, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        
    filepath = settings.storage_path / document.storage_key
    if not filepath.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document storage file not found on disk")
        
    return FileResponse(
        path=filepath,
        media_type=document.content_type,
        filename=document.name
    )


@router.get("/{document_id}/permissions", response_model=DocumentPermissionsRead)
def get_document_permissions(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetches details for document configuration management."""
    document = db.get(Document, document_id)
    if not document or not can_view_document(current_user, document, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        
    grants = db.query(DocumentPermission).filter(DocumentPermission.document_id == document.id).all()
    
    return {
        "owner_id": document.owner_id,
        "owner_name": document.owner,
        "default_access": document.default_access,
        "classification": document.classification,
        "allowed_options": get_allowed_sharing_options(current_user),
        "permissions": grants
    }


@router.post("/{document_id}/permissions", response_model=DocumentPermissionsRead)
def update_document_permissions(
    document_id: str,
    payload: DocumentPermissionsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Saves new visibility and access configuration policies after confirming edit/share authorization checks."""
    document = db.get(Document, document_id)
    if not document or not can_edit_document(current_user, document, db):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
        
    shares_list = [
        {
            "subject_type": p.subject_type,
            "subject_id": p.subject_id,
            "permission_type": p.permission_type
        }
        for p in payload.permissions
    ]
    
    if not validate_sharing_authority(current_user, payload.default_access, shares_list, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sharing configuration exceeds your organizational role boundaries."
        )
        
    document.default_access = payload.default_access
    document.classification = payload.classification
    
    # Reset and insert permissions
    db.query(DocumentPermission).filter(DocumentPermission.document_id == document.id).delete()
    for p in payload.permissions:
        grant = DocumentPermission(
            document_id=document.id,
            subject_type=p.subject_type,
            subject_id=p.subject_id,
            permission_type=p.permission_type
        )
        db.add(grant)
        
    db.commit()
    db.refresh(document)
    
    grants = db.query(DocumentPermission).filter(DocumentPermission.document_id == document.id).all()
    return {
        "owner_id": document.owner_id,
        "owner_name": document.owner,
        "default_access": document.default_access,
        "classification": document.classification,
        "allowed_options": get_allowed_sharing_options(current_user),
        "permissions": grants
    }
