from fastapi import APIRouter
from .weather_data import router as weather_data_router

router = APIRouter()

# Include the weather data router
router.include_router(weather_data_router)
