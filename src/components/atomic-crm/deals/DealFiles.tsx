import { Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  RecordContextProvider,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
  type RaRecord,
} from "ra-core";
import { Button } from "@/components/ui/button";

import { AttachmentField } from "../notes/AttachmentField";
import { ATTACHMENTS_BUCKET } from "../providers/commons/attachments";
import { getSupabaseClient } from "../providers/supabase/supabase";
import type { AttachmentNote, Deal } from "../types";

/**
 * Files attached to a deal. Files are uploaded to the Supabase Storage
 * `attachments` bucket (same plumbing as notes), and the resulting
 * `{ src, title, path, type }` objects are stored in `deals.attachments`.
 */
export const DealFiles = () => {
  const deal = useRecordContext<Deal>();
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!deal) return null;

  const attachments = deal.attachments ?? [];
  const busy = uploading || deleting;

  const saveAttachments = async (
    nextAttachments: AttachmentNote[],
    successMessage: string,
  ) => {
    await dataProvider.update("deals", {
      id: deal.id,
      data: { attachments: nextAttachments },
      previousData: deal,
    });
    notify(successMessage, { type: "info" });
    refresh();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: AttachmentNote[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadDealFile(file));
      }
      await saveAttachments(
        [...attachments, ...uploaded],
        "resources.deals.updated",
      );
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (index: number) => {
    setDeleting(true);
    try {
      await saveAttachments(
        attachments.filter((_, fileIndex: number) => fileIndex !== index),
        "resources.deals.updated",
      );
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-2" data-testid="deal-children-files">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {translate("resources.deals.files.title")}
        </h3>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          data-testid="deal-file-input"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {translate("resources.deals.files.add")}
        </Button>
      </div>

      {!attachments.length ? (
        <p className="text-xs text-muted-foreground">
          {translate("resources.deals.files.empty")}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {attachments.map((file, index) => (
            <li
              key={file.path ?? file.src ?? index}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0 overflow-hidden">
                <RecordContextProvider value={file as unknown as RaRecord}>
                  <AttachmentField
                    source="src"
                    title="title"
                    target="_blank"
                    download={file.title}
                  />
                </RecordContextProvider>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive"
                disabled={busy}
                aria-label={translate("ra.action.delete")}
                title={translate("ra.action.delete")}
                onClick={() => void handleDelete(index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// The `rawFile` is only used by the upload itself: the jsonb stored in
// `deals.attachments` keeps `{ src, title, path, type }`, like note attachments.
const uploadDealFile = async (file: File): Promise<AttachmentNote> => {
  const fileParts = file.name.split(".");
  const extension = fileParts.length > 1 ? `.${fileParts.pop()}` : "";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const client = getSupabaseClient();
  const { error } = await client.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file);
  if (error) {
    throw error;
  }
  const { data } = client.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  return {
    src: data.publicUrl,
    title: file.name,
    path,
    type: file.type,
  } as AttachmentNote;
};
