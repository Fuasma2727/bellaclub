import type { SVGProps } from "react";

const paths = {
  edit: (
    <>
      <path d="m16 4 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L3 16l-1 5Z" />
      <path d="M13 21h8" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h15v12H6a3 3 0 0 1-3-3V6" />
      <path d="M21 12h-5v5h5" />
      <path d="M17 14.5h1" />
    </>
  ),
  location: (
    <>
      <path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  chevron: <path d="m8 10 4 4 4-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  boost: (
    <>
      <path d="m13 3-9 11h7l-1 7 10-11h-7l1-7Z" />
    </>
  ),
  invite: (
    <>
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21v-2a6 6 0 0 1 12 0v2m4-13v6m-3-3h6" />
    </>
  ),
  pause: (
    <>
      <path d="M7 5h3v14H7zm7 0h3v14h-3z" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7V5Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
};

export default function ProfileIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
