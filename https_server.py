import socketio
import ssl
from aiohttp import web
import os

sio = socketio.AsyncServer(async_mode="aiohttp", cors_allowed_origins="*")
app = web.Application()
sio.attach(app)

# Statik dosyaların bulunduğu dizini belirtin
static_files_directory = os.path.join(os.path.dirname(__file__), "static")

# Statik dosyaları servis etmek için bir yol ekleyin
app.router.add_static("/static", static_files_directory)


# Ana sayfayı servis etmek için bir işlev ekleyin
async def index(request):
    with open(os.path.join(static_files_directory, "index.html")) as f:
        return web.Response(text=f.read(), content_type="text/html")


# Ana sayfa için bir yol ekleyin
app.router.add_get("/", index)


@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")


@sio.event
async def offer(sid, data):
    await sio.emit("offer", data, skip_sid=sid)


@sio.event
async def answer(sid, data):
    await sio.emit("answer", data, skip_sid=sid)


@sio.event
async def ice_candidate(sid, data):
    await sio.emit("ice_candidate", data, skip_sid=sid)


# SSL sertifikalarının yollarını belirleyin
cert_path = os.path.expanduser("~/cert.pem")
key_path = os.path.expanduser("~/key.pem")

ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
ssl_context.load_cert_chain(cert_path, key_path)

if __name__ == "__main__":
    web.run_app(app, host="0.0.0.0", port=8000, ssl_context=ssl_context)
