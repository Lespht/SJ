"""Reglas de `posts` contra la COPIA en 127.0.0.1:8099. Se corre con tests/probar-reglas.sh."""
import sys
from copia import PNG, SU, caso, req, resultados, usuario

A, a_id = usuario("a")
B, b_id = usuario("b")

P = "/api/collections/posts/records"
st, m = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] comiendo", "autor": a_id}); caso("A crea su momento", True, st)
st, _ = req("POST", P, A, {"tipo": "momento", "texto": "[prueba]", "autor": b_id}); caso("A no puede crear a nombre de B", False, st)
st, f = req("POST", "/api/collections/fotos/records", A, {"autor": a_id, "post": m["id"], "descripcion": "[prueba]"}, {"imagen": ("p.png", PNG, "image/png")}); caso("A sube foto al momento", True, st)

st, _ = req("PATCH", f"{P}/{m['id']}", B, {"texto": "[prueba] editado por B"}); caso("B no edita el texto del momento de A", False, st)
st, _ = req("PATCH", f"{P}/{m['id']}", A, {"tipo": "plan"}); caso("nadie cambia el tipo", False, st)
st, _ = req("PATCH", f"{P}/{m['id']}", A, {"autor": b_id}); caso("nadie cambia el autor", False, st)
st, _ = req("PATCH", f"{P}/{m['id']}", B, {"archivado": True, "archivado_en": "2026-11-21 12:00:00.000Z"}); caso("B archiva el momento de A", True, st)
st, _ = req("DELETE", f"{P}/{m['id']}", B); caso("B no borra definitivamente lo de A", False, st)
st, _ = req("DELETE", f"{P}/{m['id']}", A); caso("A borra su momento archivado", True, st)
st, _ = req("GET", f"/api/collections/fotos/records/{f['id']}", A); caso("la foto se fue con el post (404)", False, st)

st, p = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] pasta", "autor": a_id}); caso("A crea un plan", True, st)
st, _ = req("PATCH", f"{P}/{p['id']}", B, {"fecha": "2026-11-28 12:00:00.000Z", "hora": "21:00"}); caso("B fija el día y la hora del plan pendiente de A", True, st)
st, _ = req("PATCH", f"{P}/{p['id']}", B, {"hora": "25:00"}); caso("el plan rechaza una hora fuera de rango", False, st)
st, _ = req("PATCH", f"{P}/{p['id']}", B, {"hora": "9:5"}); caso("el plan exige el formato HH:MM", False, st)
st, _ = req("PATCH", f"{P}/{p['id']}", B, {"fecha": "", "hora": ""}); caso("B quita el día y la hora del plan", True, st)
st, _ = req("PATCH", f"{P}/{p['id']}", B, {"hecho": True, "titulo": "[prueba] pasta casera"}); caso("B edita y completa el plan de A", True, st)
st, _ = req("DELETE", f"{P}/{p['id']}", A); caso("A borra su plan sin fotos", True, st)

# NOS-39 · borrar
F = "/api/collections/fotos/records"
def foto(token, uid, post):
    return req("POST", F, token, {"autor": uid, "post": post, "descripcion": "[prueba]"}, {"imagen": ("p.png", PNG, "image/png")})
st, m2 = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] borrar", "autor": a_id})
st, f2 = foto(A, a_id, m2["id"])
st, _ = req("DELETE", f"{F}/{f2['id']}", B); caso("B no borra la foto de A", False, st)
st, _ = req("DELETE", f"{P}/{m2['id']}", B); caso("B no borra el momento de A", False, st)
st, _ = req("DELETE", f"{P}/{m2['id']}", A); caso("A borra su momento con fotos sin archivarlo", True, st)
st, _ = req("GET", f"{F}/{f2['id']}", A); caso("sus fotos se van con el momento (404)", False, st)

