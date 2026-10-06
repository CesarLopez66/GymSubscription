from pydantic import BaseModel, EmailStr, Field


class GymRegistrationRequest(BaseModel):
    """Public self-service signup: creates the gym (TRIAL, FREE) and its
    first GYM_ADMIN together. The admin's own email doubles as the gym's
    contact_email — asking for two emails on a signup form nobody's
    filled out for anyone else yet would just be friction."""

    gym_name: str = Field(min_length=2, max_length=150)
    subdomain: str = Field(min_length=2, max_length=63, pattern=r"^[a-z0-9-]+$")
    contact_phone: str | None = None
    address: str | None = None
    admin_first_name: str = Field(min_length=1, max_length=100)
    admin_last_name: str = Field(min_length=1, max_length=100)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
