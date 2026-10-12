"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";

type Props = {
  children: string;
  variant?: "primary" | "secondary";
};

export default function SubmitButton({ children, variant = "primary" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variant === "primary" ? "lw-primary-btn" : "lw-secondary-btn"} lw-full-btn`}
    >
      {pending ? <LoaderCircle className="lw-spin-icon" size={18} /> : <ArrowRight size={19} />}
      {pending ? "لحظة..." : children}
    </button>
  );
}