st, p2 = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] salida", "hecho": True, "autor": a_id})
st, fa = foto(A, a_id, p2["id"])
st, fb = foto(B, b_id, p2["id"]); caso("B aporta una foto al plan de A", True, st)
st, _ = req("DELETE", f"{P}/{p2['id']}", A); caso("A no borra su plan si tiene una foto de B", False, st)
st, _ = req("PATCH", f"{P}/{p2['id']}", A, {"archivado": True, "archivado_en": "2026-11-21 12:00:00.000Z"})
st, _ = req("DELETE", f"{P}/{p2['id']}", A); caso("ni archivado, si tiene una foto de B", False, st)
st, _ = req("DELETE", f"{P}/{p2['id']}", B); caso("B no borra el plan que creó A", False, st)
st, _ = req("DELETE", f"{F}/{fb['id']}", B); caso("B saca su foto del plan", True, st)
st, _ = req("DELETE", f"{P}/{p2['id']}", A); caso("A borra su plan con solo sus fotos", True, st)

# NOS-42 · respuestas. Se usa otro momento propio para que el rechazo no dependa del índice.
def responder(token, uid, original):
    return req("POST", P, token, {"tipo": "momento", "texto": "[prueba] respuesta", "autor": uid, "respuesta_a": original})

st, original = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] original", "autor": a_id})
assert st == 200, st
st, propio = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] propio", "autor": a_id})
assert st == 200, st
st, plan = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] no admite respuestas", "autor": a_id})
assert st == 200, st
st, respuesta = responder(B, b_id, original["id"]); caso("B responde el momento de A", True, st)
st, _ = responder(B, b_id, original["id"]); caso("B no responde dos veces el mismo momento", False, st)
st, _ = responder(A, a_id, propio["id"]); caso("A no responde su propio momento", False, st)
st, _ = responder(B, b_id, plan["id"]); caso("B no responde un plan", False, st)
if "id" in respuesta:
    st, _ = responder(A, a_id, respuesta["id"]); caso("A no puede responder una respuesta", False, st)
    st, _ = req("PATCH", f"{P}/{respuesta['id']}", B, {"respuesta_a": propio["id"]}); caso("B no cambia el original de su respuesta", False, st)
    st, _ = req("DELETE", f"{P}/{original['id']}", A); caso("A borra el momento original", True, st)
    st, suelta = req("GET", f"{P}/{respuesta['id']}", B); caso("la respuesta sigue existiendo sin original", True, st if suelta.get("respuesta_a") == "" else 0)

