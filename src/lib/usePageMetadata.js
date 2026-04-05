import { useEffect } from "react";

function updateMetaDescription(content) {
  if (typeof document === "undefined") return;

  let element = document.querySelector('meta[name="description"]');
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", "description");
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

export default function usePageMetadata({ title, description }) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previousTitle = document.title;
    const previousDescription =
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

    if (title) {
      document.title = title;
    }

    if (description) {
      updateMetaDescription(description);
    }

    return () => {
      document.title = previousTitle;
      updateMetaDescription(previousDescription);
    };
  }, [description, title]);
}
