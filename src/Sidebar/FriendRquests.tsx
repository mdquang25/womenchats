import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Friendship } from "../models/Friendship";
import type { User } from "../models/User";
import Loading from "../utils/Loading";

function FriendRequests() {
  const [received, setReceived] = useState<(Friendship & { user: User })[]>([]);
  const [sent, setSent] = useState<(Friendship & { user: User })[]>([]);
  const [loading, setLoading] = useState(true);

  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    const fetchRequests = async () => {
      if (!currentUid) return;
      setLoading(true);

      // Get all pending friendships involving current user
      const q = query(
        collection(db, "friendships"),
        where("participants", "array-contains", currentUid),
        where("status", "==", "pending"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const requests: Friendship[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Friendship, "id">),
      }));

      // Split into received and sent
      const receivedReqs = requests.filter((f) => f.requestBy !== currentUid);
      const sentReqs = requests.filter((f) => f.requestBy === currentUid);

      // Fetch user info for each request
      const getUser = async (uid: string) => {
        const userSnap = await getDocs(
          query(collection(db, "users"), where("__name__", "==", uid))
        );
        if (!userSnap.empty) {
          const doc = userSnap.docs[0];
          return { uid: doc.id, ...(doc.data() as Omit<User, "uid">) };
        }
        return { uid, name: "Unknown", email: "" };
      };

      const receivedWithUser = await Promise.all(
        receivedReqs.map(async (f) => {
          //   const otherUid = f.participants.find((u) => u !== currentUid)!;
          return { ...f, user: await getUser(f.requestBy) };
        })
      );
      const sentWithUser = await Promise.all(
        sentReqs.map(async (f) => {
          const otherUid = f.participants.find((u) => u !== currentUid)!;
          return { ...f, user: await getUser(otherUid) };
        })
      );

      setReceived(receivedWithUser);
      setSent(sentWithUser);
      setLoading(false);
    };
    fetchRequests();
  }, [currentUid]);

  // Accept a friend request
  const handleAccept = async (id: string) => {
    await updateDoc(doc(db, "friendships", id), {
      status: "accepted",
      updatedAt: serverTimestamp(),
    });
    const friendship = received.find((f) => f.id === id);
    if (!friendship) return;
    await setDoc(doc(db, "chats", friendship.id), {
      participants: friendship?.participants,
      lastMessage: "",
      updatedAt: serverTimestamp(),
    });

    // Refresh list
    setReceived((prev) => prev.filter((f) => f.id !== id));
  };

  // Decline a friend request (delete)
  const handleDecline = async (id: string) => {
    await deleteDoc(doc(db, "friendships", id));
    setReceived((prev) => prev.filter((f) => f.id !== id));
  };

  // Cancel a sent request (delete)
  const handleCancel = async (id: string) => {
    await deleteDoc(doc(db, "friendships", id));
    setSent((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex-1 d-flex h-100 p-2 flex-column border-end bg-white">
      <div className="fw-bold fs-6">Lời mời kết bạn</div>
      {loading ? (
        <Loading />
      ) : received.length === 0 ? (
        <em className="text-muted">Không có lời mời nào.</em>
      ) : (
        <ul className="list-group mb-4">
          {received.map((f) => (
            <li key={f.id} className="list-group-item d-flex flex-column">
              <div>
                <div>{f.user.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {f.user.email.length > 30
                    ? f.user.email.slice(0, 30) + "..."
                    : f.user.email}
                </div>
              </div>
              <div>
                <button
                  className="btn btn-sm btn-success me-2"
                  onClick={() => handleAccept(f.id)}
                >
                  Chấp nhận
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleDecline(f.id)}
                >
                  Từ chối
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <hr />
      <div className="fw-bold fs-6 ">Lời mời kết bạn đã gửi</div>
      {loading ? (
        <Loading />
      ) : sent.length === 0 ? (
        <em className="text-muted">Không có lời mời đã gửi.</em>
      ) : (
        <ul className="list-group">
          {sent.map((f) => (
            <li
              key={f.id}
              className="card mt-2 shadow list-group-item d-flex flex-column"
            >
              <div>
                <div>{f.user.name}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {f.user.email.length > 30
                    ? f.user.email.slice(0, 30) + "..."
                    : f.user.email}
                </div>
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleCancel(f.id)}
              >
                Thu hồi lời mời
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FriendRequests;
