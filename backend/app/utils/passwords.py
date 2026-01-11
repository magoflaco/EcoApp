from passlib.context import CryptContext

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str, pepper: str) -> str:
    return _pwd.hash(password + pepper)

def verify_password(password: str, pepper: str, password_hash: str) -> bool:
    try:
        return _pwd.verify(password + pepper, password_hash)
    except Exception:
        return False
