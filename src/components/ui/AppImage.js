"use client";

import Image from "next/image";

/**
 * AppImage — the ONE place a plain `<img>` is allowed.
 *
 * Every other image in the app renders through this component. Almost all of
 * them are author- or contact-provided URLs on an arbitrary host, or short-lived
 * signed storage links: there is no fixed domain the Next optimiser could be
 * told to allow, and the caller's own `referrerPolicy`/`loading` attributes are
 * load-bearing. Those fall through to a plain `<img>`, and the
 * `@next/next/no-img-element` exemption lives HERE instead of being repeated at
 * every call site.
 *
 * A host listed below, with the dimensions the caller supplies, is routed
 * through `next/image`:
 *
 *     <AppImage src={known.url} alt="" width={640} height={360} />
 *
 * `OPTIMISABLE_HOSTS` and `images.remotePatterns` in `next.config.mjs` are the
 * SAME list: a host must be in both, because the optimiser refuses a host the
 * config does not allow. Today the set is empty on purpose — no host qualifies —
 * so every image takes the plain path.
 */
const OPTIMISABLE_HOSTS = new Set([]);

function hostOf(src) {
  if (typeof src !== "string") return null;
  try {
    return new URL(src).host;
  } catch {
    // A relative or malformed source is never optimisable.
    return null;
  }
}

export default function AppImage({
  src,
  alt = "",
  width,
  height,
  fill = false,
  sizes,
  className,
  style,
  ...imgProps
}) {
  const host = hostOf(src);
  const optimisable =
    host !== null &&
    OPTIMISABLE_HOSTS.has(host) &&
    (fill || (width != null && height != null));

  if (!optimisable) {
    // The single justified plain image. Kept deliberately: see the note above.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        {...imgProps}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      sizes={sizes}
      className={className}
      style={style}
      {...imgProps}
    />
  );
}
