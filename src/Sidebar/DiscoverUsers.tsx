import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  startAt,
  endAt,
  serverTimestamp,
} from "firebase/firestore";
import type { User } from "../models/User";
import type { Friendship } from "../models/Friendship";
import Loading from "../utils/Loading";

const SUGGEST_LIMIT = 10;
const SEARCH_LIMIT = 10;

function DiscoverUsers() {
  const [suggested, setSuggested] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [relatedUids, setRelatedUids] = useState<Set<string>>(new Set());

  const currentUid = auth.currentUser?.uid;

  // Fetch related user UIDs (friends or pending)
  useEffect(() => {
    const fetchRelatedUids = async () => {
      if (!currentUid) return;
      const friendsQuery = query(
        collection(db, "friendships"),
        where("participants", "array-contains", currentUid)
      );
      const friendsSnap = await getDocs(friendsQuery);
      const friendships: Friendship[] = friendsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Friendship, "id">),
      }));
      const uids = new Set<string>();
      friendships.forEach((f) => {
        f.participants.forEach((uid) => {
          if (uid !== currentUid) uids.add(uid);
        });
      });
      setRelatedUids(uids);
    };
    fetchRelatedUids();
  }, [currentUid, sent]);

  // Fetch suggested users (not related, limited)
  useEffect(() => {
    const fetchSuggested = async () => {
      if (!currentUid || search.trim()) return;
      setLoading(true);
      const usersQuery = query(
        collection(db, "users"),
        orderBy("name"),
        limit(SUGGEST_LIMIT * 3)
      );
      const usersSnap = await getDocs(usersQuery);
      const users: User[] = usersSnap.docs
        .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) }))
        .filter((u) => u.uid !== currentUid && !relatedUids.has(u.uid))
        .slice(0, SUGGEST_LIMIT);
      setSuggested(users);
      setLoading(false);
    };
    fetchSuggested();
  }, [currentUid, relatedUids, search]);

  // Search users by name or email (limited)
  useEffect(() => {
    const fetchSearch = async () => {
      if (!currentUid || !search.trim()) return;
      setLoading(true);
      setSearch(search.trim());

      let users: User[];
      if (search.includes("@")) {
        // Exact match email
        const emailQuery = query(
          collection(db, "users"),
          where("email", "==", search),
          limit(1)
        );
        const emailSnap = await getDocs(emailQuery);
        users = emailSnap.docs
          .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) }))
          .filter((u) => u.uid !== currentUid && !relatedUids.has(u.uid));
      } else {
        // Prefix match name
        const nameQuery = query(
          collection(db, "users"),
          orderBy("name"),
          startAt(search),
          endAt(search + "\uf8ff"),
          limit(SEARCH_LIMIT)
        );
        const nameSnap = await getDocs(nameQuery);
        users = nameSnap.docs
          .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) }))
          .filter((u) => u.uid !== currentUid && !relatedUids.has(u.uid));
      }

      setSuggested(users);
      setLoading(false);
    };
    fetchSearch();
  }, [currentUid, relatedUids, search]);

  const handleSendRequest = async (user: User) => {
    if (!currentUid) return;
    setSending(user.uid);

    const friendshipId = [currentUid, user.uid].sort().join("_"); // tạo ID cố định
    await setDoc(doc(db, "friendships", friendshipId), {
      participants: [currentUid, user.uid].sort(),
      status: "pending",
      requestBy: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setSent((prev) => [...prev, user.uid]);
    setSending(null);
  };

  return (
    <div className="flex-1 d-flex h-100 p-2 flex-column border-end bg-white">
      <div className="fw-bold fs-6">Tìm kiếm bạn mới</div>
      <input
        className="form-control mb-3"
        placeholder="Nhập tên hoặc email.."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <Loading />
      ) : suggested.length === 0 ? (
        <div>No users found.</div>
      ) : (
        <ul className="list-group">
          {suggested.map((user) => (
            <li
              key={user.uid}
              className="card mt-2 shadow list-group-item d-flex flex-column"
            >
              <div>
                {/* <div className="text-muted" style={{ fontSize: 12 }}>
                  {user.email.length > 30
                    ? user.email.slice(0, 30) + "..."
                    : user.email}
                </div> */}
              </div>
              <div className="d-flex align-items-center justify-content-between mb-2">
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
                <button
                  className="btn btn-sm btn-primary"
                  disabled={sending === user.uid || sent.includes(user.uid)}
                  onClick={() => handleSendRequest(user)}
                >
                  {sent.includes(user.uid)
                    ? "Request Sent"
                    : sending === user.uid
                    ? "Sending..."
                    : "Add Friend"}
                </button>
              </div>
              <div className="fw-bold">{user.name}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DiscoverUsers;
