import {
  Camera,
  Globe,
  MessageCircle,
  MessagesSquare,
  Phone,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { ChannelKind } from "./types";

const ICONS: Record<ChannelKind, { icon: LucideIcon; label: string }> = {
  telegram: { icon: Send, label: "Telegram" },
  widget: { icon: Globe, label: "Website" },
  instagram: { icon: Camera, label: "Instagram" },
  messenger: { icon: MessageCircle, label: "Messenger" },
  whatsapp: { icon: Phone, label: "WhatsApp" },
  viber: { icon: MessagesSquare, label: "Viber" },
};

/** The mark of the channel a chat came through. */
export const ChannelIcon = ({
  kind,
  className,
}: {
  kind?: ChannelKind;
  className?: string;
}) => {
  const { icon: Icon, label } = ICONS[kind ?? "telegram"];
  return (
    <Icon
      className={cn(
        "size-5 shrink-0",
        kind === "telegram" || kind == null
          ? "text-sky-600"
          : "text-muted-foreground",
        className,
      )}
      aria-label={label}
    />
  );
};
