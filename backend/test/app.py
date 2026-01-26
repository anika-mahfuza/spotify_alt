from flask import Flask, request, jsonify, send_from_directory
import yt_dlp

app = Flask(__name__)

@app.route("/")
def home():
    return send_from_directory(".", "index.html")

def search_song(query):
    ydl_opts = {
        "format": "bestaudio/best",
        "noplaylist": True,
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(f"ytsearch1:{query}", download=False)
        video = info["entries"][0]
        return {
            "title": video["title"],
            "url": video["url"]
        }

@app.route("/search")
def search():
    q = request.args.get("q")
    return jsonify(search_song(q))

if __name__ == "__main__":
    app.run(port=5000, debug=True)
