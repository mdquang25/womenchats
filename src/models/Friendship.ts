import type { Timestamp } from "firebase/firestore";

export interface Friendship {
  id: string;
  participants: string[]; // uids
  status: "pending" | "accepted" | "blocked";
  requestBy: string; // uid of the user who sent the request
  createdAt: Timestamp; // timestamp
  updatedAt: Timestamp; // timestamp
}
