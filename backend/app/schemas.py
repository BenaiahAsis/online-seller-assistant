from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str = Field(
        ..., min_length=1, max_length=255, description="Product title/name"
    )
    price: float = Field(..., gt=0, description="Product price in currency units")
    quantity: int = Field(default=1, ge=1, description="Available stock quantity")
    materials: str | None = Field(
        default=None, max_length=500, description="Fabric, metal, ingredients, etc."
    )
    features: str | None = Field(
        default=None, description="Key features, dimensions, or seller notes"
    )


class ProductCreate(ProductBase):
    pass


class ProductAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    category: str | None = None
    target_audience: str | None = None
    key_specifications: dict[str, Any] | None = None
    selling_points: list[str] | None = None
    suggested_keywords: list[str] | None = None
    market_insights: dict[str, Any] | None = None
    raw_summary: str | None = None
    created_at: datetime


class ProductListingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    platform: str
    title: str
    description: str
    bullet_points: list[str] = Field(default_factory=list)
    hashtags: list[str] = Field(default_factory=list)
    call_to_action: str | None = None
    created_at: datetime


class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    created_at: datetime
    analysis: ProductAnalysisResponse | None = None
    listings: list[ProductListingResponse] = Field(default_factory=list)


class ProductListResponse(BaseModel):
    products: list[ProductResponse]
    total: int


class FullPipelineResponse(BaseModel):
    product: ProductResponse
    status: str
    message: str
