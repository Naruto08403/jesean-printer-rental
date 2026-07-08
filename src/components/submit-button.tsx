"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { LoadingOverlay } from "@/components/loading-overlay";

type ButtonProps = ComponentProps<typeof Button>;

export function SubmitButton({
  children,
  loadingText,
  ...props
}: ButtonProps & { loadingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} disabled={pending || props.disabled} {...props}>
      {pending && loadingText ? loadingText : children}
    </Button>
  );
}

export function FormLoadingOverlay({
  message = "Saving…",
  submessage = "This may take a moment on slower connections.",
}: {
  message?: string;
  submessage?: string;
}) {
  const { pending } = useFormStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!pending || !mounted) return null;

  return createPortal(
    <LoadingOverlay message={message} submessage={submessage} />,
    document.body
  );
}
