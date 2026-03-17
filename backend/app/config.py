from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Environment
    environment: str = "development"  # development | production

    # Database
    database_url: str = "postgresql+asyncpg://photomap:photomap@localhost:5432/photomap"

    # Auth0
    auth0_domain: str = "your-tenant.auth0.com"
    auth0_api_audience: str = "https://photo-map-api.example.com"
    auth0_algorithms: str = "RS256"

    # Azure Blob Storage
    azure_storage_connection_string: str = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;"
    azure_storage_container_name: str = "media"
    azure_storage_thumbnails_container: str = "thumbnails"

    # Azure Maps
    azure_maps_subscription_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Dev mode — MUST be False in production
    dev_auth_bypass: bool = False

    # App
    max_upload_size_mb: int = 100
    thumbnail_max_size: int = 400

    @model_validator(mode="after")
    def _safety_check(self):
        if self.environment == "production" and self.dev_auth_bypass:
            raise ValueError("FATAL: dev_auth_bypass cannot be True in production!")
        return self

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
