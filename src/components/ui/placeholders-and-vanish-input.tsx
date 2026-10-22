import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlaceholdersAndVanishInputProps {
  placeholders: string[];
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
  defaultValue?: string;
  /** When set, the input is controlled by the parent. */
  value?: string;
}

export function PlaceholdersAndVanishInput({
  placeholders,
  onChange,
  onSubmit,
  className,
  defaultValue = "",
  value: controlled,
}: PlaceholdersAndVanishInputProps) {
  const [internal, setValue] = useState(defaultValue);
  const value = controlled ?? internal;
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((p) => (p + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [placeholders.length]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit?.(value.trim());
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-line bg-base-900/80 p-1.5 shadow-[0_0_0_1px_rgba(124,108,255,0.06)] transition-colors focus-within:border-accent/50",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Search className="ml-3 size-5 shrink-0 text-ink-faint" aria-hidden />
        <div className="relative flex-1">
          {!value && (
            <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentPlaceholder}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="whitespace-nowrap text-[15px] text-ink-faint"
                >
                  {placeholders[currentPlaceholder]}
                </motion.span>
              </AnimatePresence>
            </div>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onChange?.(e.target.value);
            }}
            aria-label="Ask a question about your metric"
            className="h-12 w-full bg-transparent pr-3 text-[15px] text-ink outline-none placeholder:text-transparent"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-xl bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-deep"
        >
          Investigate
        </button>
      </div>
    </form>
  );
}
