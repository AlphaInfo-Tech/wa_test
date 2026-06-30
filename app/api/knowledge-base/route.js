// app/api/knowledge-base/route.js
import {
  addDocument,
  removeDocument,
  listDocuments,
} from "@/lib/knowledge-base/manager";
import { requireAuth } from "@/lib/auth/verify-request";

const ALLOWED_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
const MAX_FILE_SIZE_MB = 20;

export async function GET(req) {
  const agent = await requireAuth(req);
  if (!agent) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const docs = await listDocuments();
    return Response.json({ documents: docs });
  } catch (err) {
    console.error("list knowledge base error:", err);
    return Response.json({ error: "Failed to list documents" }, { status: 500 });
  }
}

export async function POST(req) {
  const agent = await requireAuth(req);
  if (!agent) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_FILE_SIZE_MB) {
      return Response.json(
        { error: `File exceeds ${MAX_FILE_SIZE_MB}MB limit` },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload + indexing can take a few seconds (polling inside addDocument);
    // run it inline here since the dashboard wants to show the result right away.
    // If your files are large/numerous, consider moving this to waitUntil and
    // having the dashboard poll GET for status instead.
    const result = await addDocument({
      fileBuffer,
      fileName: file.name,
      mimeType: file.type,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    console.error("upload knowledge base error:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const agent = await requireAuth(req);
  if (!agent) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("id");

    if (!docId) {
      return Response.json({ error: "Missing id" }, { status: 400 });
    }

    await removeDocument(docId);
    return Response.json({ deleted: true });
  } catch (err) {
    console.error("delete knowledge base error:", err);
    return Response.json({ error: "Delete failed" }, { status: 500 });
  }
}
