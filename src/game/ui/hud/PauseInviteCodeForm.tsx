import type { Dispatch, SetStateAction } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PauseInviteCodeFormProps = {
  focusIndex: number;
  focused: boolean;
  currentInviteRoomCode: string;
  inviteCodeInput: string;
  inviteCodeMessage: string;
  setInviteCodeInput: Dispatch<SetStateAction<string>>;
  setInviteCodeMessage: Dispatch<SetStateAction<string>>;
  joinInviteCode: () => void;
  onFocus: () => void;
  className?: string;
};

export function PauseInviteCodeForm({
  focusIndex,
  focused,
  currentInviteRoomCode,
  inviteCodeInput,
  inviteCodeMessage,
  setInviteCodeInput,
  setInviteCodeMessage,
  joinInviteCode,
  onFocus,
  className = "pause-invite-form flex w-full flex-col gap-1 border-2 bg-black/45 p-2 text-cyan-50",
}: PauseInviteCodeFormProps) {
  return (
    <form
      data-testid="invite-code-form"
      data-menu-index={focusIndex}
      className={cn(
        className,
        focused ? "border-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.35)]" : "border-cyan-100/35",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        joinInviteCode();
      }}
      onMouseEnter={onFocus}
    >
      <div className="pause-invite-header flex items-center justify-between gap-2 tracking-widest text-cyan-100/80">
        <span>ROOM</span>
        <span className="normal-case text-yellow-200">{currentInviteRoomCode}</span>
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          data-testid="invite-code-input"
          aria-label="Invite code"
          value={inviteCodeInput}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="enter invite code"
          className="pause-invite-input normal-case min-w-[180px] flex-1 border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#120c16] px-3 py-2 text-white outline-none focus:border-yellow-200"
          onChange={(event) => {
            setInviteCodeInput(event.target.value);
            setInviteCodeMessage("");
          }}
          onFocus={onFocus}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <button
          data-testid="invite-code-submit"
          type="submit"
          className="pause-invite-submit border-2 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-2 text-white hover:bg-[#666]"
        >
          JOIN
        </button>
      </div>
      <div className="pause-invite-message min-h-[1rem] tracking-widest text-cyan-100/60">
        {inviteCodeMessage || "TYPE THE SAME ROOM CODE ON EACH DEVICE"}
      </div>
    </form>
  );
}
