import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import type { DocumentData } from "firebase/firestore";
import type { User } from "./models/User";
import type { Message } from "./models/Message";
import Loading from "./utils/Loading";

interface ChatBoxProps {
  selectedUser: User;
  onMenuClick: () => void;
}

const PAGE_SIZE = 30;

// local message type to allow optional imageUrl
type LocalMessage = Message & { imageUrl?: string };

function ChatBox({ selectedUser, onMenuClick }: ChatBoxProps) {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [text, setText] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false); // để biết đã scroll lần đầu chưa
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);

  // derive images list from messages (ordered asc)
  const images = useMemo(
    () =>
      messages
        .filter((m) => m.imageUrl)
        .map((m) => ({ id: m.id, url: m.imageUrl! })),
    [messages]
  );

  // Image viewer helpers
  const openImageViewer = (index: number) => {
    if (index < 0 || index >= images.length) return;
    setImageViewerIndex(index);
    setImageZoom(1);
    setImageViewerOpen(true);
  };

  const closeImageViewer = () => {
    setImageViewerOpen(false);
    setImageZoom(1);
  };

  const showNextImage = () =>
    setImageViewerIndex((i) => (i < images.length - 1 ? i + 1 : i));
  const showPrevImage = () => setImageViewerIndex((i) => (i > 0 ? i - 1 : i));

  const zoomIn = () => setImageZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setImageZoom((z) => Math.max(z - 0.25, 0.25));
  const resetZoom = () => setImageZoom(1);

  // keyboard navigation for viewer
  useEffect(() => {
    if (!imageViewerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImageViewer();
      if (e.key === "ArrowRight") showNextImage();
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "+" || e.key === "=") zoomIn();
      if (e.key === "-") zoomOut();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imageViewerOpen, images.length]);

  const downloadImage = async (url?: string) => {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      // try to infer extension
      const ext = (url.split(".").pop() || "jpg").split(/\?|#/)[0];
      a.download = `image_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Download failed", err);
    }
  };

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
  const dedupeAndSortAsc = (arr: LocalMessage[]) => {
    const map = new Map<string, LocalMessage>();
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
      const pageMsgs: LocalMessage[] = docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Message, "id">),
        ...(d.data() as { imageUrl?: string }),
      }));

      // reverse to asc (oldest -> newest) for display
      const pageAsc = pageMsgs.reverse();

      setMessages((prev) => {
        // merge prev (may contain older pages) + pageAsc (latest page)
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

    const pageMsgs: LocalMessage[] = docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Message, "id">),
      ...(d.data() as { imageUrl?: string }),
    }));

    const pageAsc = pageMsgs.reverse(); // older -> less old -> ... (asc for prepending)

    // prepend and keep scroll position stable
    setMessages((prev) => {
      const merged = [...pageAsc, ...prev];
      const unique = dedupeAndSortAsc(merged);
      return unique;
    });

    setLastDoc(docs[docs.length - 1] ?? null);
    setHasMore(docs.length === PAGE_SIZE);
    setLoadingMore(false);

    // after DOM updates, adjust scrollTop so that user stays at same message
    requestAnimationFrame(() => {
      const newHeight = ref?.scrollHeight ?? 0;
      if (ref) {
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
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 60);
    });
  };

  // ----------------------
  // Image upload / send
  // ----------------------
  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.currentTarget.value = ""; // clear selection
    await uploadAndSendImage(file);
  };

  const uploadAndSendImage = async (file: File) => {
    if (!chatId || !currentUid) return;
    try {
      setUploading(true);
      setUploadProgress(0);

      const storage = getStorage();
      const path = `/chat_media/${chatId}/${Date.now()}_${file.name}`;
      const imgRef = storageRef(storage, path);
      const uploadTask = uploadBytesResumable(imgRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const prog = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          setUploadProgress(prog);
        },
        (err) => {
          console.error("Upload error", err);
          setUploading(false);
          setUploadProgress(null);
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);

          // send image message (text optional)
          await addDoc(collection(db, "chats", chatId, "messages"), {
            text: "", // no text
            imageUrl: url,
            senderId: currentUid,
            deleted: false,
            timestamp: serverTimestamp(),
          });

          // update chat meta (show image placeholder)
          await setDoc(
            doc(db, "chats", chatId),
            {
              participants: [currentUid, friendUid].sort(),
              lastMessage: "[Image]",
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          // scroll to bottom after send
          requestAnimationFrame(() => {
            setTimeout(() => {
              chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 120);
          });

          setUploading(false);
          setUploadProgress(null);
        }
      );
    } catch (err) {
      console.error(err);
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // // Ensure chat meta exists on first open (optional, for new chats)
  // useEffect(() => {
  //   const ensureChatMeta = async () => {
  //     const chatDocRef = doc(db, "chats", chatId);
  //     const chatDoc = await getDocs(collection(db, "chats")); // no-op guard
  //     // keep previous behavior: create chat doc only when writing messages/setting meta
  //   };
  //   // noop - existing flows create meta when sending
  //   // eslint-disable-next-line
  // }, [chatId]);

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
        {messages.map((m) => {
          // compute image index if this message contains image
          const imgIndex = m.imageUrl
            ? images.findIndex((img) => img.id === m.id)
            : -1;
          return (
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
                {m.imageUrl ? (
                  <img
                    src={m.imageUrl}
                    alt="sent"
                    className="img-fluid rounded mb-2"
                    style={{
                      maxWidth: "200px",
                      height: "auto",
                      cursor: "zoom-in",
                    }}
                    onClick={() => imgIndex >= 0 && openImageViewer(imgIndex)}
                  />
                ) : null}
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
          );
        })}

        <div ref={chatEndRef} />
      </div>

      {/* Image viewer overlay */}
      {imageViewerOpen && images.length > 0 && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 2000, background: "rgba(0,0,0,0.8)" }}
          onClick={(e) => {
            // close when clicking backdrop (not the image area)
            if (e.target === e.currentTarget) closeImageViewer();
          }}
        >
          <div
            className="position-relative bg-dark text-white"
            style={{
              width: "90%",
              height: "90%",
              maxWidth: 1200,
              maxHeight: 900,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Toolbar */}
            <div className="d-flex justify-content-between align-items-center p-2 border-bottom">
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={showPrevImage}
                  disabled={imageViewerIndex === 0}
                >
                  <i className="bi bi-chevron-left" />
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={showNextImage}
                  disabled={imageViewerIndex === images.length - 1}
                >
                  <i className="bi bi-chevron-right" />
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={zoomOut}
                  title="Zoom out"
                >
                  -
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={resetZoom}
                  title="Reset zoom"
                >
                  100%
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={zoomIn}
                  title="Zoom in"
                >
                  +
                </button>
              </div>

              <div className="d-flex gap-2 align-items-center">
                <button
                  className="btn btn-sm btn-outline-light"
                  onClick={() => downloadImage(images[imageViewerIndex].url)}
                  title="Download image"
                >
                  <i className="bi bi-download" />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={closeImageViewer}
                  title="Close"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>

            {/* Image container with scrollbars if overflow */}
            <div
              className="flex-grow-1 d-flex align-items-center justify-content-center"
              style={{ overflow: "auto", background: "#111" }}
            >
              <div
                style={{
                  transform: `scale(${imageZoom})`,
                  transformOrigin: "center center",
                  display: "inline-block",
                }}
              >
                <img
                  src={images[imageViewerIndex].url}
                  alt="preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "80vh",
                    display: "block",
                    margin: "0 auto",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
            {/* footer: show index */}
            <div className="p-2 text-center text-white-50 small border-top">
              {imageViewerIndex + 1} / {images.length}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 d-flex align-items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          className="btn btn-light me-2"
          onClick={handleImageClick}
          disabled={uploading}
          title="Send image"
        >
          <i className="bi bi-image"></i>
        </button>

        {uploading && uploadProgress != null && (
          <div className="me-2">
            <div className="progress" style={{ width: 120, height: 8 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${uploadProgress}%` }}
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

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
