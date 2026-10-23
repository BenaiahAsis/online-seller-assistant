from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    materials: Mapped[str | None] = mapped_column(String(500), nullable=True)
    features: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    analysis: Mapped["ProductAnalysis | None"] = relationship(
        "ProductAnalysis",
        back_populates="product",
        uselist=False,
        cascade="all, delete",
    )
    listings: Mapped[list["ProductListing"]] = relationship(
        "ProductListing",
        back_populates="product",
        cascade="all, delete",
    )


class ProductAnalysis(Base):
    __tablename__ = "product_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    target_audience: Mapped[str | None] = mapped_column(String(255), nullable=True)
    key_specifications: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    selling_points: Mapped[list | None] = mapped_column(JSON, nullable=True)
    suggested_keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)
    market_insights: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product: Mapped[Product] = relationship("Product", back_populates="analysis")


class ProductListing(Base):
    __tablename__ = "product_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    bullet_points: Mapped[list | None] = mapped_column(
        JSON, default=list, nullable=True
    )
    hashtags: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    call_to_action: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    product: Mapped[Product] = relationship("Product", back_populates="listings")
