// =======================
// File: scripts.js (Client-side Logic)
// =======================

document.addEventListener("DOMContentLoaded", async () => {
  const sidebar = document.getElementById("sidebar");
  const sidebarScroll = document.getElementById("sidebar-scroll");
  const chatBox = document.getElementById("chat-box");
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const typingIndicator = document.getElementById("typing-indicator");

  let currentConvId = null;
  let userEmail = "";

  try {
    const res = await fetch("/getEmail");
    const json = await res.json();
    userEmail = json.email;
  } catch (e) {
    console.error("Failed to fetch user email", e);
    return;
  }

  const newChatBtn = document.createElement("button");
  newChatBtn.textContent = "+ New Chat";
  newChatBtn.className = "mb-4 w-full bg-blue-500 text-white py-2 rounded";
  newChatBtn.onclick = createNewConversation;
  sidebarScroll.appendChild(newChatBtn);
    sidebarScroll.style.overflowY = 'auto';

  async function loadConversations() {
    sidebarScroll.innerHTML = "";
    const newChatBtn = document.createElement("button");
    newChatBtn.textContent = "+ New Chat";
    newChatBtn.className = "mb-4 w-full bg-blue-500 text-white py-2 rounded";
    newChatBtn.onclick = createNewConversation;
    sidebarScroll.appendChild(newChatBtn);
    try {
      const conversations = await fetch(`/getConversations?email=${encodeURIComponent(userEmail)}`).then(r => r.json());
      conversations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(renderConversation);
    } catch (e) {
      console.error("Failed to load conversations", e);
    }
  }

  await loadConversations();

  async function createNewConversation() {
    const title = prompt("Enter conversation title:", "New Chat") || "Untitled";
    try {
      await fetch("/createConversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email: userEmail, title })
      });
      await loadConversations();
      chatBox.innerHTML = "";
    } catch (e) {
      console.error("Failed to create conversation", e);
    }
  }

  window.createNewConversation = createNewConversation;

  function renderConversation(conv) {
    const wrapper = document.createElement("div");
    wrapper.className = "group flex justify-between items-center p-2 mb-1 rounded hover:bg-blue-100 cursor-pointer";
    wrapper.setAttribute("data-id", conv.conversation_id);

    const container = document.createElement("div");
    container.className = "flex flex-col";

    const title = document.createElement("span");
    title.textContent = conv.title;
    title.className = "font-medium";

    const timestamp = document.createElement("span");
    let dateObj = new Date(conv.created_at);
    if (isNaN(dateObj)) dateObj = new Date();
    timestamp.textContent = dateObj.toLocaleString("en-IN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
    timestamp.className = "text-xs text-gray-400";

    container.appendChild(title);
    container.appendChild(timestamp);
    container.onclick = () => {
      document.querySelectorAll("#sidebar .group").forEach(el => el.classList.remove("bg-blue-100"));
      wrapper.classList.add("bg-blue-100");
      loadConversation(conv.conversation_id);
      currentConvId = conv.conversation_id;
      markActiveConversation(currentConvId);
    };

    const del = document.createElement("span");
    del.textContent = "❌";
    del.className = "opacity-0 group-hover:opacity-100 text-red-500 text-sm ml-2 cursor-pointer";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (confirm("Delete this chat?")) {
        try {
          await fetch("/deleteConversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_id: conv.conversation_id })
          });
          wrapper.remove();
          if (currentConvId === conv.conversation_id) {
            chatBox.innerHTML = "";
            currentConvId = null;
          }
        } catch (e) {
          console.error("Failed to delete conversation", e);
        }
      }
    };

    const rename = document.createElement("span");
    rename.textContent = "✏️";
    rename.className = "opacity-0 group-hover:opacity-100 text-yellow-500 text-sm ml-2 cursor-pointer";
    rename.onclick = async (e) => {
      e.stopPropagation();
      const newTitle = prompt("Enter new title:", conv.title);
      if (newTitle) {
        try {
          await fetch("/renameConversation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_id: conv.conversation_id, title: newTitle })
          });
          title.textContent = newTitle;
          showToast("Conversation renamed!");
          wrapper.classList.add("bg-yellow-100");
          setTimeout(() => wrapper.classList.remove("bg-yellow-100"), 1000);
        } catch (e) {
          console.error("Failed to rename conversation", e);
        }
      }
    };

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-2";
    actions.appendChild(rename);
    actions.appendChild(del);

    wrapper.appendChild(container);
    wrapper.appendChild(actions);
    const button = document.querySelector("#sidebar-scroll button");
    sidebarScroll.insertBefore(wrapper, button ? button.nextSibling : null);
  }

  function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 2000);
  }

  async function loadConversation(id) {
    try {
      const messages = await fetch(`/getMessages/${encodeURIComponent(id)}`).then(r => r.json());
      chatBox.innerHTML = "";
      let lastDate = null;
      messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toLocaleDateString();
        if (msgDate !== lastDate) {
          const dateDivider = document.createElement("div");
          dateDivider.textContent = new Date(msg.created_at).toLocaleDateString(undefined, {
            weekday: "short", year: "numeric", month: "short", day: "numeric"
          });
          dateDivider.className = "text-center text-gray-400 text-xs mb-2 mt-4 italic";
          chatBox.appendChild(dateDivider);
          lastDate = msgDate;
        }
        renderMessage(msg);
      });
      scrollToBottom();
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  }

  function renderMessage(msg) {
    const bubble = document.createElement("div");
    bubble.className = msg.sender_role === "user"
      ? "bg-blue-500 text-white p-3 rounded-2xl ml-auto max-w-[90%] sm:max-w-xl shadow-md"
      : "bg-white text-black p-3 rounded-2xl mr-auto max-w-[90%] sm:max-w-xl shadow message-left";

    const avatar = document.createElement("span");
    avatar.textContent = msg.sender_role === "user" ? "🧑" : "🤖";
    avatar.className = "text-xl mt-1";

    const content = document.createElement("div");
    content.textContent = msg.message_text;
    content.className = "whitespace-pre-wrap";

    const inner = document.createElement("div");
    inner.className = "flex items-start gap-2";
    inner.appendChild(avatar);
    inner.appendChild(content);
    bubble.appendChild(inner);

    let formattedTime = "";
    if (msg.created_at) {
      const dateObj = new Date(msg.created_at);
      const timeStr = dateObj.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const dateStr = dateObj.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
      formattedTime = `${timeStr} · ${dateStr}`;
    }

    const time = document.createElement("div");
    time.textContent = formattedTime;
    time.className = "text-xs text-gray-400 mt-1";

    const wrapper = document.createElement("div");
    wrapper.className = msg.sender_role === "user" ? "text-right mb-3" : "text-left mb-3";
    wrapper.appendChild(bubble);
    wrapper.appendChild(time);

    chatBox.appendChild(wrapper);
  }

  sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text || !currentConvId) return;
    const now = new Date().toISOString();
    input.value = "";
    renderMessage({ sender_role: "user", message_text: text, created_at: now });

    typingIndicator.classList.remove("hidden");
    scrollToBottom();

    try {
      const res = await fetch("/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: currentConvId, message_text: text })
      });

      const reply = await res.json();
      const replyTime = new Date().toISOString();
      renderMessage({ sender_role: "assistant", message_text: reply.reply || "(no response)", created_at: replyTime });
    } catch (e) {
      console.error("Failed to send message", e);
      renderMessage({ sender_role: "assistant", message_text: "(Failed to get response)", created_at: now });
    } finally {
      typingIndicator.classList.add("hidden");
      scrollToBottom();
    }
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  function scrollToBottom() {
    requestAnimationFrame(() => {
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  }
});
