export interface Message {
  id: string;
  text: string;
  senderId: string;
  deleted: boolean;
  timestamp?: any;
}
