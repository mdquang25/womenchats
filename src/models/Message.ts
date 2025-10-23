import { Timestamp } from "firebase/firestore";

export interface Message {
  id: string;
  text: string;
  imageUrl?: string;
  senderId: string;
  deleted: boolean;
  edited: boolean;
  timestamp: Timestamp;
}