# NOS-43 · las descartadas (un momento guardado en un plan hecho)
st, mA = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] antes de salir", "autor": a_id})
st, hecho = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] salida", "hecho": True, "autor": a_id})
st, pendiente = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] algún día", "autor": a_id})
st, mB = req("POST", P, B, {"tipo": "momento", "texto": "[prueba] de B", "autor": b_id})
st, resp = req("POST", P, B, {"tipo": "momento", "texto": "[prueba] respuesta", "autor": b_id, "respuesta_a": mA["id"]})
st, _ = req("POST", P, A, {"tipo": "momento", "texto": "[prueba]", "autor": a_id, "descartada_en": hecho["id"]}); caso("no se crea un momento ya descartado", False, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", A, {"descartada_en": pendiente["id"]}); caso("A no guarda su momento en un plan pendiente", False, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", A, {"descartada_en": mB["id"]}); caso("A no guarda su momento en otro momento", False, st)
st, _ = req("PATCH", f"{P}/{hecho['id']}", A, {"descartada_en": hecho["id"]}); caso("un plan no se guarda en un plan", False, st)
st, _ = req("PATCH", f"{P}/{mB['id']}", A, {"descartada_en": hecho["id"]}); caso("A no guarda el momento de B", False, st)
st, _ = req("PATCH", f"{P}/{mB['id']}", A, {"archivado": True, "archivado_en": "2026-11-21 12:00:00.000Z", "descartada_en": hecho["id"]}); caso("ni colándolo al archivar", False, st)
st, _ = req("PATCH", f"{P}/{resp['id']}", B, {"descartada_en": hecho["id"]}); caso("una respuesta no se guarda sola (viaja con su original)", False, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", A, {"descartada_en": hecho["id"]}); caso("A guarda su momento en un plan hecho", True, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", B, {"descartada_en": ""}); caso("B no lo saca del plan", False, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", A, {"descartada_en": ""}); caso("A lo saca del plan", True, st)
st, _ = req("PATCH", f"{P}/{mA['id']}", A, {"descartada_en": hecho["id"]})
st, _ = req("DELETE", f"{P}/{hecho['id']}", A); caso("A borra el plan con una descartada adentro", True, st)
st, suelto = req("GET", f"{P}/{mA['id']}", A); caso("la descartada vuelve a ser un momento suelto", True, st if suelto.get("descartada_en") == "" else 0)

# NOS-44 · mover fotos entre posts (una foto solo va a un plan o a un post propio)
st, origen = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] origen", "autor": a_id})
st, otroPropio = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] otro mío", "autor": a_id})
st, planA = req("POST", P, A, {"tipo": "plan", "titulo": "[prueba] plan A", "hecho": True, "autor": a_id})
st, planB = req("POST", P, B, {"tipo": "plan", "titulo": "[prueba] plan B", "hecho": True, "autor": b_id})
st, momentoB = req("POST", P, B, {"tipo": "momento", "texto": "[prueba] de B", "autor": b_id})
st, fm = foto(A, a_id, origen["id"])
st, _ = req("PATCH", f"{F}/{fm['id']}", A, {"post": momentoB["id"]}); caso("A no mete su foto en un momento de B", False, st)
st, _ = req("PATCH", f"{F}/{fm['id']}", B, {"post": planB["id"]}); caso("B no mueve la foto de A", False, st)
st, _ = req("PATCH", f"{F}/{fm['id']}", A, {"post": otroPropio["id"]}); caso("A mueve su foto a otro momento suyo", True, st)
st, _ = req("PATCH", f"{F}/{fm['id']}", A, {"post": planA["id"]}); caso("A mueve su foto a su plan", True, st)
st, _ = req("PATCH", f"{F}/{fm['id']}", A, {"post": planB["id"]}); caso("A mueve su foto al plan de B (aporta)", True, st)

# NOS-35 · suscripciones
S = "/api/collections/suscripciones/records"
suscripcion = {"usuario": a_id, "endpoint": "https://push.example.test/prueba-a", "p256dh": "prueba-a", "auth": "prueba-a"}
otra_suscripcion = {**suscripcion, "usuario": b_id, "endpoint": "https://push.example.test/prueba-b"}
st, suscripcion_a = req("POST", S, A, suscripcion); caso("A registra su propia suscripción", True, st)
st, _ = req("POST", S, A, otra_suscripcion); caso("A no registra una suscripción de B", False, st)
st, suscripcion_b = req("POST", S, B, otra_suscripcion); caso("B registra su propia suscripción", True, st)
st, lista = req("GET", S, A)
caso("A lista solo sus propias suscripciones", True, st if [r["id"] for r in lista.get("items", [])] == [suscripcion_a.get("id")] else 0)
if "id" in suscripcion_a:
    st, _ = req("PATCH", f"{S}/{suscripcion_a['id']}", A, {"auth": "prueba-nueva"}); caso("A no edita su suscripción", False, st)
    st, _ = req("DELETE", f"{S}/{suscripcion_a['id']}", A); caso("A borra su propia suscripción", True, st)

# limpieza (solo en la copia)
for uid in (a_id, b_id):
    req("DELETE", f"/api/collections/users/records/{uid}", SU)
print(f"\n{sum(resultados)}/{len(resultados)} reglas como se esperaba")
sys.exit(0 if all(resultados) else 1)
