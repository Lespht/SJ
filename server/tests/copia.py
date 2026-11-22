"""Helpers para probar contra la COPIA de la base en 127.0.0.1:8099 (tests/probar-reglas.sh)."""
import base64, json, sys, urllib.request, urllib.error, uuid

BASE = "http://127.0.0.1:8099"
assert BASE.endswith(":8099"), "solo contra la copia"
SUPASS = open(sys.argv[1]).read().strip()  # la contraseña del superusuario de la copia

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

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")

resultados = []
def caso(nombre, esperado_ok, st):
    ok = (200 <= st < 300) == esperado_ok
    resultados.append(ok)
    print(("OK  " if ok else "FALLA"), nombre, f"(HTTP {st})")

