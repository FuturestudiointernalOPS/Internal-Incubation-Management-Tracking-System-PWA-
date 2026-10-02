import Image from "next/image";

/**
 * The Future Studio mark, repeated at the top of every screen of the public run.
 *
 * Extracted from the public submit page.
 */
export default function BrandingLogo({ className }) {
  return (
    <div className="flex flex-col items-center">
      <Image
        src="/brand/logo_full.png"
        alt="Future Studio"
        width={1018}
        height={1024}
        className={className}
      />
    </div>
  );
}