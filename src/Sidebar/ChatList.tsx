import { useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import Loading from "../utils/Loading";
import type { User } from "../models/User";
import type { Friendship } from "../models/Friendship";
import type { Chat } from "../models/Chat";

interface ChatListProps {
  onSelectUser: (user: User) => void;
  show?: boolean;
}

interface FriendWithPreview extends User {
  lastMsgTime: number;
  lastMsgText: string;
}

function ChatList({ onSelectUser, show }: ChatListProps) {
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<FriendWithPreview[]>([]);
  const [filtered, setFiltered] = useState<FriendWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);

  const currentUid = auth.currentUser?.uid;

  // fetchFriends extracted so it can be called by button
  const fetchFriends = useCallback(async () => {
    if (!currentUid) return;
    setLoading(true);

    // 1. Get all accepted friendships
    const friendshipQuery = query(
      collection(db, "friendships"),
      where("participants", "array-contains", currentUid),
      where("status", "==", "accepted")
    );
    const friendshipSnap = await getDocs(friendshipQuery);
    const friendships: Friendship[] = friendshipSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Friendship, "id">),
    }));

    // 2. Get friend UIDs
    const friendUids = friendships
      .map((f) => f.participants.find((uid) => uid !== currentUid))
      .filter(Boolean) as string[];

    if (friendUids.length === 0) {
      setFriends([]);
      setFiltered([]);
      setLoading(false);
      return;
    }

    // 3. Fetch friend info
    const usersQuery = query(
      collection(db, "users"),
      where("__name__", "in", friendUids)
    );
    const usersSnap = await getDocs(usersQuery);
    const users: User[] = usersSnap.docs.map((doc) => ({
      uid: doc.id,
      ...(doc.data() as Omit<User, "uid">),
    }));

    // 4. Fetch chats to get last message
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUid),
      orderBy("updatedAt", "desc")
    );
    const chatsSnap = await getDocs(chatsQuery);
    const chats: Chat[] = chatsSnap.docs.map((doc) => ({
      cid: doc.id,
      ...(doc.data() as Omit<Chat, "cid">),
    }));

    // 5. Merge: attach lastMessage + updatedAt to each friend
    const friendsWithPreview: FriendWithPreview[] = users.map((user) => {
      const chatId = [currentUid, user.uid].sort().join("_");
      const chat = chats.find((c) => c.cid === chatId);
      return {
        ...user,
        lastMsgTime: chat?.updatedAt?.toMillis?.() || 0,
        lastMsgText: chat?.lastMessage || "Chưa có tin nhắn",
      };
    });

    // 6. Sort by lastMsgTime
    friendsWithPreview.sort((a, b) => b.lastMsgTime - a.lastMsgTime);

    setFriends(friendsWithPreview);
    setFiltered(friendsWithPreview);
    setLoading(false);
  }, [currentUid]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  // Filter by search
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(friends);
    } else {
      setFiltered(
        friends.filter(
          (u) =>
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            u.email.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, friends]);

  return (
    <div
      className={`flex-1 d-flex h-100 p-2 flex-column border-end bg-white ${
        show ? "" : "d-none"
      }`}
    >
      <div className="d-flex align-items-center justify-content-between p-2 border-bottom">
        <div className="fs-6 fw-bold">Cuộc trò chuyện</div>

        {/* Reload button beside title */}
        <div>
          <button
            className={`btn btn-sm ${
              loading ? "btn-warning shadow" : "btn-outline-secondary"
            }`}
            onClick={fetchFriends}
            disabled={loading}
            title="Làm mới"
          >
            <i className="bi bi-arrow-clockwise me-1" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-bottom">
        <input
          type="text"
          className="form-control"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Friends List */}
      <div className="flex-grow-1 overflow-auto">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <div className="p-3 text-muted text-center">
            Không tìm thấy cuộc trò chuyện
          </div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.uid}
              className={`p-2 border-bottom d-flex align-items-center`}
              style={{
                cursor: "pointer",
                backgroundColor:
                  selectedUid === user.uid ? "#e7f1ff" : "transparent", // 👈 hiệu ứng chọn
              }}
              onClick={() => {
                setSelectedUid(user.uid); // cập nhật state chọn
                onSelectUser(user);
              }}
            >
              <div className="me-1">
                <img
                  src={
                    user?.avatarUrl ||
                    "https://cdn2.fptshop.com.vn/unsafe/800x0/meme_cho_1_e568e5b1a5.jpg"
                  }
                  alt="Avatar"
                  className="img-fluid rounded-circle"
                  style={{ width: 36, height: 36, objectFit: "cover" }}
                />
              </div>
              <div>
                <div className="fw-bold">{user.name || user.email}</div>
                <small className="text-muted">
                  {user.lastMsgText.length > 24
                    ? user.lastMsgText.slice(0, 24) + "..."
                    : user.lastMsgText}
                </small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
export default ChatList;
