import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class GroupService {
  constructor(db) {
    this.db = db;
  }

  /* =========================
     グループ作成
     - owner を固定IDで登録
  ========================= */
  async createGroup(name, ownerUid, ownerUserName) {
    if (!name || !ownerUid || !ownerUserName) {
      throw new Error("invalid arguments");
    }

    // group 本体
    const groupRef = await addDoc(collection(this.db, "groups"), {
      name,
      ownerUid,
      ownerName: ownerUserName,
      createdAt: serverTimestamp()
    });

    // owner を groupMembers に固定IDで追加
    await setDoc(
      doc(this.db, "groupMembers", `${ownerUserName}_${groupRef.id}`),
      {
        groupId: groupRef.id,
        uid: ownerUid,
        userName: ownerUserName,
        role: "owner",
        createdBy: ownerUserName,
        createdAt: serverTimestamp()
      }
    );

    return groupRef.id;
  }

  /* =========================
     グループ検索
  ========================= */
  async searchGroups(keyword) {
    if (!keyword) return [];

    const q = query(
      collection(this.db, "groups"),
      where("name", ">=", keyword),
      where("name", "<=", keyword + "\uf8ff")
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  }

  /* =========================
     参加申請（userName 単位）
  ========================= */
  async requestJoin(groupId, uid, userName) {
    if (!groupId || !uid || !userName) {
      throw new Error("invalid arguments");
    }

    // userName 単位で二重申請防止
    const q = query(
      collection(this.db, "groupJoinRequests"),
      where("groupId", "==", groupId),
      where("userName", "==", userName)
    );

    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error("already requested");
    }

    await addDoc(collection(this.db, "groupJoinRequests"), {
      groupId,
      uid,
      userName,
      createdAt: serverTimestamp()
    });
  }

  /* =========================
     自分の所属グループ一覧
     ※ userName 基準
  ========================= */
  async getMyGroups(userName) {
    if (!userName) return [];

    const q = query(
      collection(this.db, "groupMembers"),
      where("userName", "==", userName)
    );

    const snap = await getDocs(q);
    const groups = [];

    for (const d of snap.docs) {
      const m = d.data();
      const gSnap = await getDoc(doc(this.db, "groups", m.groupId));
      if (!gSnap.exists()) continue;

      groups.push({
        groupId: m.groupId,
        role: m.role,
        ...gSnap.data()
      });
    }

    return groups;
  }

  /* =========================
     承認待ち一覧（owner）
  ========================= */
  async getPendingRequests(groupId) {
    if (!groupId) return [];

    const q = query(
      collection(this.db, "groupJoinRequests"),
      where("groupId", "==", groupId)
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
  }

  /* =========================
     承認（transaction）
     - member 追加（固定ID）
     - request 削除
  ========================= */
  async approveMember(requestId, ownerUserName) {
    if (!requestId || !ownerUserName) {
      throw new Error("invalid arguments");
    }

    const reqRef = doc(this.db, "groupJoinRequests", requestId);

    await runTransaction(this.db, async (tx) => {
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) {
        throw new Error("request not found");
      }

      const req = reqSnap.data();

      if (req.userName === ownerUserName) {
        throw new Error("owner cannot approve self");
      }

      const memberRef = doc(
        this.db,
        "groupMembers",
        `${req.userName}_${req.groupId}`
      );

      tx.set(memberRef, {
        groupId: req.groupId,
        uid: req.uid,
        userName: req.userName,
        role: "member",
        createdBy: ownerUserName,
        createdAt: serverTimestamp()
      });

      tx.delete(reqRef);
    });
  }

  /* =========================
     却下
  ========================= */
  async rejectMember(requestId) {
    if (!requestId) throw new Error("invalid requestId");
    await deleteDoc(doc(this.db, "groupJoinRequests", requestId));
  }

  /* =========================
     グループ退出（userName 単位）
  ========================= */
  async leaveGroup(groupId, userName) {
    if (!groupId || !userName) return;

    const q = query(
      collection(this.db, "groupMembers"),
      where("groupId", "==", groupId),
      where("userName", "==", userName)
    );

    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  }

  /* =========================
     グループ削除（owner）
  ========================= */
  async deleteGroup(groupId) {
    if (!groupId) throw new Error("invalid groupId");

    const members = await getDocs(
      query(collection(this.db, "groupMembers"), where("groupId", "==", groupId))
    );
    for (const d of members.docs) {
      await deleteDoc(d.ref);
    }

    const requests = await getDocs(
      query(collection(this.db, "groupJoinRequests"), where("groupId", "==", groupId))
    );
    for (const d of requests.docs) {
      await deleteDoc(d.ref);
    }

    await deleteDoc(doc(this.db, "groups", groupId));
  }
}
