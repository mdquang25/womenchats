import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import type { User } from "./models/User";
import type { Message } from "./models/Message";

interface ChatProps {
  selectedUser: User;
}

function Chat({ selectedUser }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Create chatId (consistent for both users)
  const currentUid = auth.currentUser?.uid || "";
  const friendUid = selectedUser.uid;
  const chatId = [currentUid, friendUid].sort().join("_");

  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Message, "id">),
        }))
      );
    });
    return () => unsub();
  }, [chatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    // Add message
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: currentUid,
      deleted: false,
      timestamp: serverTimestamp(),
    });
    // Update chat meta
    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [currentUid, friendUid].sort(),
        lastMessage: text,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setText("");
  };

  // Ensure chat meta exists on first open (optional, for new chats)
  useEffect(() => {
    const ensureChatMeta = async () => {
      const chatDocRef = doc(db, "chats", chatId);
      const chatDoc = await getDoc(chatDocRef);
      if (!chatDoc.exists()) {
        await setDoc(chatDocRef, {
          participants: [currentUid, friendUid].sort(),
          lastMessage: "",
          updatedAt: serverTimestamp(),
        });
      }
    };
    if (currentUid && friendUid) ensureChatMeta();
    // eslint-disable-next-line
  }, [chatId]);

  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center border-bottom p-2">
        <h5 className="mb-0 text-primary">💬 Chat with {selectedUser.name}</h5>
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => signOut(auth)}
        >
          Logout
        </button>
      </div>

      {/* Messages */}
      <div className="flex-grow-1 p-3 overflow-auto">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`d-flex mb-2 ${
              m.senderId === currentUid
                ? "justify-content-end"
                : "justify-content-start"
            }`}
          >
            <div
              className={`p-2 rounded-3 shadow-sm ${
                m.senderId === currentUid
                  ? "bg-primary text-white"
                  : "bg-white border"
              }`}
              style={{ maxWidth: "70%" }}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="border-top p-2">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button className="btn btn-primary" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;
