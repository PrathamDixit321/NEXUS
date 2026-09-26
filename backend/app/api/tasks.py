"""API router for operational Task management and tracking."""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.auth import User
from app.models.operations import Task
from app.schemas.operations import TaskCreate, TaskResponse, TaskUpdate

logger = logging.getLogger("nexusai.api.tasks")
router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _format_task(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        assigned_to_id=task.assigned_to_id,
        assigned_to_name=task.assigned_to.full_name if task.assigned_to else None,
        assigned_to_email=task.assigned_to.email if task.assigned_to else None,
        created_by_id=task.created_by_id,
        due_date=task.due_date,
        related_resource_type=task.related_resource_type,
        related_resource_id=task.related_resource_id,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


@router.get("", response_model=List[TaskResponse])
def list_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority_filter: Optional[str] = Query(None, alias="priority"),
    assigned_to_me: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[TaskResponse]:
    """Retrieve workspace operational tasks with status, priority, and assignment filters."""
    query = select(Task).order_by(desc(Task.created_at))

    if status_filter:
        query = query.where(Task.status == status_filter.upper())
    if priority_filter:
        query = query.where(Task.priority == priority_filter.upper())
    if assigned_to_me:
        query = query.where(Task.assigned_to_id == current_user.id)

    tasks = db.scalars(query).all()
    return [_format_task(t) for t in tasks]


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Create a new operational task in the workspace queue."""
    task = Task(
        title=payload.title,
        description=payload.description,
        status=payload.status.upper(),
        priority=payload.priority.upper(),
        assigned_to_id=payload.assigned_to_id or current_user.id,
        created_by_id=current_user.id,
        due_date=payload.due_date,
        related_resource_type=payload.related_resource_type,
        related_resource_id=payload.related_resource_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    logger.info(f"Task created: '{task.title}' by {current_user.email}")
    return _format_task(task)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Get task details by ID."""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _format_task(task)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: str,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskResponse:
    """Update task status, priority, assignment, or description."""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status.upper()
    if payload.priority is not None:
        task.priority = payload.priority.upper()
    if payload.assigned_to_id is not None:
        task.assigned_to_id = payload.assigned_to_id
    if payload.due_date is not None:
        task.due_date = payload.due_date

    db.commit()
    db.refresh(task)
    logger.info(f"Task {task_id} updated: status={task.status} by {current_user.email}")
    return _format_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a task from the workspace."""
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    db.delete(task)
    db.commit()
    logger.info(f"Task {task_id} deleted by {current_user.email}")
    return None
