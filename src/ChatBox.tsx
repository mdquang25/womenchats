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
  updateDoc,
  getDoc, // <-- added
} from "firebase/firestore";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject, // <-- added
} from "firebase/storage";
import type { User } from "./models/User";
import type { Message } from "./models/Message";
import Loading from "./utils/Loading";
import { motion, AnimatePresence } from "framer-motion";

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

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // hover / edit / delete UI state
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const initialLoadedRef = useRef(false); // để biết đã scroll lần đầu chưa
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image viewer state
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(1);
  const [viewerActive, setViewerActive] = useState(true);
  const [viewerDirection, setViewerDirection] = useState<"next" | "prev">(
    "next"
  );

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

  const showNextImage = () => {
    setViewerDirection("next");
    setImageViewerIndex((i) => (i < images.length - 1 ? i + 1 : i));
  };

  const showPrevImage = () => {
    setViewerDirection("prev");
    setImageViewerIndex((i) => (i > 0 ? i - 1 : i));
  };

  const zoomIn = () => setImageZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setImageZoom((z) => Math.max(z - 0.25, 0.25));
  const resetZoom = () => setImageZoom(1);

  useEffect(() => {
    if (!imageViewerOpen) return;
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setViewerActive(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setViewerActive(false), 3000);
    };
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      clearTimeout(timeout);
    };
  }, [imageViewerOpen]);

  // keyboard navigation for viewer
  useEffect(() => {
    if (!imageViewerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeImageViewer();
      if (e.key === "ArrowRight") showNextImage();
      if (e.key === "ArrowLeft") showPrevImage();
      if (e.key === "+" || e.key === "=" || e.key === "ArrowUp") zoomIn();
      if (e.key === "-" || e.key === "ArrowDown") zoomOut();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imageViewerOpen, images.length]);

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
        // wait next frame to ensure DOM updated, then scroll reliably
        requestAnimationFrame(() => {
          scrollToBottomReliable(initialLoadedRef.current ? "smooth" : "auto");
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

    const pageMsgs: Message[] = docs.map((d) => ({
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
      edited: false,
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
  // Edit / Delete handlers
  // ----------------------
  const startEdit = (m: Message) => {
    setEditingMsgId(m.id);
    setEditingText(m.text || "");
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditingText("");
  };

  const saveEdit = async (m: Message) => {
    if (!editingMsgId || editingText.trim() === "") {
      cancelEdit();
      return;
    }
    try {
      await updateDoc(doc(db, "chats", chatId, "messages", m.id), {
        text: editingText.trim(),
        deleted: false,
        edited: true,
      });
    } catch (err) {
      console.error("Edit failed", err);
    } finally {
      cancelEdit();
    }
  };

  const confirmDelete = (id: string) => setDeleteConfirmId(id);

  const doDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      // read message to get imageUrl (if any)
      const msgRef = doc(db, "chats", chatId, "messages", deleteConfirmId);
      const msgSnap = await getDoc(msgRef);
      const data = msgSnap.exists() ? (msgSnap.data() as any) : null;
      const imageUrl: string | undefined = data?.imageUrl;

      // delete image from storage if present
      if (imageUrl) {
        try {
          const storage = getStorage();
          const imgRef = storageRef(storage, imageUrl);
          await deleteObject(imgRef);
        } catch (err) {
          // not fatal — log and continue
          console.warn("Failed to delete image from storage:", err);
        }
      }

      // mark message deleted in firestore (keep metadata)
      await updateDoc(msgRef, {
        deleted: true,
        imageUrl: null,
      });
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const cancelDelete = () => setDeleteConfirmId(null);

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

  // reliable scroll-to-bottom that waits for DOM/images to settle
  const scrollToBottomReliable = (behavior: ScrollBehavior = "auto") => {
    const ref = chatBoxRef.current;
    if (!ref) return;

    const doScroll = (useSmooth = false) => {
      try {
        if (useSmooth && "scrollTo" in ref) {
          ref.scrollTo({ top: ref.scrollHeight, behavior: "smooth" });
        } else {
          // instant
          ref.scrollTop = ref.scrollHeight;
        }
      } catch {
        ref.scrollTop = ref.scrollHeight;
      }
    };

    // if there are images not loaded yet, wait for them before final scroll
    const imgs = Array.from(ref.querySelectorAll("img"));
    const pending = imgs.filter((i) => !i.complete);
    if (pending.length > 0) {
      // wait for images to load (or error), then try a few times to ensure bottom
      const promises = pending.map(
        (img) =>
          new Promise<void>((res) => {
            const onDone = () => {
              img.removeEventListener("load", onDone);
              img.removeEventListener("error", onDone);
              res();
            };
            img.addEventListener("load", onDone);
            img.addEventListener("error", onDone);
            // fallback: resolve after 2s in case events don't fire
            setTimeout(onDone, 2000);
          })
      );
      Promise.all(promises).then(() => {
        // try multiple frames to let layout stabilize
        let tries = 0;
        const attempt = () => {
          doScroll(behavior === "smooth");
          tries++;
          const atBottom =
            ref.scrollHeight - ref.scrollTop - ref.clientHeight < 6;
          if (!atBottom && tries < 6) {
            requestAnimationFrame(() => setTimeout(attempt, 60));
          }
        };
        attempt();
      });
      return;
    }

    // no pending images -> attempt immediate + a few retries
    let tries = 0;
    const attempt = () => {
      doScroll(behavior === "smooth");
      tries++;
      const atBottom = ref.scrollHeight - ref.scrollTop - ref.clientHeight < 6;
      if (!atBottom && tries < 6) {
        requestAnimationFrame(() => setTimeout(attempt, 50));
      }
    };
    attempt();
  };

  // ----------------------
  // UI render
  // ----------------------
  return (
    <div className="d-flex flex-column h-100">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center border-bottom p-2">
        <h5 className="mb-0 text-primary d-flex align-items-center gap-2">
          <img
            className="rounded-circle"
            style={{ width: 42, height: 42, objectFit: "cover" }}
            src={
              selectedUser.avatarUrl ||
              "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
            }
            alt="Ảnh đại diện người dùng"
          />
          <span className="fw-semibold">{selectedUser.name}</span>
        </h5>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-outline-secondary d-md-none"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <i className="bi bi-list" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={chatBoxRef}
        className="flex-grow-1 p-3 overflow-auto bg-primary bg-opacity-10"
        style={{ minHeight: 0 }}
      >
        <div className="mt-3 text-center">
          <img
            src={
              selectedUser.avatarUrl ||
              "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
            }
            alt="Ảnh đại diện"
            className="img-fluid rounded-circle mx-auto d-block mb-2"
            style={{ width: 100, height: 100, objectFit: "cover" }}
          />

          <div className="mt-2 fs-5 fw-bold">
            {selectedUser.name || "Chưa có tên"}
          </div>
          <div className="mb-4">
            <em>{selectedUser.email}</em>
          </div>
        </div>

        {loadingMore && <Loading />}

        {messages.map((m) => {
          const isMine = m.senderId === currentUid;
          const tsMs = m.timestamp?.toMillis?.() ?? 0;
          const canEdit =
            isMine && Date.now() - tsMs <= EDIT_WINDOW_MS && !m.deleted;
          const imgIndex = m.imageUrl
            ? images.findIndex((img) => img.id === m.id)
            : -1;

          return (
            <div
              key={m.id}
              className={`d-flex flex-column mb-3 ${
                isMine ? "align-items-end" : "align-items-start"
              }`}
              onMouseEnter={() => setHoveredMsgId(m.id)}
              onMouseLeave={() =>
                setHoveredMsgId((id) => (id === m.id ? null : id))
              }
            >
              {/* message bubble + actions */}
              <div style={{ position: "relative", maxWidth: "70%" }}>
                <div
                  className={`${m.imageUrl ? "" : "p-2"} rounded-3 shadow ${
                    isMine
                      ? "bg-success bg-opacity-80 text-white"
                      : "bg-white border"
                  }`}
                  style={{ wordBreak: "break-word" }}
                >
                  {m.deleted ? (
                    <em className="text-muted">tin nhắn đã bị xóa</em>
                  ) : editingMsgId === m.id ? (
                    <div className="d-flex flex-column gap-2 align-items-center">
                      <input
                        className="form-control form-control-sm"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                      />
                      <div className="btn-group">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => saveEdit(m)}
                        >
                          Lưu
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={cancelEdit}
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt="sent"
                          className="img-fluid rounded"
                          style={{
                            display: "block",
                            margin: "0 auto",
                            objectFit: "contain",
                            width: "100%",
                            maxWidth: "320px",
                            height: "auto",
                            cursor: "zoom-in",
                          }}
                          onClick={() =>
                            imgIndex >= 0 && openImageViewer(imgIndex)
                          }
                        />
                      )}

                      <div style={{ whiteSpace: "pre-wrap" }}>
                        {m.text}
                        {m.edited && !m.deleted ? (
                          <small
                            className={`ms-2 ${
                              isMine ? "text-white-50" : "text-muted"
                            }`}
                            style={{ fontStyle: "italic" }}
                          >
                            (edited)
                          </small>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>

                {/* hover actions for own, not deleted */}
                {isMine && !m.deleted && hoveredMsgId === m.id && (
                  <div
                    style={{
                      position: "absolute",
                      right: -6,
                      top: -6,
                      zIndex: 60,
                    }}
                  >
                    <div
                      className="btn-group shadow-sm"
                      role="group"
                      aria-label="message actions"
                    >
                      {canEdit && (
                        <button
                          className="btn btn-sm btn-light"
                          onClick={() => startEdit(m)}
                          title="Edit"
                        >
                          <i className="bi bi-pencil" />
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-light text-danger"
                        onClick={() => confirmDelete(m.id)}
                        title="Delete"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* timestamp */}
              <small className="text-muted mt-1" style={{ fontSize: 12 }}>
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

      {/* Image viewer overlay (animated) */}
      <AnimatePresence>
        {imageViewerOpen && images.length > 0 && (
          <motion.div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{
              zIndex: 2000,
              background: "rgba(0,0,0,0.9)",
              backdropFilter: "blur(4px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeImageViewer();
            }}
            onMouseMove={() => setViewerActive(true)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="position-relative bg-dark text-white d-flex flex-column"
              style={{ width: "100%", height: "100%" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* TOP-MID: index */}
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 2100,
                  pointerEvents: "none",
                }}
              >
                <motion.div
                  className="badge bg-dark text-white"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 0.9, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {imageViewerIndex + 1} / {images.length}
                </motion.div>
              </div>

              {/* Navigation buttons */}
              <AnimatePresence>
                {viewerActive && (
                  <>
                    {/* Prev */}
                    <motion.button
                      key="prev"
                      className="btn btn-light shadow position-absolute"
                      style={{
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 2100,
                        width: 48,
                        height: 48,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: imageViewerIndex === 0 ? 0.4 : 1,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        showPrevImage();
                      }}
                      disabled={imageViewerIndex === 0}
                    >
                      <i
                        className="bi bi-chevron-left"
                        style={{ fontSize: 20 }}
                      />
                    </motion.button>

                    {/* Next */}
                    <motion.button
                      key="next"
                      className="btn btn-light shadow position-absolute"
                      style={{
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        zIndex: 2100,
                        width: 48,
                        height: 48,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity:
                          imageViewerIndex === images.length - 1 ? 0.4 : 1,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        showNextImage();
                      }}
                      disabled={imageViewerIndex === images.length - 1}
                    >
                      <i
                        className="bi bi-chevron-right"
                        style={{ fontSize: 20 }}
                      />
                    </motion.button>
                  </>
                )}
              </AnimatePresence>

              {/* Image container */}
              <div
                className="flex-grow-1 d-flex align-items-center justify-content-center"
                style={{ overflow: "hidden", background: "#000" }}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={images[imageViewerIndex].url}
                    src={images[imageViewerIndex].url}
                    alt="preview"
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      resetZoom();
                    }}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100vh",
                      objectFit: "contain",
                      cursor: imageZoom > 1 ? "grab" : "zoom-in",
                    }}
                    initial={{
                      opacity: 0,
                      x: viewerDirection === "next" ? 100 : -100,
                      scale: imageZoom, // thêm để giữ đồng bộ zoom ban đầu
                    }}
                    animate={{
                      opacity: 1,
                      x: 0,
                      scale: imageZoom, // 👈 zoom giờ nằm ở đây
                    }}
                    exit={{
                      opacity: 0,
                      x: viewerDirection === "next" ? -100 : 100,
                      scale: imageZoom, // đảm bảo không reset scale khi out
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  />
                </AnimatePresence>
              </div>

              {/* Zoom controls */}
              <AnimatePresence>
                {viewerActive && (
                  <motion.div
                    key="zoomControls"
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 2100,
                    }}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="btn-group shadow">
                      <button
                        className="btn btn-sm btn-light"
                        onClick={(e) => {
                          e.stopPropagation();
                          zoomOut();
                        }}
                      >
                        -
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetZoom();
                        }}
                      >
                        {Math.round(imageZoom * 100)}%
                      </button>
                      <button
                        className="btn btn-sm btn-light"
                        onClick={(e) => {
                          e.stopPropagation();
                          zoomIn();
                        }}
                      >
                        +
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close button */}
              <AnimatePresence>
                {viewerActive && (
                  <motion.button
                    key="closeBtn"
                    className="btn btn-sm btn-danger position-absolute"
                    style={{ top: 8, right: 8, zIndex: 2100 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeImageViewer();
                    }}
                  >
                    <i className="bi bi-x-lg" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div
        className="p-2 p-md-3 d-flex gap-2 align-items-center border-top bg-white"
        style={{
          position: "sticky",
          bottom: 0,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <button
          className="btn btn-light"
          onClick={handleImageClick}
          disabled={uploading}
          title="Send image"
        >
          <i className="bi bi-image" />
        </button>

        {uploading && uploadProgress != null && (
          <div className="me-2">
            <div className="progress" style={{ width: 120, height: 8 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-grow-1">
          <div className="input-group">
            <input
              type="text"
              className="form-control rounded-pill"
              placeholder="Nhập tin nhắn..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              className="btn btn-success rounded-pill ms-2 px-3 py-2"
              style={{ flexShrink: 0 }}
              onClick={sendMessage}
              aria-label="Send"
            >
              <i className="bi bi-send" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div
          className="modal position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ zIndex: 2100, background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelDelete();
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Xác nhận xóa</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={cancelDelete}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <p>Bạn có chắc chắn muốn xóa tin nhắn này không?</p>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={cancelDelete}>
                  Hủy
                </button>
                <button className="btn btn-danger" onClick={doDelete}>
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatBox;
