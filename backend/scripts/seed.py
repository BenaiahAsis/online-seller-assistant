"""Seed a local database with three sample products.

Usage (from backend/, with DATABASE_URL set in the root .env or the shell):
    python -m scripts.seed

Idempotent: products whose name already exists are skipped. Run the AI
pipeline on them afterwards from the UI ("Regenerate Listings") or via
POST /api/products/{id}/full-pipeline.
"""

from __future__ import annotations

from sqlalchemy import select

from app.database import get_session_factory, init_db
from app.models import Product

SAMPLES = [
    {
        "name": "Eco-Friendly Bamboo Wireless Keyboard",
        "price": 1299.0,
        "quantity": 120,
        "materials": "Natural bamboo wood casing, recycled ABS keycaps, aluminum frame",
        "features": (
            "Bluetooth 5.0 and 2.4GHz wireless, 60-hour rechargeable USB-C battery, "
            "silent scissor-switch keys, multi-device switching"
        ),
    },
    {
        "name": "Insulated Stainless Steel Tumbler",
        "price": 450.0,
        "quantity": 250,
        "materials": "18/8 food-grade stainless steel, BPA-free silicone lid",
        "features": "Keeps drinks hot 12h and cold 24h, leak-proof lid, 500ml",
    },
    {
        "name": "Memory Foam Lumbar Support Cushion",
        "price": 699.0,
        "quantity": 85,
        "materials": "High-density memory foam, breathable 3D mesh cover",
        "features": "Adjustable strap, removable washable cover, fits office chairs",
    },
]


def main() -> None:
    if not init_db():
        raise SystemExit("DATABASE_URL is not configured or unreachable.")
    session = get_session_factory()()
    try:
        existing = set(session.scalars(select(Product.name)).all())
        added = 0
        for sample in SAMPLES:
            if sample["name"] in existing:
                continue
            session.add(Product(status="draft", **sample))
            added += 1
        session.commit()
        print(f"Seeded {added} product(s); {len(SAMPLES) - added} already present.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
