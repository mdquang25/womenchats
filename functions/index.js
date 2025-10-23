// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// 📨 Gửi thông báo khi có tin nhắn mới
exports.sendNewMessageNotification = functions.firestore
    .document("chats/{chatId}/messages/{msgId}")
    .onCreate(async (snap, context) => {
        try {
            const msg = snap.data();
            if (!msg) return;

            const senderId = msg.senderId;
            const chatId = context.params.chatId;

            // 🔹 Lấy thông tin chat
            const chatDoc = await admin.firestore().doc(`chats/${chatId}`).get();
            if (!chatDoc.exists) {
                console.log("Chat not found:", chatId);
                return;
            }

            const chatData = chatDoc.data();
            const participants = chatData.participants || [];
            const receiverId = participants.find((id) => id !== senderId);

            if (!receiverId) {
                console.log("No receiver found for chat:", chatId);
                return;
            }

            // 🔹 Lấy token của người nhận
            const tokenDoc = await admin.firestore().doc(`fcmTokens/${receiverId}`).get();
            if (!tokenDoc.exists) {
                console.log("No FCM token found for receiver:", receiverId);
                return;
            }

            const token = tokenDoc.data().token;
            if (!token) {
                console.log("Receiver has no token:", receiverId);
                return;
            }

            // 🔹 Gửi thông báo
            await admin.messaging().send({
                token,
                notification: {
                    title: "Tin nhắn mới",
                    body: msg.text || "Bạn có tin nhắn mới",
                },
            });

            console.log(`Sent notification to ${receiverId}`);
        } catch (error) {
            console.error("Error sending message notification:", error);
        }
    });
