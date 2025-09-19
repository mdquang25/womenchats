import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit as fsLimit,
} from "firebase/firestore";
import Loading from "../utils/Loading";
import type { User } from "../models/User";
import type { Friendship } from "../models/Friendship";

interface ChatListProps {
  onSelectUser: (user: User) => void;
}

interface FriendWithPreview extends User {
  lastMsgTime: number;
  lastMsgText: string;
}

function ChatList({ onSelectUser }: ChatListProps) {
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<FriendWithPreview[]>([]);
  const [filtered, setFiltered] = useState<FriendWithPreview[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUid) return;
      setLoading(true);

      // 1. Get all accepted friendships for current user
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

      // 3. Fetch user info for each friend
      const usersQuery = query(
        collection(db, "users"),
        where("__name__", "in", friendUids)
      );
      const usersSnap = await getDocs(usersQuery);
      const users: User[] = usersSnap.docs.map((doc) => ({
        uid: doc.id,
        ...(doc.data() as Omit<User, "uid">),
      }));

      // 4. For each friend, get last message
      const friendsWithPreview: FriendWithPreview[] = await Promise.all(
        users.map(async (user) => {
          const chatId = [currentUid, user.uid].sort().join("_");
          const msgQuery = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "desc"),
            fsLimit(1)
          );
          const msgSnap = await getDocs(msgQuery);
          let lastMsgTime = 0;
          let lastMsgText = "";
          if (!msgSnap.empty) {
            const msg = msgSnap.docs[0].data();
            lastMsgTime = msg.timestamp?.toMillis?.() || 0;
            lastMsgText = msg.text || "";
          }
          return {
            ...user,
            lastMsgTime,
            lastMsgText,
          };
        })
      );

      // 5. Sort by lastMsgTime desc
      friendsWithPreview.sort((a, b) => b.lastMsgTime - a.lastMsgTime);

      setFriends(friendsWithPreview);
      setFiltered(friendsWithPreview);
      setLoading(false);
    };

    fetchFriends();
  }, [currentUid]);

  // filter as you type
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
    <div className="flex-1 d-flex p-2 flex-column border-end bg-white">
      {/* Search */}
      <div className="p-3 border-bottom">
        <input
          type="text"
          className="form-control"
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Friends List */}
      <div className="flex-grow-1 overflow-auto">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <div className="p-3 text-muted text-center">No friends found</div>
        ) : (
          filtered.map((user) => (
            <div
              key={user.uid}
              className="p-2 border-bottom d-flex align-items-center hover-bg"
              style={{ cursor: "pointer" }}
              onClick={() => onSelectUser(user)}
            >
              <div
                className="rounded-circle bg-primary text-white d-flex justify-content-center align-items-center me-2"
                style={{ width: "36px", height: "36px" }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="fw-bold">{user.name || user.email}</div>
                <small className="text-muted">
                  {user.lastMsgText
                    ? user.lastMsgText.length > 32
                      ? user.lastMsgText.slice(0, 32) + "..."
                      : user.lastMsgText
                    : "No messages yet"}
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
