import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
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

      // Search by name (prefix match)
      const nameQuery = query(
        collection(db, "users"),
        orderBy("name"),
        startAt(search),
        endAt(search + "\uf8ff"),
        limit(SEARCH_LIMIT)
      );
      const nameSnap = await getDocs(nameQuery);
      let users: User[] = nameSnap.docs
        .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) }))
        .filter((u) => u.uid !== currentUid && !relatedUids.has(u.uid));

      // If not enough, search by email as well
      if (users.length < SEARCH_LIMIT) {
        const emailQuery = query(
          collection(db, "users"),
          orderBy("email"),
          startAt(search),
          endAt(search + "\uf8ff"),
          limit(SEARCH_LIMIT)
        );
        const emailSnap = await getDocs(emailQuery);
        const emailUsers: User[] = emailSnap.docs
          .map((doc) => ({ uid: doc.id, ...(doc.data() as Omit<User, "uid">) }))
          .filter(
            (u) =>
              u.uid !== currentUid &&
              !relatedUids.has(u.uid) &&
              !users.some((uu) => uu.uid === u.uid)
          );
        users = [...users, ...emailUsers].slice(0, SEARCH_LIMIT);
      }

      setSuggested(users);
      setLoading(false);
    };
    fetchSearch();
  }, [currentUid, relatedUids, search]);

  const handleSendRequest = async (user: User) => {
    if (!currentUid) return;
    setSending(user.uid);
    await addDoc(collection(db, "friendships"), {
      participants: [currentUid, user.uid],
      status: "pending",
      requestBy: currentUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setSent((prev) => [...prev, user.uid]);
    setSending(null);
  };

  return (
    <div className="flex-1 p-2">
      <h5>Discover Users</h5>
      <input
        className="form-control mb-3"
        placeholder="Search by name or email"
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
              className="list-group-item d-flex justify-content-between align-items-center"
            >
              <div>
                <div>{user.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {user.email}
                </div>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DiscoverUsers;
