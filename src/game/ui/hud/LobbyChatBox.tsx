import { clsx, type ClassValue } from "clsx";
import type { ReactElement } from "react";
import { twMerge } from "tailwind-merge";
import type { LobbyMessage } from "../../../store/gameStore";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LOBBY_CHAT_VISIBLE_MESSAGE_LIMIT = 5;

function renderVisibleLobbyMessages(messages: readonly LobbyMessage[]) {
  const startIndex = Math.max(0, messages.length - LOBBY_CHAT_VISIBLE_MESSAGE_LIMIT);
  const renderedMessages: ReactElement[] = [];
  for (let index = startIndex; index < messages.length; index += 1) {
    const message = messages[index];
    renderedMessages.push(
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
    );
  }
  return renderedMessages;
}

export function LobbyChatBox({ messages }: { messages: LobbyMessage[] }) {
  if (messages.length === 0) return null;

  return (
    <div
      data-testid="lobby-chat-box"
      className="lobby-notification-feed pointer-events-none absolute z-[90] flex w-[min(330px,calc(100cqw-24px))] flex-col gap-1 font-mono"
    >
      {renderVisibleLobbyMessages(messages)}
    </div>
  );
}
