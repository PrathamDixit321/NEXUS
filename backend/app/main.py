import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Define the root logger or get a configured logger.
# We will design a full logging system in Step 2, but we need basic console logging for now.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexusai")

# Initialize the FastAPI application
app = FastAPI(
    title="NexusAI API",
    description="Enterprise AI Operating System Core API Engine",
    version="1.0.0",
)

# Set up CORS (Cross-Origin Resource Sharing) middleware to allow the frontend to call the API.
# In production, this should be restricted to specific allowed origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development. We will lock this down in security configurations.
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, PUT, DELETE, OPTIONS).
    allow_headers=["*"],  # Allows all headers.
)

@app.get("/health", tags=["System"])
async def health_check():
    """
    Service health check endpoint.
    Used by load balancers, orchestrators, or the frontend to verify that the backend is active.
    """
    logger.info("Health check endpoint hit")
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "NexusAI Backend Engine"
    }

# Ensure __init__.py modules are imported properly during initialization
# More routers (auth, dashboard, profile) will be added here in upcoming steps.
