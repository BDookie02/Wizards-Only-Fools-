import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LobbyMessage } from "../../../store/gameStore";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function LobbyChatBox({ messages }: { messages: LobbyMessage[] }) {
  const visibleMessages = messages.slice(-5);
  if (visibleMessages.length === 0) return null;

  return (
    <div
      data-testid="lobby-chat-box"
      className="lobby-notification-feed pointer-events-none absolute z-[90] flex w-[min(330px,calc(100cqw-24px))] flex-col gap-1 font-mono"
    >
      {visibleMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "normal-case text-[10px] leading-4 tracking-wider drop-shadow-[2px_2px_0_rgba(0,0,0,0.95)]",
            message.tone === "join" && "text-emerald-100",
            message.tone === "death" && "text-red-100",
            message.tone === "system" && "text-cyan-50"
          )}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}
