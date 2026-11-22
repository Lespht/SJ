"""Avisos (NOS-37) contra la COPIA en 127.0.0.1:8099: un receptor falso en :8098 hace de servicio de
avisos y anota lo que PocketBase le pide. Se corre con tests/probar-reglas.sh."""
import datetime, json, sys, threading, time, urllib.parse, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer

from copia import BASE, PNG, SU, caso, req, resultados, usuario

SECRETO = "prueba-secreto"
recibidos = []

class Receptor(BaseHTTPRequestHandler):
    def do_POST(self):
        largo = int(self.headers.get("content-length", 0))
        recibidos.append({"clave": self.headers.get("x-avisos-clave"), **json.loads(self.rfile.read(largo))})
        self.send_response(202)
        self.end_headers()

    def log_message(self, *args):
        pass

servidor = HTTPServer(("127.0.0.1", 8098), Receptor)
threading.Thread(target=servidor.serve_forever, daemon=True).start()

def nuevos(accion):
    """Corre `accion` y devuelve los avisos que llegaron al receptor por ella."""
    antes = len(recibidos)
    accion()
    time.sleep(0.6)
    return recibidos[antes:]

def endpoints(aviso):
    return {s["endpoint"] for s in aviso["suscripciones"]}

print("\n# NOS-37 · avisos")
C, c_id = usuario("avisos-c")
D, d_id = usuario("avisos-d")
S = "/api/collections/suscripciones/records"
EC, ED = "https://push.example.test/prueba-c", "https://push.example.test/prueba-d"
req("POST", S, C, {"usuario": c_id, "endpoint": EC, "p256dh": "c", "auth": "c"})
req("POST", S, D, {"usuario": d_id, "endpoint": ED, "p256dh": "d", "auth": "d"})

r = nuevos(lambda: req("POST", "/api/collections/mensajes/records", C, {"autor": c_id, "texto": "[prueba] hola"}))
caso("un mensaje de C pide un aviso", True, 200 if len(r) == 1 else 0)
caso("el aviso del mensaje le llega a D y no a C", True, 200 if r and ED in endpoints(r[0]) and EC not in endpoints(r[0]) else 0)
caso("el aviso lleva la clave compartida", True, 200 if r and r[0]["clave"] == SECRETO else 0)
caso("el aviso dice quién escribió y qué", True, 200 if r and r[0]["aviso"] == {"titulo": "[prueba] avisos-c", "cuerpo": "[prueba] hola", "url": "/mensajes"} else 0)

P = "/api/collections/posts/records"
plan = {}
r = nuevos(lambda: plan.update(req("POST", P, C, {"tipo": "plan", "titulo": "[prueba] cine", "autor": c_id})[1]))
caso("un plan nuevo avisa que C lo propuso", True, 200 if r and r[0]["aviso"]["titulo"] == "[prueba] avisos-c propuso un plan" else 0)

r = nuevos(lambda: req("PATCH", f"{P}/{plan['id']}", D, {"texto": "[prueba] editado"}))
caso("editar un plan sin completarlo no avisa", True, 200 if not r else 0)
r = nuevos(lambda: req("PATCH", f"{P}/{plan['id']}", D, {"hecho": True}))
caso("completar el plan avisa, y no a quien lo completó", True, 200 if len(r) == 1 and r[0]["aviso"]["titulo"] == "«[prueba] cine» quedó hecho" and ED not in endpoints(r[0]) else 0)

r = nuevos(lambda: req("POST", "/api/collections/fotos/records", C, {"autor": c_id, "post": plan["id"]}, {"imagen": ("p.png", PNG, "image/png")}))
caso("una foto en un post recién creado no avisa aparte", True, 200 if not r else 0)

hace_10 = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
st, viejos = req("GET", P + "?perPage=1&filter=" + urllib.parse.quote(f"tipo='plan' && created < '{hace_10}'"), SU)
if viejos.get("items"):
    viejo = viejos["items"][0]["id"]
    foto = lambda: req("POST", "/api/collections/fotos/records", D, {"autor": d_id, "post": viejo}, {"imagen": ("p.png", PNG, "image/png")})
    r = nuevos(lambda: [foto() for _ in range(3)])
    caso("tres fotos sumadas a un plan viejo mandan un solo aviso", True, 200 if len(r) == 1 and "sumó fotos" in r[0]["aviso"]["titulo"] else 0)
else:
    print("(sin planes viejos en la copia: se salta el caso de fotos sumadas)")

hoy = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=6)).strftime("%Y-%m-%d")
req("POST", P, C, {"tipo": "plan", "titulo": "[prueba] hoy", "autor": c_id, "fecha": f"{hoy} 12:00:00.000Z", "hora": "21:00"})
time.sleep(0.6)
r = nuevos(lambda: req("POST", "/api/crons/avisos-recordatorio", SU))
hoy_avisos = [a for a in r if a["aviso"]["titulo"] == "Hoy: «[prueba] hoy»"]
caso("el recordatorio del día avisa a los dos, con la hora", True, 200 if hoy_avisos and hoy_avisos[0]["aviso"].get("cuerpo") == "A las 21:00" and {EC, ED} <= endpoints(hoy_avisos[0]) else 0)

V = "/api/avisos/vencidas"
st, _ = req("POST", V, None, {"endpoints": [ED]}); caso("vencidas sin la clave → 401", False, st)
def con_clave():
    r = urllib.request.Request(BASE + V, data=json.dumps({"endpoints": [ED]}).encode(), method="POST",
                               headers={"content-type": "application/json", "x-avisos-clave": SECRETO})
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
caso("vencidas con la clave borra la suscripción", True, con_clave())
st, lista = req("GET", S + "?filter=" + urllib.parse.quote(f"endpoint='{ED}'"), SU)
caso("la suscripción vencida ya no está", True, 200 if lista.get("totalItems") == 0 else 0)

servidor.shutdown()
print(f"\n{sum(resultados)}/{len(resultados)} avisos como se esperaba")
sys.exit(0 if all(resultados) else 1)
