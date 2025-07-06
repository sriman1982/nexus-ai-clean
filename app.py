from flask import Flask, request, jsonify, send_from_directory
import pyodbc, uuid, os
from datetime import datetime
from openai import OpenAI
from pathlib import Path

env_path = Path("D:/Nexus ai/.env")
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            if line.startswith("OPENAI_API_KEY="):
                key = line.strip().split("=", 1)[1]
                os.environ["OPENAI_API_KEY"] = key

app = Flask(__name__)

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=172.31.0.7,1433;DATABASE=Cash_management;UID=sa;PWD=Admin@123!'
)

def get_cursor():
    return conn.cursor()

@app.route("/getEmail", methods=["GET"])
def get_email():
    return jsonify({"email": "testuser@example.com"})

@app.route("/getConversations", methods=["GET"])
def get_conversations():
    email = request.args.get("email", "testuser@example.com")
    cur = get_cursor()
    cur.execute("SELECT conversation_id, title, created_at FROM Conversations WHERE user_email = ?", email)
    return jsonify([{
        "conversation_id": str(r.conversation_id),
        "title": r.title,
        "created_at": r.created_at.strftime("%Y-%m-%dT%H:%M:%S") if r.created_at else ""
    } for r in cur.fetchall()])

@app.route("/createConversation", methods=["POST"])
def create_conversation():
    data = request.json
    conv_id = str(uuid.uuid4())
    cur = get_cursor()
    cur.execute("INSERT INTO Conversations (conversation_id, user_email, title, created_at) VALUES (?, ?, ?, ?)",
                conv_id, data.get("user_email"), data.get("title"), datetime.now())
    conn.commit()
    return jsonify({"conversation_id": conv_id})

@app.route("/getMessages/<conv_id>", methods=["GET"])
def get_messages(conv_id):
    cur = get_cursor()
    cur.execute("SELECT sender_role, message_text, created_at FROM Messages WHERE conversation_id = ? ORDER BY created_at", conv_id)
    return jsonify([{
        "sender_role": r.sender_role,
        "message_text": r.message_text,
        "created_at": r.created_at.isoformat()
    } for r in cur.fetchall()])

@app.route("/sendMessage", methods=["POST"])
def send_message():
    data = request.json
    cur = get_cursor()
    message_id = str(uuid.uuid4())
    cur.execute("INSERT INTO Messages VALUES (?, ?, ?, ?, ?, ?)",
                message_id, data.get("conversation_id"), "user", data.get("message_text"), "sent", datetime.now())
    cur.execute("SELECT sender_role, message_text FROM Messages WHERE conversation_id = ? ORDER BY created_at", data.get("conversation_id"))
    history = [{"role": "user" if r.sender_role == "user" else "assistant", "content": r.message_text} for r in cur.fetchall()]
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=history
    )
    reply_text = completion.choices[0].message.content
    reply_id = str(uuid.uuid4())
    cur.execute("INSERT INTO Messages VALUES (?, ?, ?, ?, ?, ?)",
                reply_id, data.get("conversation_id"), "assistant", reply_text, "sent", datetime.now())
    conn.commit()
    return jsonify({"reply": reply_text})

@app.route("/renameConversation", methods=["POST"])
def rename():
    d = request.json
    cur = get_cursor()
    cur.execute("UPDATE Conversations SET title = ? WHERE conversation_id = ?", d.get("title"), d.get("conversation_id"))
    conn.commit()
    return jsonify({"status": "renamed"})

@app.route("/deleteConversation", methods=["POST"])
def delete():
    cid = request.json.get("conversation_id")
    cur = get_cursor()
    cur.execute("DELETE FROM Messages WHERE conversation_id = ?", cid)
    cur.execute("DELETE FROM Conversations WHERE conversation_id = ?", cid)
    conn.commit()
    return jsonify({"status": "deleted"})

@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory("static", path)

if __name__ == "__main__":
    app.run(debug=True)
