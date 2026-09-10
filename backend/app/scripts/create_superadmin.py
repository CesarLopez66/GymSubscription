"""One-off bootstrap script: creates the first SUPERADMIN user.

No API endpoint can create a SUPERADMIN (that would let any gym self-escalate),
so the very first one must be inserted directly against the database.

Usage:
    python -m app.scripts.create_superadmin --email admin@subgym.com --password "S3cur3Pass!" \
        --first-name Ada --last-name Lovelace
"""

import argparse
import asyncio

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, set_rls_context
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User


async def create_superadmin(email: str, password: str, first_name: str, last_name: str) -> None:
    async with AsyncSessionLocal() as db, db.begin():
        # This script is the one legitimate way to bypass RLS: there is no
        # authenticated request context yet, so the superadmin GUC is set
        # directly instead of being derived from a JWT.
        await set_rls_context(db, gym_id=None, is_superadmin=True)

        existing = await db.execute(
            select(User).where(User.gym_id.is_(None), User.email == email)
        )
        if existing.scalar_one_or_none() is not None:
            print(f"A SUPERADMIN with email '{email}' already exists.")
            return

        user = User(
            gym_id=None,
            email=email,
            password_hash=hash_password(password),
            roles=[UserRole.SUPERADMIN],
            first_name=first_name,
            last_name=last_name,
        )
        db.add(user)
        print(f"SUPERADMIN '{email}' created successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first SUPERADMIN user.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    args = parser.parse_args()

    asyncio.run(
        create_superadmin(args.email, args.password, args.first_name, args.last_name)
    )


if __name__ == "__main__":
    main()
