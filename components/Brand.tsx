import Image from "next/image";

type Props = {
  variant?: "default" | "landing" | "compact";
  tagline?: string;
  className?: string;
};

/** The supplied SeaSentry artwork is shared by every branded surface. */
export default function Brand({ variant = "default", tagline, className = "" }: Props) {
  return (
    <span className={`brand brand--${variant} ${className}`}>
      <span className="brand-mark">
        <Image
          src="/brand/seasentry-logo.jpg"
          alt={variant === "compact" ? "SeaSentry" : ""}
          width={1924}
          height={1924}
          sizes={variant === "landing" ? "72px" : "56px"}
          loading="eager"
        />
      </span>
      {variant !== "compact" && (
        <span className="brand-copy">
          <strong translate="no">SeaSentry</strong>
          {tagline && <span>{tagline}</span>}
        </span>
      )}
    </span>
  );
}
