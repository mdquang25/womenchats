import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";

let testEnv: any;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "projectchat3-b0aa1",
    firestore: {
      host: "localhost",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore security rules - full coverage", () => {
  test("Users: chỉ được đọc khi email đã verified", async () => {
    const alice = testEnv.authenticatedContext("alice", {
      email_verified: true,
    });
    const bob = testEnv.authenticatedContext("bob", { email_verified: false });
    const dbAlice = alice.firestore();
    const dbBob = bob.firestore();

    // Alice tạo user document của chính mình
    await assertSucceeds(
      dbAlice.collection("users").doc("alice").set({ name: "Alice" })
    );

    // Alice đọc được user document
    await assertSucceeds(dbAlice.collection("users").doc("alice").get());

    // Bob không đọc được user document vì email chưa verified
    await assertFails(dbBob.collection("users").doc("alice").get());
  });

  test("Friendships: CRUD hợp lệ", async () => {
    const alice = testEnv.authenticatedContext("alice", {
      email_verified: true,
    });
    const bob = testEnv.authenticatedContext("bob", { email_verified: true });
    const dbAlice = alice.firestore();
    const dbBob = bob.firestore();

    // Alice tạo friendship request với Bob
    const fid = "alice_bob";
    await assertSucceeds(
      dbAlice
        .collection("friendships")
        .doc(fid)
        .set({
          participants: ["alice", "bob"],
          requestBy: "alice",
          status: "pending",
        })
    );

    // Bob update status từ pending -> accepted
    await assertSucceeds(
      dbBob.collection("friendships").doc(fid).update({
        status: "accepted",
      })
    );

    // Người ngoài không được update/delete
    const charlie = testEnv.authenticatedContext("charlie", {
      email_verified: true,
    });
    const dbCharlie = charlie.firestore();
    await assertFails(
      dbCharlie
        .collection("friendships")
        .doc(fid)
        .update({ status: "accepted" })
    );
    await assertFails(dbCharlie.collection("friendships").doc(fid).delete());
  });

  test("Chats & Messages: quyền truy cập dựa trên participants và isFriend", async () => {
    const alice = testEnv.authenticatedContext("alice", {
      email_verified: true,
    });
    const bob = testEnv.authenticatedContext("bob", { email_verified: true });
    const charlie = testEnv.authenticatedContext("charlie", {
      email_verified: true,
    });
    const dbAlice = alice.firestore();
    const dbBob = bob.firestore();
    const dbCharlie = charlie.firestore();

    // Tạo friendship giữa Alice và Bob
    await dbAlice
      .collection("friendships")
      .doc("alice_bob")
      .set({
        participants: ["alice", "bob"],
        status: "accepted",
        requestBy: "alice",
      });

    // Alice tạo chat với Bob
    const chatRef = dbAlice.collection("chats").doc("chat1");
    await assertSucceeds(
      chatRef.set({
        participants: ["alice", "bob"],
      })
    );

    // Alice gửi message
    const msgRef = chatRef.collection("messages").doc("msg1");
    await assertSucceeds(
      msgRef.set({
        text: "Hello Bob",
        senderId: "alice",
        timestamp: Date.now(),
      })
    );

    // Alice và Bob đọc được message
    await assertSucceeds(msgRef.get());
    await assertSucceeds(
      dbBob
        .collection("chats")
        .doc("chat1")
        .collection("messages")
        .doc("msg1")
        .get()
    );

    // Charlie không đọc được message
    await assertFails(
      dbCharlie
        .collection("chats")
        .doc("chat1")
        .collection("messages")
        .doc("msg1")
        .get()
    );

    // Alice update message (chỉ các field cho phép)
    await assertSucceeds(
      msgRef.update({ text: "Updated text", timestamp: Date.now() })
    );

    // Bob không update được message của Alice
    await assertFails(
      dbBob
        .collection("chats")
        .doc("chat1")
        .collection("messages")
        .doc("msg1")
        .update({ text: "Hack" })
    );

    // Delete luôn fail
    await assertFails(msgRef.delete());
  });
});
