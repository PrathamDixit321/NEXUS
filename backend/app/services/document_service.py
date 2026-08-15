import json
import logging
from pathlib import Path
import pypdf
import docx

from app.core.config import get_settings
from app.db.database import SessionLocal
from app.models.document import Document, DocumentChunk
from app.services.ai_service import get_embedding

logger = logging.getLogger("nexusai.document_service")
settings = get_settings()


def extract_text(filepath: Path, content_type: str) -> list[tuple[int, str]]:
    """Extract page-by-page text from supported file types."""
    suffix = filepath.suffix.lower()
    if suffix == ".pdf" or "pdf" in content_type:
        return extract_text_from_pdf(filepath)
    elif suffix in (".docx", ".doc") or "word" in content_type or "officedocument" in content_type:
        return extract_text_from_docx(filepath)
    else:
        # Fallback to simple file read
        try:
            text = filepath.read_text(encoding="utf-8", errors="ignore")
            return [(1, text)]
        except Exception as e:
            logger.error(f"Unsupported file content/extension {suffix}: {e}")
            raise ValueError(f"Unsupported file type: {suffix}")


def extract_text_from_pdf(filepath: Path) -> list[tuple[int, str]]:
    """Extract page number and text from a PDF document."""
    pages = []
    try:
        reader = pypdf.PdfReader(str(filepath))
        for idx, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append((idx + 1, text))
    except Exception as e:
        logger.error(f"Error parsing PDF file {filepath}: {e}")
        raise RuntimeError(f"Error parsing PDF: {e}")
    return pages


def extract_text_from_docx(filepath: Path) -> list[tuple[int, str]]:
    """Extract paragraphs text from a Word document."""
    try:
        doc = docx.Document(str(filepath))
        paragraphs = [p.text for p in doc.paragraphs]
        text = "\n".join(paragraphs)
        return [(1, text)]
    except Exception as e:
        logger.error(f"Error parsing DOCX file {filepath}: {e}")
        raise RuntimeError(f"Error parsing DOCX: {e}")


def chunk_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[str]:
    """Split text recursively aiming for target chunk size with overlap."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        if len(para) > chunk_size:
            # If paragraph itself is larger than chunk size, split it down further
            if current_chunk:
                chunks.append(current_chunk)
                current_chunk = ""
            lines = para.split("\n")
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if len(line) > chunk_size:
                    words = line.split(" ")
                    sub_chunk = ""
                    for word in words:
                        if len(sub_chunk) + len(word) + 1 > chunk_size:
                            chunks.append(sub_chunk.strip())
                            sub_chunk = word + " "
                        else:
                            sub_chunk += word + " "
                    if sub_chunk:
                        current_chunk = sub_chunk.strip()
                else:
                    if len(current_chunk) + len(line) + 1 > chunk_size:
                        chunks.append(current_chunk)
                        current_chunk = line
                    else:
                        current_chunk = (current_chunk + "\n" + line).strip() if current_chunk else line
        else:
            if len(current_chunk) + len(para) + 2 > chunk_size:
                chunks.append(current_chunk)
                current_chunk = para
            else:
                current_chunk = (current_chunk + "\n\n" + para).strip() if current_chunk else para
                
    if current_chunk:
        chunks.append(current_chunk)
        
    if not chunk_overlap or len(chunks) <= 1:
        return chunks
        
    # Apply chunk overlap
    overlapped_chunks = []
    for idx, chunk in enumerate(chunks):
        if idx == 0:
            overlapped_chunks.append(chunk)
        else:
            prev_chunk = chunks[idx - 1]
            overlap_start = max(0, len(prev_chunk) - chunk_overlap)
            overlap = prev_chunk[overlap_start:]
            overlapped_chunks.append((overlap + "\n" + chunk).strip())
            
    return overlapped_chunks


def process_document_background(document_id: str) -> None:
    """Read the stored file, extract text, divide into chunks, save to database and mark document as ready."""
    logger.info(f"Starting background processing for document: {document_id}")
    
    with SessionLocal() as db:
        document = db.get(Document, document_id)
        if not document:
            logger.error(f"Document {document_id} not found in database")
            return

        try:
            filepath = settings.storage_path / document.storage_key
            if not filepath.exists():
                raise FileNotFoundError(f"File not found on disk: {filepath}")

            extracted_pages = extract_text(filepath, document.content_type)
            
            db_chunks = []
            chunk_idx = 0
            
            for page_num, page_text in extracted_pages:
                chunks = chunk_text(page_text)
                for chunk_content in chunks:
                    if not chunk_content.strip():
                        continue
                    
                    # Generate vector embedding for this chunk
                    embedding = get_embedding(chunk_content)
                    embedding_json = json.dumps(embedding)
                    
                    db_chunk = DocumentChunk(
                        document_id=document.id,
                        chunk_index=chunk_idx,
                        content=chunk_content,
                        page_number=page_num,
                        embedding_json=embedding_json,
                    )
                    db_chunks.append(db_chunk)
                    chunk_idx += 1
                    
            db.add_all(db_chunks)
            document.status = "ready"
            db.commit()
            logger.info(f"Finished processing document {document_id}: generated {chunk_idx} chunks")
        except Exception as e:
            logger.exception(f"Failed background processing for document {document_id}: {e}")
            try:
                document.status = "failed"
                db.commit()
            except Exception:
                db.rollback()
