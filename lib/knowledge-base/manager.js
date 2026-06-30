// lib/knowledge-base/manager.js
import OpenAI from "openai";
import { db } from "@/lib/firestore/admin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID;

/**
 * Uploads a file (Buffer/Blob from the API route) to OpenAI, attaches it
 * to the vector store, and tracks it in Firestore for the dashboard list.
 */
export async function addDocument({ fileBuffer, fileName, mimeType }) {
  const docRef = db.collection("knowledge_base").doc();

  await docRef.set({
    title: fileName,
    openai_file_id: null,
    vector_store_id: VECTOR_STORE_ID,
    uploaded_at: new Date(),
    status: "processing",
  });

  try {
    const file = await openai.files.create({
      file: new File([fileBuffer], fileName, { type: mimeType }),
      purpose: "assistants",
    });

    await openai.vectorStores.files.create(VECTOR_STORE_ID, {
      file_id: file.id,
    });

    // poll briefly for indexing completion (OpenAI processes async on their side)
    const finalStatus = await waitForIndexing(file.id);

    await docRef.update({
      openai_file_id: file.id,
      status: finalStatus === "completed" ? "ready" : "failed",
    });

    return { id: docRef.id, status: finalStatus === "completed" ? "ready" : "failed" };
  } catch (err) {
    console.error("Knowledge base upload failed:", err);
    await docRef.update({ status: "failed" });
    throw err;
  }
}

async function waitForIndexing(fileId, attempts = 10, delayMs = 1500) {
  for (let i = 0; i < attempts; i++) {
    const status = await openai.vectorStores.files.retrieve(VECTOR_STORE_ID, fileId);
    if (status.status === "completed" || status.status === "failed") {
      return status.status;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return "processing"; // still going — dashboard will show "processing" until a manual refresh
}

export async function removeDocument(docId) {
  const docRef = db.collection("knowledge_base").doc(docId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error("Document not found");

  const { openai_file_id, vector_store_id } = doc.data();

  if (openai_file_id) {
    await openai.vectorStores.files.delete(vector_store_id || VECTOR_STORE_ID, openai_file_id);
    await openai.files.delete(openai_file_id);
  }

  await docRef.delete();
}

export async function listDocuments() {
  const snap = await db
    .collection("knowledge_base")
    .orderBy("uploaded_at", "desc")
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
