"""Cryptography and security helper functions for password hashing using bcrypt directly."""

import bcrypt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password string against a bcrypt hashed password stored in the database.
    
    Uses the native python-bcrypt library directly to avoid legacy passlib compatibility bugs.
    """
    try:
        # Convert inputs to bytes and run checkpw
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generates a secure bcrypt hash of a plain password string.
    
    Uses native bcrypt directly to generate a secure salt and hash the input.
    """
    # Convert input to bytes
    password_bytes = password.encode("utf-8")
    # Generate salt (rounds=12 is standard for secure hashing)
    salt = bcrypt.gensalt(rounds=12)
    # Hash the password and decode the resulting bytes back into a string for storage
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")
