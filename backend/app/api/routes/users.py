from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
import logging

from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)

# Placeholder user data for demonstration
DEMO_USERS = [
    {"id": 1, "username": "demo", "email": "demo@example.com", "full_name": "Demo User"},
    {"id": 2, "username": "admin", "email": "admin@example.com", "full_name": "Admin User"}
]

@router.get("/", response_model=List[dict])
async def read_users(skip: int = 0, limit: int = 100, current_user: dict = Depends(get_current_user)):
    """
    Get all users (demo implementation)
    """
    return DEMO_USERS[skip : skip + limit]

@router.get("/me", response_model=dict)
async def read_user_me(current_user: dict = Depends(get_current_user)):
    """
    Get current user information
    """
    # In a real implementation, we would fetch the user from the database
    # For this demo, just return the first user as the current user
    return DEMO_USERS[0]

@router.get("/{user_id}", response_model=dict)
async def read_user(user_id: int, current_user: dict = Depends(get_current_user)):
    """
    Get specific user by ID
    """
    # Find user by ID
    for user in DEMO_USERS:
        if user["id"] == user_id:
            return user
    
    # If user not found, raise 404 error
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"User with ID {user_id} not found"
    )
