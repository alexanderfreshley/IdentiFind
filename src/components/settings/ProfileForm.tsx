"use client";

import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ProfileFormProps {
  initialName: string;
  initialImage: string | null;
}

export function ProfileForm({ initialName, initialImage }: ProfileFormProps) {
  const [name, setName]   = useState(initialName);
  const [image, setImage] = useState(initialImage ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const isDirty = name !== initialName || (image || null) !== initialImage;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirty) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, image: image.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage("Profile updated.");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Update failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">
          Display Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-white/50 mb-1.5">
          Avatar URL <span className="text-white/25">(optional)</span>
        </label>
        <input
          type="url"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://example.com/avatar.jpg"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <p className="text-xs text-white/25 mt-1">
          Paste a direct image URL. Leave blank to use your initials.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!isDirty || status === "loading"}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {status === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {status === "loading" ? "Saving…" : "Save Changes"}
        </button>

        {status === "success" && (
          <span className="flex items-center gap-1.5 text-sm text-green-400">
            <CheckCircle className="h-3.5 w-3.5" /> {message}
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {message}
          </span>
        )}
      </div>
    </form>
  );
}
