import { ChatPanel } from "@/components/chat-panel";
import { Shell } from "@/components/shell";
export default function Page() {
  return (
    <Shell active="chat">
      <ChatPanel />
    </Shell>
  );
}
