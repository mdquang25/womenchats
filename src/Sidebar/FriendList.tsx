import { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import Loading from "../utils/Loading";
import type { User } from "../models/User";
import type { Friendship } from "../models/Friendship";

function FriendList() {
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<User[]>([]);
  const [filtered, setFiltered] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    const fetchFriends = async () => {
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

      setFriends(users);
      setFiltered(users);
      setLoading(false);
    };
    fetchFriends();
  }, [currentUid]);

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
    <div className="flex-1 d-flex h-100 p-2 flex-column border-end bg-white">
      <div className="fs-6 fw-bold p-2 border-bottom">Bạn bè</div>
      {/* Search */}
      <div className="p-2 border-bottom">
        <input
          type="text"
          className="form-control"
          placeholder="Tìm kiếm bạn bè..."
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
              className="p-2 border-bottom d-flex align-items-center item-hover"
              style={{
                cursor: "pointer",
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
                  style={{ minWidth: 36, height: 36, objectFit: "cover" }}
                />
              </div>
              <div>
                <div className="fw-bold">{user.name || user.email}</div>
                <small className="text-muted" title={user.email}>
                  {user.email}
                </small>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FriendList;
