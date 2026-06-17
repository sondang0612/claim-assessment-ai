import { SyncLoader } from "react-spinners";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export default function MessageBubble({
  role,
  content,
  isStreaming,
}: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words ${
          isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm"
        }`}
      >
        {content ||
          (isStreaming && !isUser ? (
            <SyncLoader size={8} speedMultiplier={0.5} />
          ) : (
            <SyncLoader size={8} speedMultiplier={0.5} />
          ))}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
          <span className="text-gray-600 text-xs font-bold">You</span>
        </div>
      )}
    </div>
  );
}
