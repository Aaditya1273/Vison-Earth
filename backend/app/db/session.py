from typing import Generator
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import async_session

# Re-export async_session for backward compatibility
AsyncSessionLocal = async_session

async def get_db() -> Generator[AsyncSession, None, None]:
    """
    Dependency function that yields db sessions
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
