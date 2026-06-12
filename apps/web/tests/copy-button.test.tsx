import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopyButton } from "@/components/shared/copy-button";

describe("CopyButton", () => {
  it("renders with label", () => {
    render(<CopyButton value="test-value" label="Copy" />);
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("copies value to clipboard on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyButton value="test-value" label="Copy" />);
    fireEvent.click(screen.getByText("Copy"));

    expect(writeText).toHaveBeenCalledWith("test-value");
  });
});
