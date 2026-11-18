import type { Experimental_GeneratedImage } from 'ai';
import { cn } from '@/lib/utils';

export type ImageProps = Experimental_GeneratedImage & {
  className?: string;
  alt?: string;
};

export const Image = ({
  base64,
  uint8Array: _uint8Array,
  mediaType,
  ...props
}: ImageProps) => (
  // biome-ignore lint/performance/noImgElement: 渲染 AI 生成的 data:URL 图片，next/image 不适用
  <img
    {...props}
    alt={props.alt}
    className={cn(
      'h-auto max-w-full overflow-hidden rounded-md',
      props.className,
    )}
    src={`data:${mediaType};base64,${base64}`}
  />
);
