import { useState, useEffect, useRef, useCallback } from "react";
import { db, auth } from "./firebase";
import {
  addDoc,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  getDocs,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import type { User } from "./models/User";
import type { Message } from "./models/Message";
import Loading from "./utils/Loading";

interface ChatBoxProps {
  selectedUser: User;
  onMenuClick: () => void;
}

const PAGE_SIZE = 30;

function ChatBox({ selectedUser, onMenuClick }: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false); // để biết đã scroll lần đầu chưa

  const currentUid = auth.currentUser?.uid || "";
  const friendUid = selectedUser.uid;
  const chatId = [currentUid, friendUid].sort().join("_");

  // utility: toMillis safe
  const tsToMillis = (t: any) => {
    try {
      return t?.toMillis?.() ?? 0;
    } catch {
      return 0;
    }
  };

  // helper: dedupe & sort asc by timestamp
  const dedupeAndSortAsc = (arr: Message[]) => {
    const map = new Map<string, Message>();
    // keep last occurrence (so that newer doc overwrites older if same id appears later)
    for (const m of arr) {
      map.set(m.id, m);
    }
    const unique = Array.from(map.values());
    unique.sort((a, b) => tsToMillis(a.timestamp) - tsToMillis(b.timestamp));
    return unique;
  };

  // ----------------------
  // Realtime listener: listen latest PAGE_SIZE messages (desc), then reverse -> display asc
  // ----------------------
  useEffect(() => {
    if (!currentUid || !friendUid) return;

    // reset
    setMessages([]);
    setHasMore(true);
    setLastDoc(null);
    initialLoadedRef.current = false;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "desc"),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs; // docs in desc order (newest -> oldest)
      const pageMsgs: Message[] = docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
      }));

      // reverse to asc (oldest -> newest) for display
      const pageAsc = pageMsgs.reverse();

      setMessages((prev) => {
        // merge prev (may contain older pages) + pageAsc (latest page)
        // We want to keep both without duplicates, then sort asc
        const merged = [...prev, ...pageAsc];
        return dedupeAndSortAsc(merged);
      });

      // lastDoc should be the oldest doc in this page (docs[docs.length-1]) for startAfter paging (desc queries)
      setLastDoc(docs[docs.length - 1] ?? null);
      setHasMore(docs.length === PAGE_SIZE);

      // decide whether to auto-scroll:
      // - if initial open -> scroll to bottom
      // - else if user is near bottom -> scroll to bottom when new messages arrive
      const ref = chatBoxRef.current;
      const nearBottom = ref
        ? ref.scrollHeight - ref.scrollTop - ref.clientHeight < 150
        : true;
      const shouldScroll = !initialLoadedRef.current || nearBottom;

      if (shouldScroll) {
        // wait next frame to ensure DOM updated
        requestAnimationFrame(() => {
          chatEndRef.current?.scrollIntoView({
            behavior: initialLoadedRef.current ? "smooth" : "auto",
          });
          initialLoadedRef.current = true;
        });
      } else {
        // don't change user's view; just mark initial loaded if not yet
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
        }
      }
    });

    return () => unsub();
  }, [chatId, currentUid, friendUid]);

  // ----------------------
  // Load older messages (paging)
  // ----------------------
  const loadMore = useCallback(async () => {
    if (!hasMore || !lastDoc || loadingMore) return;
    setLoadingMore(true);

    const ref = chatBoxRef.current;
    const prevScrollHeight = ref?.scrollHeight ?? 0;
    const prevScrollTop = ref?.scrollTop ?? 0;

    // query older pages: keep same orderBy desc, startAfter(lastDoc), limit
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "desc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(q);
    const docs = snap.docs;
    if (docs.length === 0) {
      setHasMore(false);
      setLoadingMore(false);
      return;
    }

    const pageMsgs: Message[] = docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Message, "id">),
    }));

    const pageAsc = pageMsgs.reverse(); // older -> less old -> ... (asc for prepending)

    // prepend and keep scroll position stable
    setMessages((prev) => {
      const merged = [...pageAsc, ...prev];
      const unique = dedupeAndSortAsc(merged);
      return unique;
    });

    // update lastDoc to the oldest doc in this newly fetched page (docs[docs.length-1])
    setLastDoc(docs[docs.length - 1] ?? null);
    setHasMore(docs.length === PAGE_SIZE);
    setLoadingMore(false);

    // after DOM updates, adjust scrollTop so that user stays at same message
    requestAnimationFrame(() => {
      const newHeight = ref?.scrollHeight ?? 0;
      if (ref) {
        // increase scrollTop by deltaHeight to keep view anchored
        ref.scrollTop = newHeight - prevScrollHeight + prevScrollTop;
      }
    });
  }, [chatId, hasMore, lastDoc, loadingMore]);

  // attach scroll handler for load more when scrolled near top
  useEffect(() => {
    const ref = chatBoxRef.current;
    if (!ref) return;
    const handler = () => {
      if (ref.scrollTop < 60 && hasMore && !loadingMore) {
        loadMore();
      }
    };
    ref.addEventListener("scroll", handler);
    return () => ref.removeEventListener("scroll", handler);
  }, [loadMore, hasMore, loadingMore]);

  // ----------------------
  // Send message
  // ----------------------
  const sendMessage = async () => {
    if (!text.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: text.trim(),
      senderId: currentUid,
      deleted: false,
      timestamp: serverTimestamp(),
    });

    // update chat meta
    await setDoc(
      doc(db, "chats", chatId),
      {
        participants: [currentUid, friendUid].sort(),
        lastMessage: text.trim(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setText("");

    // scroll to bottom (after snapshot updates usually)
    requestAnimationFrame(() => {
      // a small timeout can help ensure message appears
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    });
  };

  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center border-bottom p-2">
        <h5 className="mb-0 text-primary">
          <span className="me-2">
            <img
              className="rounded-circle"
              style={{
                width: 42,
                height: 42,
                objectFit: "cover",
              }}
              src={
                selectedUser.avatarUrl ||
                "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
              }
              alt="Ảnh đại diện người dùng"
            />
          </span>
          {selectedUser.name}
        </h5>
        <button className="btn btn-light d-md-none me-2" onClick={onMenuClick}>
          <i className="bi bi-list fs-4" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={chatBoxRef}
        className="flex-grow-1 p-3 overflow-auto bg-primary bg-opacity-10"
        style={{ minHeight: 0 }}
      >
        <div className="mt-3 text-center">
          <div>
            <img
              src={
                selectedUser.avatarUrl ||
                "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
              }
              alt="Ảnh đại diện"
              className="img-fluid rounded-circle mx-auto d-block mb-2"
              style={{ width: 100, height: 100, objectFit: "cover" }}
            />
          </div>

          <div className="mt-2 fs-5 fw-bold">
            {selectedUser.name || "Chưa có tên"}
          </div>
          <div className="mb-4">
            <em>{selectedUser.email}</em>
          </div>
        </div>
        {loadingMore && <Loading />}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`d-flex flex-column mb-2 ${
              m.senderId === currentUid
                ? "align-items-end"
                : "align-items-start"
            }`}
          >
            {/* Nội dung tin nhắn */}
            <div
              className={`p-2 rounded-3 shadow ${
                m.senderId === currentUid
                  ? "bg-success bg-opacity-75 text-white"
                  : "bg-white border"
              }`}
              style={{ maxWidth: "70%" }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>

            {/* Timestamp bên ngoài */}
            <small
              className="text-muted mt-1 mx-1"
              style={{ fontSize: "0.75rem" }}
            >
              {m.timestamp
                ? m.timestamp.toDate().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </small>
          </div>
        ))}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 d-flex">
        <button className="btn btn-light me-2">
          <i className="bi bi-image"></i>
        </button>

        <div className="input-group">
          <input
            type="text"
            className="form-control rounded-pill me-2"
            placeholder="Nhập tin nhắn..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            className="btn btn-success rounded-pill"
            onClick={sendMessage}
          >
            <i className="bi bi-send" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBox;
