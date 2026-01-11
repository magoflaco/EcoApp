from fastapi import APIRouter
router = APIRouter()

@router.get("/legal/terms")
def terms():
    return {"title":"Términos y Condiciones", "content":"Contenido por definir en el frontend / sitio oficial."}

@router.get("/legal/privacy")
def privacy():
    return {"title":"Política de Privacidad", "content":"Contenido por definir en el frontend / sitio oficial."}
