"""Reglas de `posts` contra la COPIA en 127.0.0.1:8099. Se corre con tests/probar-reglas.sh."""
import base64, json, sys, urllib.request, urllib.error, uuid

BASE = "http://127.0.0.1:8099"
assert BASE.endswith(":8099"), "solo contra la copia"
SUPASS = open(sys.argv[1]).read().strip()

def req(method, path, token=None, body=None, files=None):
    headers = {}
    data = None
    if files:
        b = uuid.uuid4().hex
        parts = []
        for k, v in (body or {}).items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        for k, (fn, content, ct) in files.items():
            parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode() + content + b"\r\n")
        parts.append(f"--{b}--\r\n".encode())
        data = b"".join(parts)
        headers["Content-Type"] = f"multipart/form-data; boundary={b}"
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = token
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as resp:
            txt = resp.read()
            return resp.status, (json.loads(txt) if txt else {})
    except urllib.error.HTTPError as e:
        return e.code, {}

st, su = req("POST", "/api/collections/_superusers/auth-with-password", body={"identity": "prueba-su@local.test", "password": SUPASS})
assert st == 200, st
SU = su["token"]

def usuario(n):
    email, pw = f"prueba-{n}@local.test", uuid.uuid4().hex
    req("POST", "/api/collections/users/records", SU, {"email": email, "password": pw, "passwordConfirm": pw, "name": f"[prueba] {n}"})
    st, r = req("POST", "/api/collections/users/auth-with-password", body={"identity": email, "password": pw})
    assert st == 200
    return r["token"], r["record"]["id"]

A, a_id = usuario("a")
B, b_id = usuario("b")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")

resultados = []
def caso(nombre, esperado_ok, st):
    ok = (200 <= st < 300) == esperado_ok
    resultados.append(ok)
    print(("OK  " if ok else "FALLA"), nombre, f"(HTTP {st})")

P = "/api/collections/posts/records"
st, m = req("POST", P, A, {"tipo": "momento", "texto": "[prueba] comiendo", "autor": a_id}); caso("A crea su momento", True, st)
st, _ = req("POST", P, A, {"tipo": "momento", "texto": "[prueba]", "autor": b_id}); caso("A no puede crear a nombre de B", False, st)
st, f = req("POST", "/api/collections/fotos/records", A, {"autor": a_id, "post": m["id"], "descripcion": "[prueba]"}, {"imagen": ("p.png", PNG, "image/png")}); caso("A sube foto al momento", True, st)

st, _ = req("PATCH", f"{P}/{m['id']}", B, {"texto": "[prueba] editado por B"}); caso("B no edita el texto del momento de A", False, st)
st, _ = req("PATCH", f"{P}/{m['id']}", A, {"tipo": "plan"}); caso("nadie cambia el tipo", False, st)
st, _ = req("PATCH", f"{P}/{m['id']}", A, {"autor": b_id}); caso("nadie cambia el autor", False, st)
st, _ = req("DELETE", f"{P}/{m['id']}", A); caso("A no borra su momento con fotos sin archivar", False, st)
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

# limpieza (solo en la copia)
for uid in (a_id, b_id):
    req("DELETE", f"/api/collections/users/records/{uid}", SU)
print(f"\n{sum(resultados)}/{len(resultados)} reglas como se esperaba")
sys.exit(0 if all(resultados) else 1)
