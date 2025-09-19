import type { Timestamp } from "firebase/firestore";

export interface Chat {
  cid: string;
  participants: string[]; // uids
  lastMessage: string;
  updatedAt: Timestamp; // timestamp
}
