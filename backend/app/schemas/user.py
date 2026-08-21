import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import Sex, UserRole


class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = None
    date_of_birth: date | None = None
    sex: Sex | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    gym_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    phone: str | None = None
    date_of_birth: date | None = None
    sex: Sex | None = None
    is_active: bool | None = None


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gym_id: uuid.UUID | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime
