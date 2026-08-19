interface TypingIndicatorProps {
  typingUsers: string[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps): React.ReactElement | null {
  if (typingUsers.length === 0) return null;

  let text: string;
  if (typingUsers.length === 1) {
    text = `${typingUsers[0]} đang gõ…`;
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0]} và ${typingUsers[1]} đang gõ…`;
  } else {
    text = `${typingUsers.length} người đang gõ…`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs italic text-muted-foreground">{text}</span>
    </div>
  );
}
