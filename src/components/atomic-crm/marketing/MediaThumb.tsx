import { useQuery } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { useDataProvider } from "ra-core";

import type { CrmDataProvider } from "../providers/types";
import type { PostMedia } from "./types";

/** A small preview of a photo of a post; a video shows as a film icon. */
export const MediaThumb = ({ media }: { media: PostMedia }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const isVideo = media.mime.startsWith("video/");
  const { data: url } = useQuery({
    queryKey: ["post_media_url", media.path],
    queryFn: () => dataProvider.postMediaUrl(media.path),
    enabled: !isVideo,
    staleTime: 30 * 60 * 1000,
  });

  return (
    <div className="flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {isVideo ? (
        <Film className="size-6 text-muted-foreground" />
      ) : url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : null}
    </div>
  );
};
